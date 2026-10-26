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

export function makeBoard({ lsKey, apiVar }) {
  const endpoint = () => ((typeof window !== 'undefined' && window[apiVar]) || '').replace(/\/+$/, '');

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(lsKey)) || []; } catch { return []; } };
  const writeLocal = rows => { try { localStorage.setItem(lsKey, JSON.stringify(rows.slice(0, MAX_ROWS))); } catch { /* ignore */ } };

  async function remoteTop(signal) {
    const base = endpoint(); if (!base) return null;
    const res = await fetch(`${base}/top?n=${MAX_ROWS}`, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.scores || []);
  }
  async function remoteSubmit(row) {
    const base = endpoint(); if (!base) return null;
    const res = await fetch(`${base}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) });
    if (!res.ok) throw new Error('http ' + res.status);
    return res.json().catch(() => null);
  }

  async function fetchBoard() {
    const local = readLocal();
    if (!endpoint()) return { rows: mergeScores(local), mode: 'local' };
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const remote = await remoteTop(ctrl.signal);
      clearTimeout(to);
      return { rows: mergeScores(remote, local), mode: 'world' };
    } catch {
      return { rows: mergeScores(local), mode: 'local' };
    }
  }

  async function submitScore({ name, score, note }) {
    const row = { name: sanitizeName(name), score: Math.max(0, Math.round(score)), at: Date.now(),
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, note };
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
