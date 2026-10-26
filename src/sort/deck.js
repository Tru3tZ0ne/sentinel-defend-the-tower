// Pure logic for "Packet Sort" — a snap-decision triage game. A live session appears;
// you ALLOW or BLOCK it before the timer drains. The skill is reading the signals: you
// learn which telemetry means "block". Themed as the Sangfor NGAF / IAG verdict queue.
// No DOM — unit-testable.

// Each session carries 1-3 signals. If ANY signal is hostile, the correct call is BLOCK;
// otherwise ALLOW. Players memorise the hostile tells over a run (that is the fun).
export const SIGNALS = {
  // --- clean traffic ---
  https:    { bad: false, en: 'HTTPS 443 to known SaaS',        zh: 'HTTPS 443 到已知 SaaS' },
  signed:   { bad: false, en: 'Signed vendor update',           zh: '已签名的厂商更新' },
  internal: { bad: false, en: 'Internal to internal',           zh: '内网到内网' },
  dns:      { bad: false, en: 'Standard DNS lookup',            zh: '标准 DNS 查询' },
  cdn:      { bad: false, en: 'Cached CDN asset',               zh: 'CDN 缓存资源' },
  mfa:      { bad: false, en: 'MFA session, verified user',     zh: 'MFA 会话，已验证用户' },
  patch:    { bad: false, en: 'OS patch from mirror',           zh: '来自镜像的系统补丁' },
  // --- hostile tells ---
  telnet:   { bad: true,  en: 'Telnet on 23 (cleartext)',       zh: 'Telnet 23 端口（明文）' },
  smb:      { bad: true,  en: 'SMB 445 from external',          zh: '外部访问 SMB 445' },
  rdp:      { bad: true,  en: 'RDP 3389 from foreign IP',       zh: '境外 IP 访问 RDP 3389' },
  c2:       { bad: true,  en: 'Beaconing to known C2',          zh: '向已知 C2 周期回连' },
  unsigned: { bad: true,  en: 'Unsigned binary payload',        zh: '未签名的二进制载荷' },
  spray:    { bad: true,  en: 'Credential spray pattern',       zh: '撞库/喷洒登录特征' },
  exfil:    { bad: true,  en: 'Large outbound to new host',     zh: '向新主机大量外发' },
  sni:      { bad: true,  en: 'TLS SNI / cert mismatch',        zh: 'TLS SNI 与证书不符' },
};
export const GOOD_KEYS = Object.keys(SIGNALS).filter(k => !SIGNALS[k].bad);
export const BAD_KEYS = Object.keys(SIGNALS).filter(k => SIGNALS[k].bad);

const PORTS = { https: 443, dns: 53, telnet: 23, smb: 445, rdp: 3389, internal: 8080, c2: 4444, spray: 22, exfil: 51820 };
const PROTOS = ['TCP', 'UDP', 'TLS', 'HTTP'];

// Level ramps every few solved sessions.
export function levelAt(solved) { return 1 + Math.floor(solved / 6); }

// Time to decide, in ms — shrinks with level, floored so it stays humane.
export function timeAt(level) { return Math.max(900, 2600 - (level - 1) * 95); }

// Combo multiplier: +1x every 5 correct, capped 5x.
export function comboMult(combo) { return Math.min(5, 1 + Math.floor(combo / 5)); }

// Points for a correct call — rewards fast calls and combo. timeFrac is remaining/total.
export function scoreFor({ timeFrac, combo }) {
  const base = 100;
  const speed = Math.round(Math.max(0, Math.min(1, timeFrac)) * 70);
  return (base + speed) * comboMult(combo);
}

export const START_LIVES = 3;

function rand(rng, arr) { return arr[(rng() * arr.length) | 0]; }

// Build one session. ~50% hostile. Hostile cards carry exactly one bad tell plus
// optional clean noise; clean cards carry only clean signals. Returns a display model.
export function makeCard(solved, rng = Math.random) {
  const level = levelAt(solved);
  const maxSignals = level >= 4 ? 3 : level >= 2 ? 2 : 1;
  const n = 1 + ((rng() * maxSignals) | 0);
  const hostile = rng() < 0.52;

  const keys = [];
  if (hostile) keys.push(rand(rng, BAD_KEYS));
  while (keys.length < n) {
    const g = rand(rng, GOOD_KEYS);
    if (!keys.includes(g)) keys.push(g);
  }
  // shuffle so the bad tell is not always first
  for (let i = keys.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [keys[i], keys[j]] = [keys[j], keys[i]]; }

  const signals = keys.map(k => ({ key: k, bad: SIGNALS[k].bad }));
  const malicious = signals.some(s => s.bad);
  const portKey = keys.find(k => PORTS[k] != null) || 'https';
  const oct = () => (rng() * 254 + 1) | 0;
  return {
    signals,
    malicious,
    proto: rand(rng, PROTOS),
    srcIp: `${oct()}.${oct()}.${oct()}.${oct()}`,
    port: PORTS[portKey] || 443,
    level,
  };
}

// The correct action for a card, and whether the player's action was right.
export function verdict(card) { return card.malicious ? 'block' : 'allow'; }
export function isCorrect(card, action) { return action === verdict(card); }
