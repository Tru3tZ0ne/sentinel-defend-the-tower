// Sentinel · Breach Rush — global leaderboard (Cloudflare Worker).
//
// A tiny, free, serverless backend for the game's "world ranking". The static game
// (on GitHub Pages) works without this using a local board; deploy this to turn the
// board global. No framework, no secrets in the client.
//
// ---- Deploy (about 5 minutes, free tier) ----
//   1. Install wrangler:            npm i -g wrangler  &&  wrangler login
//   2. Create a KV namespace:       wrangler kv namespace create SCORES
//      copy the returned id.
//   3. wrangler.toml:
//        name = "sentinel-rush"
//        main = "leaderboard-worker.js"
//        compatibility_date = "2024-11-01"
//        [[kv_namespaces]]
//        binding = "SCORES"
//        id = "<the id from step 2>"
//   4. Deploy:                      wrangler deploy
//   5. In rush.html set:            window.__RUSH_API = 'https://sentinel-rush.<you>.workers.dev';
//
// Endpoints:  GET /top?n=50   ->  [{name, score, at}]      (sorted, highest first)
//             POST /submit    <-  {name, score, stage, elapsed}
//
// Abuse control: names/scores are sanitised and clamped, only the single best score
// per name is kept, and submissions are rate-limited per IP. It is a demo board, not
// a bank — the clamp keeps any single bad entry from wrecking the ranking.

const MAX_ROWS = 100;
const SCORE_CAP = 5_000_000;      // sanity clamp on a single score
const RATE_WINDOW = 10;           // seconds
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

function sanitizeName(n) {
  return (String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14)) || 'Anonymous';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/top' && request.method === 'GET') {
      const n = Math.min(MAX_ROWS, Math.max(1, +url.searchParams.get('n') || 50));
      const rows = JSON.parse((await env.SCORES.get('board')) || '[]');
      return json(rows.slice(0, n));
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      // simple per-IP rate limit
      const ip = request.headers.get('cf-connecting-ip') || 'anon';
      const rlKey = 'rl:' + ip;
      if (await env.SCORES.get(rlKey)) return json({ ok: false, error: 'rate_limited' }, 429);
      await env.SCORES.put(rlKey, '1', { expirationTtl: RATE_WINDOW });

      let body; try { body = await request.json(); } catch { return json({ ok: false }, 400); }
      const name = sanitizeName(body.name);
      const score = Math.max(0, Math.min(SCORE_CAP, Math.round(+body.score || 0)));
      if (!score) return json({ ok: false, error: 'bad_score' }, 400);

      const rows = JSON.parse((await env.SCORES.get('board')) || '[]');
      const row = { name, score, at: Date.now(), stage: +body.stage || 0, elapsed: +body.elapsed || 0 };
      // keep only the best score per name
      const i = rows.findIndex(r => r.name === name);
      if (i >= 0) { if (score > rows[i].score) rows[i] = row; }
      else rows.push(row);
      rows.sort((a, b) => b.score - a.score);
      const trimmed = rows.slice(0, MAX_ROWS);
      await env.SCORES.put('board', JSON.stringify(trimmed));
      return json({ ok: true, rows: trimmed });
    }

    return json({ ok: true, service: 'sentinel-rush-leaderboard' });
  },
};
