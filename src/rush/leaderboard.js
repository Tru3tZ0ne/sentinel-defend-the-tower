// World ranking for Breach Rush.
//
// Works out-of-the-box on static hosting (GitHub Pages) using localStorage — a
// per-device board. For a TRUE global "world ranking", deploy the tiny Cloudflare
// Worker in tools/leaderboard-worker.js and point the game at it by either:
//   • setting window.__RUSH_API = 'https://your-worker.workers.dev' in the page, or
//   • editing DEFAULT_ENDPOINT below.
// When an endpoint is reachable the board merges global + local and shows "WORLD";
// otherwise it degrades gracefully to "LOCAL". No API keys live in the client.

const DEFAULT_ENDPOINT = '';
const LS_KEY = 'sentinel.rush.scores.v1';
const MAX_ROWS = 50;

function endpoint() {
  const w = (typeof window !== 'undefined' && window.__RUSH_API) || DEFAULT_ENDPOINT;
  return (w || '').replace(/\/+$/, '');
}

// ---- pure helpers (exported for tests) ----
export function sanitizeName(name) {
  const s = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
  return s || 'Anonymous';
}

export function mergeScores(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const r of (list || [])) {
      if (!r || typeof r.score !== 'number') continue;
      const row = { name: sanitizeName(r.name), score: Math.max(0, Math.round(r.score)), at: r.at || 0, id: r.id };
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

// ---- local storage ----
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function writeLocal(rows) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, MAX_ROWS))); } catch { /* ignore */ }
}

// ---- remote (optional) ----
async function remoteTop(signal) {
  const base = endpoint(); if (!base) return null;
  const res = await fetch(`${base}/top?n=${MAX_ROWS}`, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('http ' + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.scores || []);
}
async function remoteSubmit(row) {
  const base = endpoint(); if (!base) return null;
  const res = await fetch(`${base}/submit`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error('http ' + res.status);
  return res.json().catch(() => null);
}

// ---- public API ----
// Returns { rows, mode:'world'|'local' }.
export async function fetchBoard() {
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

// Record a score locally (always) and to the world board (if configured).
// Returns { rows, mode, rank }.
export async function submitScore({ name, score, stage, elapsed }) {
  const row = { name: sanitizeName(name), score: Math.max(0, Math.round(score)), at: Date.now(),
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, stage, elapsed };
  const local = mergeScores(readLocal(), [row]);
  writeLocal(local);
  if (!endpoint()) return { rows: local, mode: 'local', rank: rankOf(local, row.score) };
  try {
    await remoteSubmit(row);
    const remote = await remoteTop();
    const rows = mergeScores(remote, local);
    return { rows, mode: 'world', rank: rankOf(rows, row.score) };
  } catch {
    return { rows: local, mode: 'local', rank: rankOf(local, row.score) };
  }
}
