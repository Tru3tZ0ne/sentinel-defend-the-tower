// Incident Zero orchestrator: builds the board, wires correlate/contain/focus, the
// Field Manual, keyboard, leaderboard and language. Engine in game-soc.js.

import { createSocGame } from './game-soc.js';
import { TOOLS, STAGES, START_INTEGRITY } from './model.js';
import { reconcileAlerts, reconcileIncidents, manualHTML } from './ui-soc.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard } from '../arcade/board.js';
import { brandHTML, boardListHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const EN = {
  'soc.title': 'Incident Zero',
  'soc.tag': 'You run the Sangfor platform in a live SOC. A single alert is noise — correlate the ones that corroborate to confirm a real incident, then contain it with the one product whose real job stops that stage. Miss it and the kill chain runs to ransomware.',
  'soc.queue': 'Alert queue', 'soc.incidents': 'Active incidents',
  'soc.correlate': 'Correlate', 'soc.sel': '{n} selected', 'soc.xdr': 'XDR',
  'soc.noInc': 'No confirmed incidents. Watch the queue and correlate to surface them.',
  'soc.noAlerts': 'Sensors quiet. Stay ready.',
  'soc.integrity': 'Defenses', 'soc.time': 'Uptime',
  'soc.over': 'SOC overrun', 'soc.overSub': 'Your defenses fell after {s}s uptime. You confirmed {c} incidents and contained {k}.',
  'soc.confirmed': 'Confirmed', 'soc.contained': 'Contained', 'soc.breaches': 'Breaches',
  'stage.intrusion': 'Intrusion', 'stage.foothold': 'Foothold', 'stage.lateral': 'Lateral',
  'stage.exfil': 'Exfiltration', 'stage.ransom': 'Ransomware',
  'role.AF': 'Perimeter', 'role.EDR': 'Endpoint', 'role.NDR': 'Lateral', 'role.IAG': 'Egress', 'role.ASTOR': 'Restore', 'role.MDR': 'Assist',
  'tool.AF': 'AF', 'tool.EDR': 'EDR', 'tool.NDR': 'NDR', 'tool.IAG': 'IAG', 'tool.ASTOR': 'aStor', 'tool.MDR': 'MDR',
  'tc.confirmed': 'Incident confirmed  +{p}', 'tc.contained': 'Contained {a}  +{p}', 'tc.restored': 'Restored {a} from snapshot  +{p}',
  'tc.mdr': 'MDR team contained it', 'tc.breach': '{a} breached!', 'tc.falseCorr': 'No link — those alerts are unrelated',
  'tc.wrong': 'Wrong tool: {why}', 'tc.noSnap': 'No snapshot left — contain earlier!', 'tc.noMdr': 'MDR recharging',
  'wr.af': 'AF guards the entrance; this actor is already inside', 'wr.edr': 'EDR acts on the host, not this stage',
  'wr.ndr': 'NDR observes the network; it will not stop this', 'wr.iag': 'IAG watches the exit, not this stage',
  'wr.astor': 'aStor only restores at the ransomware stage', 'wr.mdr': 'MDR is the managed assist',
  'fm.t1': 'How to play', 'fm.t2': 'The products', 'fm.t3': 'Scoring', 'fm.limit': 'Limit',
  'fm.lead': 'Detect, confirm and contain each incident before it reaches ransomware.',
  'fm.p1': 'Sensors raise ALERTS. A lone alert is noise. A real incident only surfaces when 2 or more sensors fire on the SAME asset sharing one IOC tag.',
  'fm.p2': 'Select the matching alerts and press Correlate (XDR) to confirm. Correlating unrelated alerts costs points.',
  'fm.p3': 'A confirmed incident ADVANCES along the kill chain. Contain it with the one product whose real role stops that stage.',
  'fm.p4': 'Only aStor recovers at the ransomware stage, and snapshots are scarce — stop incidents early rather than relying on recovery.',
  'fm.note': 'Keys: 1-6 fire tools on the focused incident, C correlates your selection. A missed incident breaches silently.',
  'fm.prodlead': 'Each tool only works in its real role. Use the wrong one and the move is wasted.',
  'fm.scorelead': 'Score rewards catching incidents early and saving deep ones.',
  'fm.s1': 'Confirm an incident: more points the earlier (lower stage) you catch it.',
  'fm.s2': 'Contain an incident: more points the deeper it got (more damage averted).',
  'fm.s3': 'Combo builds on every correct confirm and contain (up to 5x).',
  'fm.s4': 'False correlation, wrong tool and breaches all cost you.',
  'ui.help': 'Manual', 'ui.resume': 'Resume', 'ui.paused': 'Paused',
};
const ZH = {
  'soc.title': '零号事件',
  'soc.tag': '你在实战 SOC 中操控深信服平台。单条告警是噪声——把相互印证的告警关联起来确认一起真实事件，再用其真实职责能遏制该阶段的那一个产品去处置。错过它，攻击链就会一路跑到勒索加密。',
  'soc.queue': '告警队列', 'soc.incidents': '活动事件',
  'soc.correlate': '关联', 'soc.sel': '已选 {n} 条', 'soc.xdr': 'XDR',
  'soc.noInc': '暂无已确认事件。盯住队列，通过关联把它们揪出来。',
  'soc.noAlerts': '传感器平静，保持警惕。',
  'soc.integrity': '防线', 'soc.time': '在线',
  'soc.over': 'SOC 失守', 'soc.overSub': '在线 {s} 秒后防线崩溃。你确认了 {c} 起事件，处置了 {k} 起。',
  'soc.confirmed': '已确认', 'soc.contained': '已处置', 'soc.breaches': '被攻陷',
  'stage.intrusion': '入侵', 'stage.foothold': '植入', 'stage.lateral': '横向', 'stage.exfil': '外泄', 'stage.ransom': '勒索',
  'role.AF': '边界', 'role.EDR': '终端', 'role.NDR': '横向', 'role.IAG': '出口', 'role.ASTOR': '恢复', 'role.MDR': '支援',
  'tool.AF': 'AF', 'tool.EDR': 'EDR', 'tool.NDR': 'NDR', 'tool.IAG': 'IAG', 'tool.ASTOR': 'aStor', 'tool.MDR': 'MDR',
  'tc.confirmed': '事件已确认  +{p}', 'tc.contained': '已处置 {a}  +{p}', 'tc.restored': '已从快照恢复 {a}  +{p}',
  'tc.mdr': 'MDR 团队已处置', 'tc.breach': '{a} 被攻陷！', 'tc.falseCorr': '无法关联——这些告警互不相关',
  'tc.wrong': '工具错误：{why}', 'tc.noSnap': '没有可用快照——请提前处置！', 'tc.noMdr': 'MDR 充能中',
  'wr.af': 'AF 只守入口；攻击者已在内部', 'wr.edr': 'EDR 作用于主机，不在此阶段',
  'wr.ndr': 'NDR 观测网络，无法在此处置', 'wr.iag': 'IAG 守的是出口，不在此阶段',
  'wr.astor': 'aStor 仅在勒索阶段用于恢复', 'wr.mdr': 'MDR 是托管支援',
  'fm.t1': '玩法', 'fm.t2': '产品', 'fm.t3': '计分', 'fm.limit': '局限',
  'fm.lead': '在每起事件到达勒索加密之前完成检测、确认与处置。',
  'fm.p1': '传感器产生告警。单条告警是噪声。只有当 2 个及以上传感器针对同一资产、且共享同一个 IOC 标记时，才会显现真实事件。',
  'fm.p2': '选中相互印证的告警并点击“关联（XDR）”确认。关联无关告警会扣分。',
  'fm.p3': '已确认事件会沿攻击链推进。用其真实职责能遏制该阶段的那一个产品去处置它。',
  'fm.p4': '只有 aStor 能在勒索阶段恢复，而快照稀缺——应尽早遏制事件，而非依赖恢复。',
  'fm.note': '快捷键：1-6 对聚焦事件释放工具，C 关联所选。被忽略的事件会悄无声息地造成攻陷。',
  'fm.prodlead': '每件工具只在其真实职责内有效。用错了，这一步就白费。',
  'fm.scorelead': '计分奖励尽早发现事件、以及挽救陷得更深的事件。',
  'fm.s1': '确认事件：发现得越早（阶段越低）得分越高。',
  'fm.s2': '处置事件：陷得越深（避免的损失越大）得分越高。',
  'fm.s3': '每次正确确认与处置累积连击（最高 5 倍）。',
  'fm.s4': '错误关联、用错工具与被攻陷都会扣分。',
  'ui.help': '手册', 'ui.resume': '继续', 'ui.paused': '已暂停',
};

const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const board = makeBoard({ lsKey: 'sentinel.soc.scores.v1', apiVar: '__SOC_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.soc.best';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [{ href: 'rush.html', label: 'Breach Rush' }, { href: 'td.html', label: 'Kill Chain' }, { href: 'index.html', label: 'Defend the Tower' }];

const CHARGE_TOOL = { ASTOR: true, MDR: true };
const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Incident Zero')}
    <div class="ar-stats">
      <div class="soc-integ" id="socInteg" title="${esc(t('soc.integrity'))}"></div>
      <div class="ar-combo" id="socCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="socScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="socBest">0</span></div>
      <button class="iconbtn" data-act="manual" title="${esc(t('ui.help'))}">?</button>
    </div>
  </div>
  <div class="soc-main">
    <section class="soc-panel soc-queue-p">
      <header class="soc-ph">
        <span class="soc-ph-t">${esc(t('soc.queue'))}</span>
        <button class="soc-corr" id="socCorr" disabled><b>${esc(t('soc.correlate'))}</b> <span class="soc-xdr">${esc(t('soc.xdr'))}</span> <span id="socSel"></span></button>
      </header>
      <ul class="soc-list soc-alerts" id="socAlerts"></ul>
      <div class="soc-empty" id="socAlertsEmpty">${esc(t('soc.noAlerts'))}</div>
    </section>
    <section class="soc-panel soc-inc-p">
      <header class="soc-ph"><span class="soc-ph-t">${esc(t('soc.incidents'))}</span></header>
      <ul class="soc-list soc-incs" id="socIncs"></ul>
      <div class="soc-empty" id="socIncsEmpty">${esc(t('soc.noInc'))}</div>
    </section>
  </div>
  <div class="soc-tools" id="socTools">
    ${TOOLS.map((id, i) => `<button class="soc-tool t-${id.toLowerCase()}" data-tool="${id}">
      <span class="soc-tool-k">${i + 1}</span>
      <span class="soc-tool-n">${esc(t('tool.' + id))}</span>
      <span class="soc-tool-r">${esc(t('role.' + id))}</span>
      ${CHARGE_TOOL[id] ? `<span class="soc-tool-ch" id="ch${id}"></span><i class="soc-tool-fill" id="fill${id}"></i>` : ''}
    </button>`).join('')}
  </div>
  <div class="ar-toasts" id="socToasts"></div>
  <div id="socOverlay"></div>
`;

const el = {
  integ: document.getElementById('socInteg'), combo: document.getElementById('socCombo'),
  score: document.getElementById('socScore'), best: document.getElementById('socBest'),
  alerts: document.getElementById('socAlerts'), alertsEmpty: document.getElementById('socAlertsEmpty'),
  incs: document.getElementById('socIncs'), incsEmpty: document.getElementById('socIncsEmpty'),
  corr: document.getElementById('socCorr'), sel: document.getElementById('socSel'),
  tools: document.getElementById('socTools'), toasts: document.getElementById('socToasts'),
  overlay: document.getElementById('socOverlay'),
};
const paintScore = painter();

const selected = new Set();
let focusedId = null;
let phase = 'start', lastSummary = null, lastResult = null, manualReturn = 'start';
const alertMap = new Map(), incMap = new Map();

const game = createSocGame({
  onState: s => {
    reconcileAlerts(el.alerts, s.alerts, selected, alertMap);
    // prune selection of expired alerts
    for (const id of [...selected]) if (!s.alerts.some(a => a.id === id)) selected.delete(id);
    const live = reconcileIncidents(el.incs, s.incidents, focusedId, incMap, t);
    if (focusedId && !s.incidents.some(i => i.id === focusedId && i.status === 'active')) focusedId = null;
    el.alertsEmpty.classList.toggle('hide', s.alerts.length > 0);
    el.incsEmpty.classList.toggle('hide', live > 0);
    updateCorr();
    paintHud(s.hud);
  },
  onToast: (key, kind, vars) => {
    const v = { ...vars };
    if (v.why) v.why = t('wr.' + v.why);
    toast(t('tc.' + key, v), kind);
  },
  onOver: summary => onGameOver(summary),
});

function paintHud(h) {
  paintScore(el.score, fmt(h.score));
  el.best.textContent = fmt(Math.max(h.best, getBest()));
  el.integ.innerHTML = Array.from({ length: START_INTEGRITY }, (_, i) => `<span class="soc-pip${i < h.integrity ? '' : ' out'}"></span>`).join('');
  el.combo.textContent = 'x' + h.mult;
  el.combo.classList.toggle('on', h.combo >= 4);
  setCharge('ASTOR', h.snap, h.snapMax, h.snapProg);
  setCharge('MDR', h.mdr, h.mdrMax, h.mdrProg);
}
function setCharge(id, n, max, prog) {
  const ch = document.getElementById('ch' + id), fill = document.getElementById('fill' + id);
  const btn = el.tools.querySelector(`[data-tool="${id}"]`);
  if (ch) ch.textContent = n;
  if (fill) fill.style.width = (n >= max ? 100 : prog * 100) + '%';
  if (btn) btn.classList.toggle('empty', n <= 0);
}
function updateCorr() {
  el.corr.disabled = selected.size < 2;
  el.sel.textContent = selected.size ? '· ' + t('soc.sel', { n: selected.size }) : '';
}

function toast(msg, kind = '') {
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim(); n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), 1500);
}

// ---------- interactions ----------
el.alerts.addEventListener('click', e => {
  const li = e.target.closest('.soc-alert'); if (!li) return;
  const id = +li.dataset.id;
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  li.classList.toggle('sel', selected.has(id));
  updateCorr();
});
el.corr.addEventListener('click', () => { game.correlate([...selected]); selected.clear(); updateCorr(); });
el.incs.addEventListener('click', e => {
  const li = e.target.closest('.soc-inc'); if (!li || li.classList.contains('done')) return;
  focusedId = +li.dataset.id;
  for (const node of el.incs.children) node.classList.toggle('foc', node === li);
});
el.tools.addEventListener('click', e => {
  const btn = e.target.closest('.soc-tool'); if (!btn) return;
  fireTool(btn.dataset.tool);
});

function fireTool(tool) {
  let target = focusedId;
  if (!target) {
    // auto-focus the most urgent active incident
    const live = game.state.incidents.filter(i => i.status === 'active');
    if (!live.length) return;
    target = live.reduce((a, b) => (a.stageTimer <= b.stageTimer ? a : b)).id;
    focusedId = target;
  }
  game.contain(target, tool);
}

// ---------- screens ----------
async function showStart() {
  phase = 'start';
  const b = await board.fetchBoard();
  el.best.textContent = fmt(getBest());
  el.integ.innerHTML = Array.from({ length: START_INTEGRITY }, () => '<span class="soc-pip"></span>').join('');
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card soc-card">
        ${brandHTML('Incident Zero')}
        <h1 class="ar-title">Incident <span class="em">Zero</span></h1>
        <p class="ar-tag">${esc(t('soc.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <div class="ar-row" style="margin-top:14px">
          <button class="btn ghost" data-act="manual">${esc(t('ui.how'))}</button>
          <button class="btn primary" data-act="play" style="flex:2">${esc(t('ui.play'))}</button>
        </div>
        ${boardBlock(b)}
        ${footerHTML(t, { muted: isMuted(), links: LINKS })}
      </div>
    </div>`;
}

function boardBlock(b, meId) {
  return `<div class="ar-lb">
    <div class="ar-lb-h"><span class="t">${esc(t('ui.board'))}</span>
      <span class="mode ${b.mode === 'world' ? 'world' : ''}">${esc(b.mode === 'world' ? t('ui.world') : t('ui.local'))}</span></div>
    <ol class="lb-rows">${boardListHTML(b.rows, { empty: t('ui.empty'), meId })}</ol>
  </div>`;
}

function showManual() {
  const back = game.phase === 'play' ? 'play' : 'start';
  manualReturn = back;
  if (back === 'play') game.pause();
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card fm-card">
        <div class="fm-head">${brandHTML('Incident Zero')}<button class="guide-x" data-act="closeManual">&times;</button></div>
        ${manualHTML(t, i18n.getLang())}
        <button class="btn primary block" data-act="closeManual">${back === 'play' ? esc(t('ui.resume')) : esc(t('ui.back'))}</button>
      </div>
    </div>`;
}
function closeManual() {
  el.overlay.innerHTML = '';
  if (manualReturn === 'play') { game.resume(); phase = 'play'; }
  else showStart();
}

async function onGameOver(summary) {
  phase = 'over'; lastSummary = summary; lastResult = null;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.score, note: summary.confirmed + 'c' });
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Incident Zero')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('soc.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}</div>
          <div class="sub">${esc(t('soc.overSub', { s: summary.elapsed, c: summary.confirmed, k: summary.contained }))}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('soc.confirmed'))}</span><span class="v">${summary.confirmed}</span></div>
          <div class="m"><span class="k">${esc(t('soc.contained'))}</span><span class="v">${summary.contained}</span></div>
          <div class="m"><span class="k">${esc(t('soc.breaches'))}</span><span class="v">${summary.breaches}</span></div>
        </div>
        ${result ? boardBlock(result, meId) : ''}
        <div class="ar-row">
          <button class="btn ghost" data-act="quit">${esc(t('ui.quit'))}</button>
          <button class="btn primary" data-act="again">${esc(t('ui.again'))}</button>
        </div>
        <button class="linklike" data-act="share" style="display:block;margin:10px auto 0;text-align:center">${esc(t('ui.share'))}</button>
        ${footerHTML(t, { muted: isMuted(), links: LINKS })}
      </div>
    </div>`;
}

function play() {
  const name = (document.getElementById('nameIn')?.value || '').trim();
  if (name) saveName(name);
  resumeAudio();
  el.overlay.innerHTML = '';
  selected.clear(); focusedId = null; alertMap.clear(); incMap.clear();
  el.alerts.innerHTML = ''; el.incs.innerHTML = '';
  phase = 'play';
  game.setBest(getBest());
  game.start();
}

// ---------- events ----------
el.overlay.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const tab = e.target.closest('.fm-tab')?.dataset.tab;
  if (tab) { switchTab(tab); return; }
  if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') { game.stop(); showStart(); }
  else if (act === 'manual') showManual();
  else if (act === 'closeManual') closeManual();
  else if (act === 'lang') { i18n.toggleLang(); relabelChrome(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

function switchTab(tab) {
  for (const b of el.overlay.querySelectorAll('.fm-tab')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const b of el.overlay.querySelectorAll('.fm-body')) b.classList.toggle('hide', b.dataset.tab !== tab);
}

app.querySelector('.ar-top').addEventListener('click', e => {
  if (e.target.closest('[data-act="manual"]')) showManual();
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (el.overlay.querySelector('.fm-card')) closeManual(); return; }
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { if (phase === 'play' || phase === 'start') showManual(); return; }
  if (phase !== 'play') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= TOOLS.length) { e.preventDefault(); fireTool(TOOLS[n - 1]); return; }
  if (e.key.toLowerCase() === 'c' || e.key === 'Enter') { if (selected.size >= 2) { game.correlate([...selected]); selected.clear(); updateCorr(); } }
  else if (e.key.toLowerCase() === 'm') { setMuted(!isMuted()); }
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Incident Zero — ${fmt(lastSummary.score)} pts (${lastSummary.confirmed} incidents confirmed)`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

function relabelChrome() {
  const q = (sel, txt) => { const n = app.querySelector(sel); if (n) n.textContent = txt; };
  q('.soc-queue-p .soc-ph-t', t('soc.queue'));
  q('.soc-inc-p .soc-ph-t', t('soc.incidents'));
  q('#socCorr b', t('soc.correlate'));
  el.alertsEmpty.textContent = t('soc.noAlerts');
  el.incsEmpty.textContent = t('soc.noInc');
  const ks = app.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('ui.score');
  if (ks[1]) ks[1].textContent = t('ui.best');
  for (const btn of el.tools.querySelectorAll('.soc-tool')) {
    const id = btn.dataset.tool;
    btn.querySelector('.soc-tool-n').textContent = t('tool.' + id);
    btn.querySelector('.soc-tool-r').textContent = t('role.' + id);
  }
  updateCorr();
}

function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__soc = { game, board, i18n, STAGES };
