// Shared world-ranking for the Sentinel quick-play arcade games (Packet Sort,
// Patch Panic, Sync Gate). Local-first on static hosting; upgrades to a true global
// board when a Cloudflare Worker endpoint is configured. One factory, one board per
// game (its own storage key + its own window.__<X>_API variable). No API keys here.
//
// makeBoard({ lsKey, apiVar }) -> { fetchBoard, submitScore, mode }
// Pure helpers (sanitizeName / mergeScores / rankOf) are exported for unit tests.

const MAX_ROWS = 50;

export function sanitizeName(name) {
  const s = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  return s || 'Anonymous';
}

export function mergeScores(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const r of (list || [])) {
      if (!r || typeof r.score !== 'number') continue;
      const row = { name: sanitizeName(r.name), score: Math.max(0, Math.round(r.score)), at: r.at || 0, id: r.id, note: r.note };
      const key = row.id || `${row.name}|${row.score}|${row.at}`;
      const prev = seen.get(key);
      if (!prev || row.score > prev.score) seen.set(key, row);
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score || b.at - a.at).slice(0, MAX_ROWS);
}

export function rankOf(rows, score) {
  let r = 1;
  for (const row of rows) { if (row.score > score) r++; else break; }
  return r;
}

export function makeBoard({ lsKey, apiVar, requireRemote = () => false }) {
  const endpoint = () => ((typeof window !== 'undefined' && window[apiVar]) || '').replace(/\/+$/, '');
  const required = () => typeof requireRemote === 'function' ? requireRemote() : requireRemote;
  async function request(url, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(lsKey)) || []; } catch { return []; } };
  const writeLocal = rows => { try { localStorage.setItem(lsKey, JSON.stringify(rows.slice(0, MAX_ROWS))); } catch { /* ignore */ } };

  async function remoteTop() {
    const base = endpoint(); if (!base) return null;
    const data = await request(`${base}/top?n=${MAX_ROWS}`, { headers: { accept: 'application/json' } });
    return Array.isArray(data) ? data : (data.scores || []);
  }
  async function remoteSubmit(row) {
    const base = endpoint(); if (!base) return null;
    return request(`${base}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) });
  }

  async function fetchBoard() {
    const local = readLocal();
    if (!endpoint()) return required() ? { rows: [], mode: 'offline' } : { rows: mergeScores(local), mode: 'local' };
    try {
      const remote = await remoteTop();
      return { rows: mergeScores(remote, required() ? [] : local), mode: required() ? 'server' : 'world' };
    } catch {
      return required() ? { rows: [], mode: 'offline' } : { rows: mergeScores(local), mode: 'local' };
    }
  }

  async function submitScore({ name, score, note, id, details }) {
    const row = { name: sanitizeName(name), score: Math.max(0, Math.round(score)), at: Date.now(),
                  id: id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, note, details };
    if (required()) {
      try {
        if (!endpoint()) throw new Error('Missing score server');
        const result = await remoteSubmit(row);
        if (result?.saved !== true || !Number.isInteger(result.rank)) throw new Error('Save not confirmed');
        return { rows: mergeScores(result.scores), mode: 'server', rank: result.rank, id: row.id, saved: true };
      } catch {
        return { rows: [], mode: 'offline', rank: null, id: row.id, saved: false };
      }
    }
    const local = mergeScores(readLocal(), [row]);
    writeLocal(local);
    const mine = local.find(r => r.id === row.id);
    if (!endpoint()) return { rows: local, mode: 'local', rank: rankOf(local, row.score), id: mine?.id };
    try {
      await remoteSubmit(row);
      const remote = await remoteTop();
      const rows = mergeScores(remote, local);
      return { rows, mode: 'world', rank: rankOf(rows, row.score), id: mine?.id };
    } catch {
      return { rows: local, mode: 'local', rank: rankOf(local, row.score), id: mine?.id };
    }
  }

  return { fetchBoard, submitScore };
}
