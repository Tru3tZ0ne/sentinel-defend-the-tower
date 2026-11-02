// Last Stand orchestrator: canvas wiring, the vertical-shooter HUD (base integrity,
// XP/level bar, a weapon chip + loadout rail built from the product logos), the
// level-up CHOICE CARDS (where you pick which Sangfor product upgrades your weapon,
// and which dimension it grows), a Product Codex, the leaderboard, and EN / 中文.

const { createStandGame, ACCENT } = await import(
  document.body.dataset.art === 'sangfor' ? './engine.js?art=stand-sangfor-visuals-v2&campaign=command-finale-v1'
  : document.body.dataset.art === 'combined' ? './engine.js?art=stand-combined-v1&campaign=command-finale-v1'
  : './engine.js?campaign=command-finale-v1');
import { WEAPONS, WEAPON_ORDER, START_BASE, ABILITIES, ABILITY_ORDER, MISSION_SECONDS, recommendedUpgrade } from './model.js?campaign=command-finale-v1';
import { PRODUCTS } from '../data/products.js';
import { ICONS } from '../ui/icons.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard, rankOf } from '../arcade/board.js';
import { brandHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const ICON_KEY = { HCI: 'network', EDR: 'edr', NDR: 'ndr', AF: 'af', IAG: 'iag', XDR: 'xdr', ASTOR: 'astor', MDR: 'mdr' };
const CAP_NAME = { HCI: 'HCI Cloud', EDR: 'Endpoint Secure', NDR: 'Cyber Command', AF: 'NGAF', IAG: 'IAG Gateway', XDR: 'XDR', ASTOR: 'aStor', MDR: 'MDR' };
const ICO = id => ICONS[ICON_KEY[id]] || '';
// official Sangfor product artwork for the HUD (same marks the battlefield uses)
const MARK = id => { const m = PRODUCT_MARKS[id]; return m ? `<img class="st-mark" src="assets/brand/products/sangfor-${m[0]}" alt="${esc(CAP_NAME[id] || id)}" loading="lazy" />` : ICO(id); };

const EN = {
  'st.title': 'Last Stand',
  'st.base': 'Base integrity',
  'st.lv': 'LV',
  'st.weapon': 'Weapon',
  'st.levelup': 'Level {n}',
  'st.choose': 'Choose a product upgrade',
  'st.codex': 'Product codex',
  'st.loadout': 'Weapon build',
  'st.kills': 'Threats cleared',
  'st.streak': 'Best streak',
  'st.held': 'Survived',
  'st.reached': 'Level reached',
  'st.real': 'Real job',
  'st.boost': 'Weapon upgrade',
  'st.limit': 'Limitation',
  'st.codexSub': 'Each product upgrades the weapon on the dimension it owns in real life - that is the whole point.',
  'st.none': 'Base weapon - no products yet',
  'st.max': 'MAX',
  'st.to': 'Lv {a} -> {b}',
  'st.new': 'NEW',
  // what each product DEPLOYS (card dimension line)
  'dim.EDR': 'Endpoint turret',
  'dim.MDR': '24/7 teammate',
  'dim.AF': 'Perimeter barrier',
  'dim.IAG': 'Egress slow band',
  'dim.HCI': 'Compute core (fire rate)',
  'dim.ASTOR': 'Snapshot vault',
  // what the deployable does, in game terms (card body + codex "weapon upgrade")
  'b.AF': 'Raises an NGAF barrier in front that blocks a cluster of threats and weakens any that break through.',
  'b.IAG': 'Projects an IAG checkpoint band across the field - threats crossing it crawl.',
  'b.HCI': 'An HCI compute core speeds up the fire rate of every unit you have.',
  'b.ASTOR': 'An aStor snapshot vault shields your base from a hit and restores integrity.',
  't.boss_ransom': 'BOSS - Ransomware brute inbound',
  't.pressure': 'Threat escalation - tougher waves incoming',
  't.boss_botnet': 'BOSS - Botnet controller inbound (it spews bots)',
  't.boss_wraith': 'BOSS - Zero-day wraith inbound (cloaked + fast)',
  't.boss_siege': 'APEX BOSS - APT Siege Engine inbound',
  'boss.ransom': 'Ransomware Brute',
  'boss.botnet': 'Botnet Controller',
  'boss.wraith': 'Zero-Day Wraith',
  'boss.siege': 'APT Siege Engine',
  't.exfil': 'Data exfiltrated! An exfil runner slipped through',
  't.absorb': 'aStor snapshot absorbed the hit',
  't.afDown': 'NGAF barrier breached - rebuilding',
  't.xdrIdle': 'XDR beam has no sensors to correlate - add EDR / NDR / NGAF',
  't.irOn': 'Incident Response - breach contained',
  't.ptOn': 'Penetration Testing - pen-test team deployed',
  't.rtOn': 'Red Team Assessment - attack teams storming in',
  't.corrOn': 'XDR correlation online - kills now chain across your sensors',
  'st.corr': 'CORR',
  // active operator skills
  'st.skills': 'Operator skills (service engagements)',
  'ab.ir': 'Incident Response',
  'ab.pt': 'Penetration Testing',
  'ab.rt': 'Red Team Assessment',
  'ab.ready': 'READY',
  'abd.ir': 'Contain the active breach: heavy damage to every threat on screen, restore base integrity, and brace for the next hit. [Q]',
  'abd.pt': 'Call in a small, sharp pen-test team - a few extra operatives (piercing fire) join you for a short run. [E]',
  'abd.rt': 'Launch a red-team assessment: a large surge of temporary attack teams storms the field and fires alongside you. [R]',
  'g.HCI': 'Elastic, pooled cloud compute (HCI): raw capacity and throughput for everything you run.',
  'l.HCI': 'Capacity, not security on its own - it makes everything else run harder and faster.',
};
const ZH = {
  'st.title': '最后防线',
  'st.base': '基地完整度',
  'st.lv': '等级',
  'st.weapon': '武器',
  'st.levelup': '第 {n} 级',
  'st.choose': '选择一项产品强化',
  'st.codex': '产品图鉴',
  'st.loadout': '武器配装',
  'st.kills': '清除威胁',
  'st.streak': '最高连击',
  'st.held': '存活',
  'st.reached': '达到等级',
  'st.real': '真实职责',
  'st.boost': '武器强化',
  'st.limit': '局限',
  'st.codexSub': '每件产品强化的正是它在现实中负责的那个维度——这正是重点。',
  'st.none': '基础武器——尚无产品',
  'st.max': '满级',
  'st.to': '{a} → {b} 级',
  'st.new': '新',
  'dim.EDR': '终端炮塔',
  'dim.MDR': '7×24 队友',
  'dim.AF': '边界屏障',
  'dim.IAG': '出口减速带',
  'dim.HCI': '算力核心（射速）',
  'dim.ASTOR': '快照保险库',
  'b.AF': '在前方升起一道 NGAF 屏障，拦截一群威胁，并削弱任何突破它的敌人。',
  'b.IAG': '在战场上投射一道 IAG 检查带——穿越它的威胁会变得极慢。',
  'b.HCI': '一座 HCI 算力核心，提升你所有单位的射速。',
  'b.ASTOR': '一座 aStor 快照保险库替基地挡下一击，并恢复完整度。',
  't.boss_ransom': 'BOSS——勒索软件巨兽来袭',
  't.pressure': '威胁升级——更强的敌人正在逼近',
  't.boss_botnet': 'BOSS——僵尸网络控制器来袭（不断释放肉鸡）',
  't.boss_wraith': 'BOSS——零日幽灵来袭（隐身且高速）',
  't.boss_siege': '终极 BOSS——APT 攻城引擎来袭',
  'boss.ransom': '勒索软件巨兽',
  'boss.botnet': '僵尸网络控制器',
  'boss.wraith': '零日幽灵',
  'boss.siege': 'APT 攻城引擎',
  't.exfil': '数据被窃取！一个外泄跑者溜了过去',
  't.absorb': 'aStor 快照挡下了这一击',
  't.afDown': 'NGAF 屏障被攻破——重建中',
  't.xdrIdle': 'XDR 光束没有可关联的传感器——去加 EDR / NDR / NGAF',
  't.irOn': '应急响应——已遏制入侵',
  't.ptOn': '渗透测试——渗透小队已入场',
  't.rtOn': '红队评估——进攻小队大举压上',
  't.corrOn': 'XDR 关联已上线——击杀将在传感器之间链式触发',
  'st.corr': '关联',
  // 主动操作员技能
  'st.skills': '操作员技能（服务项目）',
  'ab.ir': '应急响应',
  'ab.pt': '渗透测试',
  'ab.rt': '红队评估',
  'ab.ready': '就绪',
  'abd.ir': '遏制正在发生的入侵：对屏幕上每个威胁造成大量伤害，恢复基地完整度，并抵御下一次攻击。[Q]',
  'abd.pt': '召来一支精干的渗透测试小队——数名额外队员（穿透射击）短时间内与你并肩作战。[E]',
  'abd.rt': '发起红队评估：大批临时进攻小队涌入战场，与你一同开火。[R]',
  'g.HCI': '弹性、池化的云计算（HCI）：为你运行的一切提供算力与吞吐。',
  'l.HCI': '它本身是算力而非安全——让其它一切跑得更猛、更快。',
};

const equipmentPreview = document.body.dataset.art === 'sangfor';
const combined = document.body.dataset.art === 'combined';   // sculpted models under the cinematic stage
const useArt = equipmentPreview || combined;
if (useArt) {
  Object.assign(EN, {
    'st.codexSub': 'Product roles inspire these arcade mechanics. Equipment models are game concepts; they are not commercial appliance designs.',
    'st.inspect': 'Inspect equipment in 3D',
  });
  Object.assign(ZH, {
    'st.codexSub': '产品职责启发游戏机制。装备是原创游戏概念造型，不代表商用设备外观。',
    'st.inspect': '近距离查看 3D 装备',
  });
}
// Shared event campaign instructions for both visual entries.
Object.assign(EN, {
  'ui.score': 'Remaining HP', 'ui.best': 'Best HP', 'ui.board': 'Integrity ranking',
  'st.time': 'Remaining', 'st.pace': 'Allied support helps finish bosses; emergency cover preserves the final HP. Ranking uses remaining HP only; ties share a rank.',
  'st.tag': '120 seconds. Three bosses. One Sangfor defense network. Start with 10,000 HP and protect as much as you can.',
  'st.h1': 'Move with WASD / arrows, or drag along the lower field. Fire is automatic. Cyber Command enables tracking for your squad.',
  'st.h2': 'Choose an upgrade with 1 / 2 / 3 or tap a card. Combat continues; after 3 seconds a recommended upgrade deploys automatically.',
  'st.h3': 'Cyber Command fires cross-field laser strips and boosts MDR. Devices feed energy into XDR before its final laser. Use Q / E / R support against bosses arriving at 25 / 60 / 95 seconds.',
  'st.chooseSub': 'Combat continues · automatic recommendation in',
  'st.over': 'Defense complete', 'st.overSub': 'All {b}/3 bosses cleared in {s}s. {k} threats stopped. Rank is determined by remaining HP.',
  'st.aid': 'Allied boss support used: {n}.', 'st.cover': 'Emergency cover protected your final HP.',
  't.xdrLink': 'Devices linked — charging XDR',
  'st.tracking': 'CC tracking', 'st.charging': 'XDR linking', 'st.firing': 'XDR firing', 'st.ready': 'XDR ready',
  'st.auto': 'AUTO',
  'st.bosses': 'Bosses', 't.allied': 'Allied support engaging the boss', 't.cover': 'Emergency cover active — protect your remaining HP',
  'dim.NDR': 'Side lasers + squad tracking', 'dim.XDR': 'Link → charge → laser',
  'b.EDR': 'Deploys endpoint turrets. Cyber Command turns their shots into tracking fire; later levels add turrets and damage.',
  'b.MDR': 'Deploys an MDR teammate. Cyber Command boosts its damage and enables tracking; upgrades increase damage and rate.',
  'b.NDR': 'Cyber Command fires horizontal lasers from both sides, reveals cloaked threats, enables squad tracking and boosts MDR damage by 10% per level.',
  'b.XDR': 'Every deployed device links into XDR and sends energy to its hub. After charging, XDR fires the final targeted laser. More sensors and connected products increase damage.',
});
Object.assign(ZH, {
  'ui.score': '剩余血量', 'ui.best': '最佳血量', 'ui.board': '血量排行榜',
  'st.time': '倒计时', 'st.pace': '盟军会协助清除 Boss；应急援护保留最后 1 点血量。仅按剩余血量排名，同血量并列。',
  'st.tag': '120 秒，三大 Boss，一张深信服协同防御网。初始 10,000 血量，守住越多，排名越高。',
  'st.h1': '使用 WASD / 方向键移动，或在战场下方拖动。小队自动开火；Cyber Command 可让小队武器追踪敌人。',
  'st.h2': '按 1 / 2 / 3 或点击卡片选择强化，战斗持续进行。3 秒内未选择将自动部署推荐装备。',
  'st.h3': 'Cyber Command 从两侧发射横向条状激光，强化 MDR；各设备向 XDR 汇聚能量后，由 XDR 发射主激光。Boss 在 25 / 60 / 95 秒登场，按 Q / E / R 呼叫支援。',
  'st.chooseSub': '战斗继续 · 自动推荐倒计时',
  'st.over': '防守成功', 'st.overSub': '{s} 秒内清除全部 {b}/3 个 Boss，拦截 {k} 个威胁。按剩余血量排名。',
  'st.aid': '盟军协助过 {n} 个 Boss。', 'st.cover': '应急援护保护了最后的血量。',
  't.xdrLink': '设备联动——XDR 蓄能中',
  'st.tracking': 'CC 全队追踪', 'st.charging': 'XDR 联动蓄能', 'st.firing': 'XDR 主激光', 'st.ready': 'XDR 就绪',
  'st.auto': '推荐',
  'st.bosses': 'Boss', 't.allied': '盟军支援正在攻击 Boss', 't.cover': '应急援护已启动——守住剩余血量',
  'dim.NDR': '侧向激光 + 全队追踪', 'dim.XDR': '联动 → 蓄能 → 激光',
  'b.EDR': '部署终端炮塔；Cyber Command 使炮塔子弹追踪敌人，升级可增加炮塔数量和伤害。',
  'b.MDR': '部署 MDR 队友；Cyber Command 提升其伤害并赋予追踪能力，升级增加火力和射速。',
  'b.NDR': 'Cyber Command 从左右两侧发射横向条状激光，揭露隐身威胁，赋予全队追踪能力，每级额外提升 MDR 伤害 10%。',
  'b.XDR': '所有已部署设备连接 XDR 并向中心汇聚能量；蓄能后由 XDR 发射锁定目标的主激光。传感器和联动产品越多，伤害越高。',
});
const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const lang = () => i18n.getLang();
const board = makeBoard({ lsKey: 'sentinel.stand.health.scores.v1', apiVar: '__STAND_HEALTH_API' });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.stand.health.best.v1';
const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const saveBest = b => { try { localStorage.setItem(BEST_KEY, String(b)); } catch { /* ignore */ } };

const LINKS = [
  ...(equipmentPreview ? [{ href: 'stand.html', label: 'Original Last Stand' }] : []),
  { href: 'vector.html', label: 'Threat Vector' },
  { href: 'line.html', label: 'Breach Line' },
  { href: 'index.html', label: 'Defend the Tower' },
];

const app = document.getElementById('app');
app.innerHTML = `
  <div class="ar-top">
    ${brandHTML('Last Stand')}
    <div class="ar-stats">
      <div class="ar-combo" id="stCombo">x1</div>
      <div class="ar-stat"><span class="k">${esc(t('st.time'))}</span><span class="v" id="stTime">0s</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.score'))}</span><span class="v good" id="stScore">0</span></div>
      <div class="ar-stat"><span class="k">${esc(t('ui.best'))}</span><span class="v" id="stBest">0</span></div>
    </div>
  </div>
  <div class="ar-field">
    <canvas id="stCanvas"></canvas>
    <div class="st-topbar">
      <div class="st-lvbadge" id="stLvTxt">${esc(t('st.lv'))} 1</div>
      <div class="st-xp"><i id="stXpFill"></i></div>
      <div class="st-weap" id="stWeap"></div>
    </div>
    <div class="st-boss" id="stBoss" hidden>
      <div class="st-boss-row"><span class="st-boss-name" id="stBossName"></span><span class="st-boss-hp" id="stBossHp"></span></div>
      <div class="st-boss-bar"><i id="stBossFill"></i></div>
    </div>
    <div class="st-rail" id="stRail"></div>
    <div class="st-network" id="stNetwork"></div>
    <div class="st-abil" id="stAbil"></div>
    <div class="st-base"><i id="stBaseFill"></i><span class="st-base-txt" id="stBaseTxt"></span></div>
  </div>
  <div class="ar-toasts" id="stToasts"></div>
  <div id="stOverlay"></div>
`;

const el = {
  canvas: document.getElementById('stCanvas'),
  combo: document.getElementById('stCombo'),
  time: document.getElementById('stTime'),
  score: document.getElementById('stScore'),
  best: document.getElementById('stBest'),
  xpFill: document.getElementById('stXpFill'),
  lvTxt: document.getElementById('stLvTxt'),
  weap: document.getElementById('stWeap'),
  rail: document.getElementById('stRail'),
  baseFill: document.getElementById('stBaseFill'),
  baseTxt: document.getElementById('stBaseTxt'),
  abil: document.getElementById('stAbil'),
  boss: document.getElementById('stBoss'),
  bossName: document.getElementById('stBossName'),
  bossHp: document.getElementById('stBossHp'),
  bossFill: document.getElementById('stBossFill'),
  toasts: document.getElementById('stToasts'),
  overlay: document.getElementById('stOverlay'),
};

// ---------- active operator skills (bottom bar) ----------
const ABIL_CAP = { ir: 'NDR', pt: 'IAG', rt: 'EDR' };   // accent reuse
const ABIL_KEY = { ir: 'Q', pt: 'E', rt: 'R' };
const abilBtns = {};
function buildAbilBar() {
  el.abil.innerHTML = ABILITY_ORDER.map(id => `
    <button class="st-ab cap-${ABIL_CAP[id]}" data-ab="${id}" type="button"
      title="${esc(t('ab.' + id))} - ${esc(t('abd.' + id))}" aria-label="${esc(t('ab.' + id))}">
      <span class="st-ab-cd"></span>
      <span class="st-ab-key">${ABIL_KEY[id]}</span>
      <span class="st-ab-code">${id.toUpperCase()}</span>
      <span class="st-ab-name">${esc(t('ab.' + id))}</span>
      <span class="st-ab-timer"></span>
    </button>`).join('');
  for (const id of ABILITY_ORDER) {
    const b = el.abil.querySelector(`[data-ab="${id}"]`);
    abilBtns[id] = { btn: b, cd: b.querySelector('.st-ab-cd'), timer: b.querySelector('.st-ab-timer') };
    b.addEventListener('click', () => { if (phase === 'play') game.useAbility(id); });
  }
}
function updateBossBar(boss) {
  if (!el.boss) return;
  if (!boss) { if (!el.boss.hidden) el.boss.hidden = true; return; }
  el.boss.hidden = false;
  el.boss.classList.toggle('mega', !!boss.mega);
  if (boss.color) el.boss.style.setProperty('--bcol', boss.color);
  el.bossName.textContent = t('boss.' + boss.type) || t('boss.ransom');
  el.bossHp.textContent = `${fmt(boss.hp)} / ${fmt(boss.maxhp)}`;
  el.bossFill.style.width = Math.max(0, Math.min(100, boss.frac * 100)) + '%';
}
function updateAbilBar(abilities) {
  if (!abilities) return;
  for (const id of ABILITY_ORDER) {
    const a = abilities[id], ui = abilBtns[id]; if (!a || !ui) continue;
    const pct = a.ready ? 0 : Math.max(0, Math.min(100, a.cd / a.cdMax * 100));
    ui.cd.style.height = pct + '%';
    ui.btn.classList.toggle('ready', a.ready);
    ui.btn.classList.toggle('active', !!a.active);
    ui.timer.textContent = a.ready ? '' : Math.ceil(a.cd) + 's';
  }
}
const paintScore = painter();
const paintWeap = painter();
const paintRail = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const artModule = useArt
  ? await import('./sangfor-art.js?art=v3') : null;
const game = createStandGame(el.canvas, {
  artFactory: artModule?.createSangforArt,
  deckTexture: artModule?.createDeckTexture,
  atmosphere: combined,
  onHud: h => {
    paintScore(el.score, fmt(h.score));
    el.best.textContent = fmt(Math.max(h.best, getBest()));
    el.time.textContent = Math.max(0, MISSION_SECONDS - h.elapsed) + 's';
    const offerTimer = document.getElementById('stOfferTimer');
    if (offerTimer) offerTimer.textContent = Math.max(0, Math.ceil(h.offerLeft)) + 's';
    el.combo.textContent = `${t('st.bosses')} ${h.bossesKilled}/3`;
    el.combo.classList.toggle('on', h.combo >= 10);
    el.xpFill.style.width = Math.max(0, Math.min(100, h.xp / h.xpNeed * 100)) + '%';
    el.lvTxt.textContent = `${t('st.lv')} ${h.level}`;
    const bf = Math.max(0, Math.min(100, h.base / h.baseMax * 100));
    el.baseFill.style.width = bf + '%';
    el.baseFill.className = bf > 50 ? 'ok' : bf > 25 ? 'warn' : 'bad';
    el.baseTxt.textContent = `${fmt(h.base)} / ${fmt(START_BASE)}${h.emergencyCover ? ' · 🛡' : ''}`;
    el.baseTxt.title = h.emergencyCover ? t('st.cover') : t('st.base');
    paintWeap(el.weap, weapHTML(h));
    paintRail(el.rail, railHTML(h.levels));
    updateAbilBar(h.abilities);
    updateBossBar(h.boss);
    document.getElementById('stNetwork').textContent = `${h.tracking ? t('st.tracking') + ' · ' : ''}${t('st.' + h.linkPhase)}`;
  },
  onToast: (key, kind) => toast(t('t.' + key), kind),
  onLevelUp: (choices, level) => showLevelUp(choices, level),
  onOver: summary => onGameOver(summary),
});

function weapHTML(h) {
  const id = h.dom;
  if (!id) return `<span class="st-weap-ico cap-XDR">${MARK('XDR')}</span><span class="st-weap-lv"><b>${esc(t('st.weapon'))}</b><span>T0</span></span>`;
  const lvl = h.levels[id] || 0;
  const corr = h.corr > 0 ? ` · <em class="st-corr-in">${esc(t('st.corr'))}&times;${h.corr}</em>` : '';
  return `<span class="st-weap-ico cap-${id}">${MARK(id)}</span>` +
    `<span class="st-weap-lv"><b>${esc(CAP_NAME[id])}</b><span>Lv${lvl} · T${h.tier}${corr}</span></span>`;
}
function railHTML(levels) {
  const ids = WEAPON_ORDER.filter(id => (levels[id] || 0) > 0);
  if (!ids.length) return '';
  return ids.map(id => {
    const lv = levels[id] || 0, max = WEAPONS[id].max;
    const dots = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    return `<span class="st-rail-item cap-${id}" title="${esc(CAP_NAME[id])} - ${esc(t('dim.' + id))}">
      <span class="st-rail-ico">${MARK(id)}</span><span class="st-rail-dots">${dots}</span></span>`;
  }).join('');
}

function toast(msg, kind = '') {
  if (!msg) return;
  const n = document.createElement('div');
  n.className = `ar-toast ${kind}`.trim();
  n.textContent = msg;
  el.toasts.appendChild(n);
  setTimeout(() => n.remove(), 1500);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
}

// ---------- level-up cards (the product-integrated moment) ----------
function cardHTML(ch, index, recommended) {
  const id = ch.id, isNew = ch.toLevel === 1, maxed = ch.toLevel >= ch.max;
  return `<button class="st-card cap-${id}${recommended ? ' recommended' : ''}" data-up="${id}" title="${esc(t('b.' + id))}">
    <span class="st-card-key">${index + 1}${recommended ? ' · ' + esc(t('st.auto')) : ''}</span>
    ${equipmentPreview ? `<img class="st-equipment-preview" src="assets/stand-sangfor/${id.toLowerCase()}.webp?art=v2" alt="" />` : ''}
    <span class="st-card-top">
      <span class="st-card-ico">${MARK(id)}</span>
      ${isNew ? `<span class="st-card-tag">${esc(t('st.new'))}</span>` : `<span class="st-card-tag lv">${esc(t('st.to', { a: ch.toLevel - 1, b: ch.toLevel }))}${maxed ? ' · ' + esc(t('st.max')) : ''}</span>`}
    </span>
    <span class="st-card-name">${esc(CAP_NAME[id])}</span>
    <span class="st-card-dim">${esc(t('dim.' + id))}</span>
    <span class="st-card-dd">${esc(t('b.' + id))}</span>
  </button>`;
}
function showLevelUp(choices, level) {
  document.getElementById('stLevelUp')?.remove();
  if (!choices.length) return;
  el.overlay.insertAdjacentHTML('beforeend', `
    <section class="st-upgrade-dock" id="stLevelUp" aria-label="${esc(t('st.choose'))}">
      <div class="st-offer-header"><b>${esc(t('st.levelup', { n: level }))}</b>
        <span>${esc(t('st.chooseSub'))} <strong id="stOfferTimer">3s</strong></span></div>
      <div class="st-cards">${choices.map((ch, index) => cardHTML(ch, index, ch.id === recommendedUpgrade(choices, game.state.levels))).join('')}</div>
    </section>`);
}
function chooseUpgrade(id) { game.chooseUpgrade(id); }

// ---------- screens ----------
async function showStart() {
  phase = 'start'; game.stop();
  const b = await board.fetchBoard();
  if (phase !== 'start') return;
  el.best.textContent = fmt(getBest());
  resetHud();
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card st-start-card">
        ${equipmentPreview ? `<img class="st-art-hero" src="assets/stand-sangfor/equipment-preview.webp?art=v2" alt="" />` : ''}
        ${brandHTML('Last Stand')}
        <h1 class="ar-title">Last <span class="em">Stand</span></h1>
        <p class="ar-tag">${esc(t('st.tag'))}</p>
        <p class="ar-field-label">${esc(t('ui.name'))}</p>
        <input class="ar-name" id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(getName())}" />
        <ol class="ar-how">
          <li><span class="n">1</span><span>${esc(t('st.h1'))}</span></li>
          <li><span class="n">2</span><span>${esc(t('st.h2'))}</span></li>
          <li><span class="n">3</span><span>${esc(t('st.h3'))} ${esc(t('st.pace'))}</span></li>
        </ol>
        <div class="ar-row">
          <button class="btn ghost" data-act="codex">${esc(t('st.codex'))}</button>
          <button class="btn primary" data-act="play">${esc(t('ui.play'))}</button>
        </div>
        ${artModule ? `<a class="st-inspect-link" href="./stand-showroom.html">${esc(t('st.inspect'))} &rarr;</a>` : ''}
        ${boardBlock(b)}
        ${footerHTML(t, { muted: isMuted(), links: LINKS })}
      </div>
    </div>`;
}

function healthRowsHTML(rows, meId) {
  if (!rows?.length) return `<li class="lb-empty">${esc(t('ui.empty'))}</li>`;
  return rows.map(r => `<li class="lb-row${r.id === meId ? ' me' : ''}"><span class="lb-rank">${rankOf(rows, r.score)}</span><span class="lb-name">${esc(r.name)}</span><span class="lb-score">${fmt(r.score)} HP</span></li>`).join('');
}
function boardBlock(b, meId) {
  return `<div class="ar-lb">
    <div class="ar-lb-h"><span class="t">${esc(t('ui.board'))}</span>
      <span class="mode ${b.mode === 'world' ? 'world' : ''}">${esc(b.mode === 'world' ? t('ui.world') : t('ui.local'))}</span></div>
    <ol class="lb-rows">${healthRowsHTML(b.rows, meId)}</ol>
  </div>`;
}

function codexRows() {
  const L = lang();
  return WEAPON_ORDER.map(id => {
    const p = PRODUCTS[id];
    const real = p ? p.capability[L] : t('g.' + id);
    const lim = p ? p.limitation[L] : t('l.' + id);
    const name = p ? p.shortName : CAP_NAME[id];
    return `<div class="vc-cx cap-${id}">
      <div class="vc-cx-h"><span class="st-cx-ico">${MARK(id)}</span><b>${esc(name)}</b><span class="st-cx-dim">${esc(t('dim.' + id))}</span></div>
      <div class="vc-cx-row"><span class="vc-cx-k">${esc(t('st.real'))}</span><span>${esc(real)}</span></div>
      <div class="vc-cx-row boost"><span class="vc-cx-k">${esc(t('st.boost'))}</span><span>${esc(t('b.' + id))}</span></div>
      <div class="vc-cx-row lim"><span class="vc-cx-k">${esc(t('st.limit'))}</span><span>${esc(lim)}</span></div>
    </div>`;
  }).join('');
}
function showCodex() {
  el.overlay.insertAdjacentHTML('beforeend', `
    <div class="ar-overlay" id="stCodex">
      <div class="ar-card wide">
        ${brandHTML('Product codex')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('st.codex'))}</h1>
        <p class="ar-tag" style="margin-bottom:12px">${esc(t('st.codexSub'))}</p>
        <div class="vc-cx-list">${codexRows()}</div>
        <button class="btn primary block" data-act="closeCodex" style="margin-top:14px">${esc(t('ui.back'))}</button>
      </div>
    </div>`);
}

async function onGameOver(summary) {
  phase = 'over'; lastSummary = summary; lastResult = null;
  el.time.textContent = '0s'; el.combo.textContent = `${t('st.bosses')} ${summary.bossesKilled}/3`;
  paintScore(el.score, fmt(summary.health)); el.best.textContent = fmt(summary.best);
  el.abil.innerHTML = '';
  if (el.boss) el.boss.hidden = true;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  const n = Object.keys(summary.levels).length;
  const result = await board.submitScore({ name: getName() || 'Anonymous', score: summary.health, note: `HP / 10000 · ${summary.bossesKilled}/3 bosses · ${summary.elapsed}s · ${n} products` });
  if (phase !== 'over' || lastSummary !== summary) return;
  lastResult = result;
  renderOver(summary, result);
}

function renderOver(summary, result) {
  const meId = result?.id;
  el.overlay.innerHTML = `
    <div class="ar-overlay">
      <div class="ar-card">
        ${brandHTML('Last Stand')}
        <h1 class="ar-title" style="font-size:22px">${esc(t('st.over'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.health)}<small> / 10,000 HP</small></div>
          <div class="sub">${esc(t('st.overSub', { s: summary.elapsed, k: summary.kills, b: summary.bossesKilled }))}</div>
          <div class="sub">${esc(t('st.aid', { n: summary.assistedBosses }))} ${summary.emergencyCover ? esc(t('st.cover')) : ''}</div>
          ${result ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</div>` : ''}
        </div>
        <div class="st-build-h">${esc(t('st.loadout'))}</div>
        <div class="st-rail final">${railHTML(summary.levels) || `<span class="st-rail-empty">${esc(t('st.none'))}</span>`}</div>
        <div class="ar-meta">
          <div class="m"><span class="k">${esc(t('st.kills'))}</span><span class="v">${fmt(summary.kills)}</span></div>
          <div class="m"><span class="k">${esc(t('st.streak'))}</span><span class="v">${summary.maxCombo}</span></div>
          <div class="m"><span class="k">${esc(t('st.held'))}</span><span class="v">${summary.elapsed}s</span></div>
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

function resetHud() {
  el.baseFill.style.width = '100%'; el.baseFill.className = 'ok'; el.baseTxt.textContent = START_BASE;
  el.xpFill.style.width = '0%'; el.lvTxt.textContent = `${t('st.lv')} 1`;
  paintWeap(el.weap, ''); paintRail(el.rail, ''); el.abil.innerHTML = '';
  paintScore(el.score, fmt(START_BASE)); document.getElementById('stNetwork').textContent = '';
  if (el.boss) el.boss.hidden = true;
  el.time.textContent = '120s'; el.combo.textContent = `${t('st.bosses')} 0/3`; el.combo.classList.remove('on');
}

function play() {
  const name = (document.getElementById('nameIn')?.value || '').trim();
  if (name) saveName(name);
  resumeAudio();
  el.overlay.innerHTML = '';
  phase = 'play';
  buildAbilBar();
  game.start(getBest());
}

// ---------- events ----------
el.overlay.addEventListener('click', e => {
  const up = e.target.closest('[data-up]')?.dataset.up;
  if (up) { chooseUpgrade(up); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'play' || act === 'again') play();
  else if (act === 'quit') showStart();
  else if (act === 'codex') showCodex();
  else if (act === 'closeCodex') { const c = document.getElementById('stCodex'); if (c) c.remove(); }
  else if (act === 'lang') { i18n.toggleLang(); relabel(); rerender(); }
  else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
  else if (act === 'share') shareResult(e.target);
});

const ABIL_HOTKEY = { q: 'ir', e: 'pt', r: 'rt' };
window.addEventListener('keydown', e => {
  if (phase === 'play' && document.getElementById('stLevelUp') && '123'.includes(e.key)) {
    const cards = document.querySelectorAll('#stLevelUp .st-card');
    const card = cards[+e.key - 1]; if (card) { e.preventDefault(); chooseUpgrade(card.dataset.up); }
  } else if (phase === 'play' && ABIL_HOTKEY[e.key?.toLowerCase()]) {
    e.preventDefault(); game.useAbility(ABIL_HOTKEY[e.key.toLowerCase()]);
  } else if (e.key === 'Escape') { const c = document.getElementById('stCodex'); if (c) c.remove(); }
});

async function shareResult(elm) {
  if (!lastSummary) return;
  const text = `Sentinel · Last Stand — ${fmt(lastSummary.health)}/10,000 HP, ${lastSummary.bossesKilled}/3 bosses, ${lastSummary.elapsed}s`;
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  const old = elm.textContent; elm.textContent = t('ui.copied');
  setTimeout(() => { elm.textContent = old; }, 1400);
}

function relabel() {
  const ks = document.querySelectorAll('.ar-stat .k');
  if (ks[0]) ks[0].textContent = t('st.time');
  if (ks[1]) ks[1].textContent = t('ui.score');
  if (ks[2]) ks[2].textContent = t('ui.best');
}
function rerender() {
  if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult);
  else if (phase === 'start') showStart();
}

showStart();
window.__stand = { game, board, i18n };
