// Last Stand orchestrator: canvas wiring, the vertical-shooter HUD (base integrity,
// XP/level bar, a weapon chip + loadout rail built from the product logos), the
// level-up CHOICE CARDS (where you pick which Sangfor product upgrades your weapon,
// and which dimension it grows), a Product Codex, the leaderboard, and EN / 中文.

const { createStandGame, ACCENT } = await import(
  document.body.dataset.art === 'sangfor' ? './engine.js?art=stand-sangfor-visuals-v2&campaign=matte-arena-v1'
  : document.body.dataset.art === 'combined' ? './engine.js?art=stand-combined-v1&campaign=matte-arena-v1'
  : './engine.js?campaign=matte-arena-v1');
import { WEAPONS, WEAPON_ORDER, START_BASE, ABILITIES, ABILITY_ORDER, WORKFLOW_STEPS, MISSION_SECONDS, UPGRADE_SECONDS, recommendedUpgrade } from './model.js?campaign=agent-workflow-v1';
import { PRODUCTS } from '../data/products.js';
import { ICONS } from '../ui/icons.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard, rankOf } from '../arcade/board.js?server=v1';
import { brandHTML, footerHTML, fmt, esc, painter } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const ICON_KEY = { HCI: 'network', EDR: 'edr', NDR: 'ndr', AF: 'af', IAG: 'iag', XDR: 'xdr', ASTOR: 'astor', MDR: 'mdr', AI: 'network', AGENT: 'network' };
const CAP_NAME = { HCI: 'HCI Cloud', EDR: 'Endpoint Secure', NDR: 'Cyber Command', AF: 'NGAF', IAG: 'IAG Gateway', XDR: 'XDR', ASTOR: 'aStor', MDR: 'MDR', AI: 'AI Platform', AGENT: 'Agent Builder' };
const CAP_SHORT = { NDR: 'CC', AF: 'NGAF', ASTOR: 'aStor', AGENT: 'Agent' };
const ICO = id => ICONS[ICON_KEY[id]] || '';
// official Sangfor product artwork for the HUD (same marks the battlefield uses)
const MARK = id => { const m = PRODUCT_MARKS[id === 'AI' ? 'AICP' : id]; return m ? `<img class="st-mark" src="assets/brand/products/sangfor-${m[0]}" alt="${esc(CAP_NAME[id] || id)}" loading="lazy" />` : ICO(id); };

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
  'dim.EDR': 'Shoulder cannons',
  'dim.MDR': 'Managed gun arm',
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
  't.xdrIdle': 'XDR has no sensors to correlate - add EDR / CC / NGAF',
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
  'dim.EDR': '终端肩炮',
  'dim.MDR': '托管炮臂',
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
  't.xdrIdle': 'XDR 没有可关联的传感器——去加 EDR / CC / NGAF',
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
// Shared enterprise campaign instructions for both visual entries.
Object.assign(EN, {
  'ui.score': 'Total score', 'ui.best': 'Best clear', 'ui.board': 'Enterprise ranking',
  'st.time': 'Remaining', 'st.over': 'Defense complete', 'st.bosses': 'Bosses',
  'st.mech': 'Sentinel mech',
  'st.h2': 'Start with a basic robot. Choose your first module: EDR shoulder cannons, an MDR gun arm or an HCI compute pod. Press 1/2/3 or tap; after 10 seconds the marked recommendation mounts. Combat upgrades add modules and armor to your mech.',
  'st.chooseSub': 'Combat continues · automatic recommendation in', 'st.auto': 'AUTO',
  'st.charging': 'XDR linking', 'st.firing': 'XDR chain lightning', 'st.ready': 'XDR ready',
  't.xdrLink': 'Modules linked — charging XDR', 'dim.XDR': 'Link → chain lightning',
  'b.XDR': 'Modules charge the XDR backpack, which releases lightning into an aimed target and nearby enemies. Each jump loses damage; four to seven distinct targets when enough enemies are in range. Sensors and linked modules increase its power.',
  'st.pace': 'No guaranteed clear. Dodge red boss lanes; balance security, business capacity and AI. Only completed defenses enter the board.',
  'st.h1': 'Move with WASD / arrows or drag. MDR tracks enemies on its own. Cyber Command boosts MDR damage and guides ordinary bullets within a forward cone, without requiring XDR.',
  'st.h3': 'HCI supplies compute; AI produces scored work. Press F or tap Agent Builder to run Detect → Analyze → Contain → Recover. Use Q/E/R support and dodge bosses at 25 / 60 / 95 seconds. Zero HP, zero availability or an uncleared boss at 120s means defeat.',
  'st.tag': '120 seconds. Three bosses. Build a defense that keeps the business and AI running.',
  'st.overSub': '{b}/3 bosses cleared · {s}s · {k} threats stopped. Total = HP 55% + business 25% + AI 12% + agents 8%.',
  'st.success': 'Security and business held. Your completed defense is eligible for ranking.',
  'st.defeat': 'Defense failed', 'reason.integrity': 'Base HP reached zero. Invest in security and time your support.',
  'reason.service': 'Business availability reached zero. Add HCI capacity and protect the service.',
  'reason.bosses': 'A boss remained at the 120-second deadline. Build more firepower and use support.',
  'st.service': 'Availability', 'st.compute': 'Compute / demand', 'st.tracking': 'CC guided fire', 'st.offline': 'XDR not deployed',
  'score.health': 'Remaining HP', 'score.business': 'HCI / business', 'score.ai': 'AI output', 'score.agent': 'Agent Builder',
  'dim.NDR': 'Guided fire + threat marking', 'dim.AI': 'AI workload', 'dim.AGENT': 'Workflow automation',
  'b.EDR': 'Mounts endpoint shoulder cannons on your mech. Cyber Command enables limited forward-cone guidance. Keep aiming and moving.',
  'b.NDR': 'Guides ordinary bullets without requiring XDR, reveals and marks threats, and boosts MDR damage. Tracking remains limited to the forward cone.',
  'b.MDR': 'Mounts a gun arm with autonomous tracking from level one. No CC or XDR required. CC adds damage; upgrades raise firepower and rate.',
  'rail.EDR': 'Shoulder fire', 'rail.MDR': 'Auto tracking', 'rail.AF': 'Front barrier',
  'rail.NDR': 'Guided fire', 'rail.HCI': 'Compute + rate', 'rail.XDR': 'Chain lightning',
  'rail.ASTOR': 'Shield + repair', 'rail.IAG': 'Slow enemies', 'rail.AI': 'AI output', 'rail.AGENT': 'Workflows',
  'b.HCI': 'Mounts a server pod for compute capacity, business output and squad fire rate. It cannot replace threat containment.',
  'b.AF': 'An arm-mounted NGAF shield projects a barrier ahead of the mech, blocking threats and weakening those that break through.',
  'b.ASTOR': 'A hip-mounted aStor snapshot pod absorbs hits and restores base integrity.',
  'b.AI': 'Runs AI workloads on HCI, producing AI score and earlier boss warnings. Each level increases compute demand.',
  'b.AGENT': 'Active skill [F], available beside security services. Runs Detect → Analyze → Contain → Recover on committed targets. Completion restores HP and delivers scored workflow/business work. HCI and AI improve its capacity, response and cooldown.',
  'g.AI': 'An AI application platform hosts model-backed applications.', 'l.AI': 'Needs compute and security; it does not stop attacks by itself.',
  'g.AGENT': 'Agent Builder orchestrates application workflows.', 'l.AGENT': 'Needs a visible threat to start, consumes compute while running, and has a cooldown. This is an arcade abstraction.',
  'ab.wf': 'Agent Builder', 'wf.short': 'Builder', 'wf.title': 'Agent Builder',
  'wf.detect': 'Detect', 'wf.analyze': 'Analyze', 'wf.contain': 'Contain', 'wf.recover': 'Recover',
  'wf.runs': 'Agent Builder: {n} completed workflows',
  'abd.wf': 'Run Detect → Analyze → Contain → Recover. Slow and respond to selected threats, restore HP, then deliver workflow and business work. HCI + AI strengthen the run. [F]',
  't.wfEmpty': 'Agent Builder needs a visible threat to start a workflow',
  't.wfDone': 'Agent Builder workflow completed — recovery and work delivered',
  't.bossAim': 'Boss targeting your lane — move!',
});
Object.assign(ZH, {
  'ui.score': '综合评分', 'ui.best': '最佳通关', 'ui.board': '综合排行榜',
  'st.time': '倒计时', 'st.over': '防守成功', 'st.bosses': 'Boss',
  'st.mech': '哨兵机甲',
  'st.h2': '开局只有普通机器人。先选择首个模块：EDR 肩炮、MDR 炮臂或 HCI 算力舱。按 1/2/3 或点击，10 秒后自动装配推荐项；战斗升级会逐步增加产品模块与机甲装甲。',
  'st.chooseSub': '战斗继续 · 自动推荐倒计时', 'st.auto': '推荐',
  'st.charging': 'XDR 联动蓄能', 'st.firing': 'XDR 链式闪电', 'st.ready': 'XDR 就绪',
  't.xdrLink': '模块联动——XDR 蓄能中', 'dim.XDR': '联动 → 链式闪电',
  'b.XDR': '各模块为 XDR 背包蓄能后，向瞄准目标释放闪电，再跳向附近敌人。每次跳跃伤害递减，范围内敌人充足时可连锁四至七个不同目标；传感器与联动模块可增强伤害。',
  'st.pace': '不再保底通关。躲开红色 Boss 攻击带，平衡安全、云算力与 AI；仅成功防守的成绩进入排行榜。',
  'st.h1': '使用 WASD / 方向键或拖动移动。MDR 自带追踪，不依赖其他产品。部署 CC 即可让普通子弹获得前方扇区内的有限追踪，并为 MDR 增伤，无需 XDR。',
  'st.h3': 'HCI 提供算力，AI 产出评分；按 F 或点击 Agent Builder，执行「检测→分析→处置→恢复」工作流。Q/E/R 呼叫安全服务，躲避 25 / 60 / 95 秒登场的 Boss。血量、可用性归零或 120 秒仍有 Boss 存活都会失败。',
  'st.tag': '120 秒，三大 Boss。在守住防线的同时，让云业务与 AI 持续运转。',
  'st.overSub': '清除 {b}/3 个 Boss · {s} 秒 · 拦截 {k} 个威胁。综合分＝血量 55%＋业务 25%＋AI 12%＋Agent 8%。',
  'st.success': '安全与业务守住了，通关成绩计入排行榜。',
  'st.defeat': '防守失败', 'reason.integrity': '基地血量归零。需要补足安全投入，并把握支援时机。',
  'reason.service': '业务可用性归零。需要补充 HCI 算力，并保护业务。',
  'reason.bosses': '120 秒结束时仍有 Boss 存活。需要补足火力，并主动使用支援技能。',
  'st.service': '业务可用性', 'st.compute': '算力／需求', 'st.tracking': 'CC 子弹追踪', 'st.offline': 'XDR 未部署',
  'score.health': '剩余血量', 'score.business': 'HCI／业务分', 'score.ai': 'AI 产出分', 'score.agent': 'Agent Builder',
  'dim.NDR': '子弹追踪＋威胁标记', 'dim.AI': 'AI 工作负载', 'dim.AGENT': '智能工作流',
  'b.EDR': '为机甲装配终端肩炮；部署 CC 即可获得前方扇区内的有限追踪，仍需走位与瞄准。',
  'b.NDR': '无需 XDR 即可引导普通子弹，同时揭露、标记威胁并为 MDR 增伤。追踪范围限于前方扇区。',
  'b.MDR': '装配一级即自带追踪的托管炮臂，无需 CC 或 XDR。CC 提供额外增伤，升级提高火力与射速。',
  'rail.EDR': '肩炮火力', 'rail.MDR': '自主追踪', 'rail.AF': '前方屏障',
  'rail.NDR': '子弹追踪', 'rail.HCI': '算力＋射速', 'rail.XDR': '链式闪电',
  'rail.ASTOR': '护盾＋修复', 'rail.IAG': '敌人减速', 'rail.AI': 'AI 产出', 'rail.AGENT': '工作流产出',
  'b.HCI': '装配服务器算力舱，增加算力、业务产出和全队射速，无法代替安全产品阻止攻击。',
  'b.AF': '臂载 NGAF 盾牌向机甲前方投射屏障，拦截威胁，并削弱突破屏障的敌人。',
  'b.ASTOR': '腰部 aStor 快照舱替基地抵挡攻击，并恢复完整度。',
  'b.AI': '在 HCI 上运行 AI 任务，积累 AI 评分，并提前预警 Boss 落点。每级都会增加算力需求。',
  'b.AGENT': '主动技能［F］，与安全服务并列。对选定目标执行「检测→分析→处置→恢复」，完成后恢复血量并交付工作流及业务评分；HCI 和 AI 可增强处理能力、处置效果并缩短冷却。',
  'g.AI': 'AI 应用平台承载基于模型的应用。', 'l.AI': '需要算力与安全保护，本身无法阻止攻击。',
  'g.AGENT': 'Agent Builder 编排应用工作流。', 'l.AGENT': '需要可见威胁才能启动，运行时消耗算力，且有冷却时间；这里是游戏机制抽象。',
  'ab.wf': 'Agent Builder', 'wf.short': 'Builder', 'wf.title': 'Agent Builder',
  'wf.detect': '检测', 'wf.analyze': '分析', 'wf.contain': '处置', 'wf.recover': '恢复',
  'wf.runs': 'Agent Builder：已完成 {n} 次工作流',
  'abd.wf': '执行「检测→分析→处置→恢复」，减速并处置选定威胁、恢复血量，完成后交付工作流及业务评分；HCI＋AI 可增强效果。［F］',
  't.wfEmpty': 'Agent Builder 需要可见威胁才能启动工作流',
  't.wfDone': 'Agent Builder 工作流完成——恢复并交付业务产出',
  't.bossAim': 'Boss 已锁定你的落点——立即移动！',
});
Object.assign(EN, {
  'board.server': 'SERVER', 'board.offline': 'Server unavailable',
  'board.saving': 'Saving result to server…', 'board.saved': 'Saved to server',
  'board.failed': 'Result not saved. Keep this screen open and retry.', 'board.retry': 'Retry save',
});
Object.assign(ZH, {
  'board.server': '服务器', 'board.offline': '服务器暂不可用',
  'board.saving': '正在保存成绩到服务器…', 'board.saved': '成绩已保存到服务器',
  'board.failed': '成绩未保存，请保留此页面并重试。', 'board.retry': '重试保存',
});
const i18n = makeI18n(EN, ZH);
const { t } = i18n;
const lang = () => i18n.getLang();
const board = makeBoard({ lsKey: 'sentinel.stand.enterprise.scores.v1', apiVar: '__STAND_ENTERPRISE_API', requireRemote: () => window.__STAND_SERVER_REQUIRED === true });
const NAME_KEY = 'sentinel.arcade.name';
const BEST_KEY = 'sentinel.stand.enterprise.best.v1';
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
    <div class="st-network" id="stNetwork"></div><div class="st-cloud-score" id="stCloudScores"></div>
    <div class="st-abil" id="stAbil"></div>
    <div class="st-workflow" id="stWorkflow" hidden aria-live="polite"></div>
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
  workflow: document.getElementById('stWorkflow'),
  boss: document.getElementById('stBoss'),
  bossName: document.getElementById('stBossName'),
  bossHp: document.getElementById('stBossHp'),
  bossFill: document.getElementById('stBossFill'),
  toasts: document.getElementById('stToasts'),
  overlay: document.getElementById('stOverlay'),
};

// ---------- active operator skills (bottom bar) ----------
const ABIL_CAP = { ir: 'NDR', pt: 'IAG', rt: 'EDR', wf: 'AGENT' };
const ABIL_KEY = { ir: 'Q', pt: 'E', rt: 'R', wf: 'F' };
const paintWorkflow = painter();
const abilBtns = {};
function buildAbilBar() {
  el.abil.innerHTML = ABILITY_ORDER.map(id => `
    <button class="st-ab cap-${ABIL_CAP[id]}${id==='wf'?' st-ab-workflow':''}" data-ab="${id}" type="button"
      title="${esc(t('ab.' + id))} - ${esc(t('abd.' + id))}" aria-label="${esc(t('ab.' + id))}">
      <span class="st-ab-cd"></span>
      <span class="st-ab-key">${ABIL_KEY[id]}</span>
      <span class="st-ab-code">${id==='wf'?'Agent':id.toUpperCase()}</span>
      <span class="st-ab-name">${esc(t(id==='wf'?'wf.short':'ab.' + id))}</span>
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
    ui.timer.textContent = id==='wf'&&a.active ? t('wf.'+WORKFLOW_STEPS[a.stage]) : a.ready ? '' : Math.ceil(a.cd) + 's';
  }
  const wf=abilities.wf;
  el.workflow.hidden=!wf?.active;
  if(wf?.active)paintWorkflow(el.workflow,`<div class="st-workflow-title">${esc(t('wf.title'))}</div><div class="st-workflow-steps">${WORKFLOW_STEPS.map((step,i)=>`<span class="${i<wf.stage?'done':i===wf.stage?'current':''}">${i<wf.stage?'✓':i+1} ${esc(t('wf.'+step))}</span>`).join('')}</div>`);
}
const paintScore = painter();
const paintWeap = painter();
const paintRail = painter();
let phase = 'start', lastSummary = null, lastResult = null;

const artModule = useArt
  ? await import('./sangfor-art.js?art=matte-arena-v1') : null;
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
    el.baseTxt.textContent = `${fmt(h.base)} / ${fmt(START_BASE)}`;
    el.baseTxt.title = t('st.base');
    paintWeap(el.weap, weapHTML(h));
    paintRail(el.rail, railHTML(h.levels));
    updateAbilBar(h.abilities);
    updateBossBar(h.boss);
    updateCloudScores(h);
    document.getElementById('stNetwork').textContent = `${h.tracking ? t('st.tracking') + ' · ' : ''}${t('st.' + h.linkPhase)}`;
  },
  onToast: (key, kind) => toast(t('t.' + key), kind),
  onLevelUp: (choices, level) => showLevelUp(choices, level),
  onOver: summary => onGameOver(summary),
});

function weapHTML(h) {
  const id = h.dom;
  if (!id) return `<span class="st-weap-lv"><b>${esc(t('st.mech'))}</b><span>Mk.I · ${esc(t('st.none'))}</span></span>`;
  const lvl = h.levels[id] || 0;
  const corr = h.corr > 0 ? ` · <em class="st-corr-in">${esc(t('st.corr'))}&times;${h.corr}</em>` : '';
  return `<span class="st-weap-ico cap-${id}">${MARK(id)}</span>` +
    `<span class="st-weap-lv"><b>${esc(h.mechanized ? t('st.mech')+' Mk.'+['I','II','III','IV'][h.rigStage] : CAP_NAME[id])}</b><span>${esc(CAP_NAME[id])} Lv${lvl}${corr}</span></span>`;
}
function railHTML(levels) {
  const ids = WEAPON_ORDER.filter(id => (levels[id] || 0) > 0);
  if (!ids.length) return '';
  return ids.map(id => {
    const lv = levels[id] || 0, name = CAP_SHORT[id] || id;
    return `<span class="st-rail-item cap-${id}" title="${esc(CAP_NAME[id])} - ${esc(t('dim.' + id))}">
      <span class="st-rail-ico">${MARK(id)}</span><span class="st-rail-copy"><span class="st-rail-name"><b>${name}</b><span>Lv${lv}</span></span><small class="st-rail-effect">${esc(t('rail.' + id))}</small></span></span>`;
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
    ${equipmentPreview && !['AI', 'AGENT'].includes(id) ? `<img class="st-equipment-preview" src="assets/stand-sangfor/${id.toLowerCase()}.webp?art=matte-v1" alt="" />` : ''}
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
        <span>${esc(t('st.chooseSub'))} <strong id="stOfferTimer">${UPGRADE_SECONDS}s</strong></span></div>
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
        ${equipmentPreview ? `<img class="st-art-hero" src="assets/stand-sangfor/equipment-preview.webp?art=matte-v1" alt="" />` : ''}
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

function scoreMetrics(scores, availability, capacity, demand) {
  if (!scores) return '';
  return `<div class="st-metrics">${['health','business','ai','agent'].map(key=>`<span><small>${esc(t('score.'+key))}</small><b>${fmt(scores[key])}</b></span>`).join('')}</div><div class="st-service-line ${availability < 30 ? 'warn' : ''}">${esc(t('st.service'))} ${availability}%${capacity ? ` · ${esc(t('st.compute'))} ${capacity}/${demand}` : ''}</div>`;
}
function updateCloudScores(h) {
  const root = document.getElementById('stCloudScores');
  if (!root.firstElementChild || root.dataset.lang !== lang()) {
    root.innerHTML = scoreMetrics(h.scores, h.availability, h.capacity, h.demand);
    root.dataset.lang = lang();
  }
  root.querySelectorAll('.st-metrics b').forEach((node, i) => {
    const value = fmt(h.scores[['health','business','ai','agent'][i]]);
    if (node.textContent !== value) node.textContent = value;
  });
  const line = root.querySelector('.st-service-line');
  const text = `${t('st.service')} ${h.availability}% · ${t('st.compute')} ${h.capacity}/${h.demand}`;
  if (line.textContent !== text) line.textContent = text;
  line.classList.toggle('warn', h.availability < 30);
}
function healthRowsHTML(rows, meId) {
  if (!rows?.length) return `<li class="lb-empty">${esc(t('ui.empty'))}</li>`;
  return rows.map(r => `<li class="lb-row${r.id === meId ? ' me' : ''}"><span class="lb-rank">${rankOf(rows, r.score)}</span><span class="lb-name">${esc(r.name)}</span><span class="lb-score">${fmt(r.score)}</span></li>`).join('');
}
function boardBlock(b, meId) {
  return `<div class="ar-lb">
    <div class="ar-lb-h"><span class="t">${esc(t('ui.board'))}</span>
      <span class="mode ${['world','server'].includes(b.mode) ? 'world' : ''}">${esc(boardLabel(b.mode))}</span></div>
    <ol class="lb-rows">${healthRowsHTML(b.rows, meId)}</ol>
  </div>`;
}
function boardLabel(mode) {
  return t(mode === 'server' ? 'board.server' : mode === 'offline' ? 'board.offline' : mode === 'world' ? 'ui.world' : 'ui.local');
}

function codexRows() {
  const L = lang();
  return [...WEAPON_ORDER,'AGENT'].map(id => {
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
  el.time.textContent = Math.max(0, 120-summary.elapsed) + 's'; el.combo.textContent = `${t('st.bosses')} ${summary.bossesKilled}/3`;
  paintScore(el.score, fmt(summary.score)); el.best.textContent = fmt(summary.best);
  el.abil.innerHTML = '';
  el.workflow.hidden = true;
  if (el.boss) el.boss.hidden = true;
  if (summary.best > getBest()) saveBest(summary.best);
  renderOver(summary, null);
  if (summary.outcome !== 'victory') return;
  await saveResult(summary);
}

async function saveResult(summary) {
  if (summary.saving) return;
  summary.saving = true;
  lastResult = null;
  renderOver(summary, null);
  summary.attemptId ||= crypto.randomUUID();
  summary.playerName ||= getName() || 'Anonymous';
  const n = Object.keys(summary.levels).length;
  const result = await board.submitScore({ id: summary.attemptId, name: summary.playerName, score: summary.score,
    note: `Enterprise / 10000 · ${summary.bossesKilled}/3 bosses · ${summary.elapsed}s · ${n} products`,
    details: { outcome: summary.outcome, elapsed: summary.elapsed, bossesKilled: summary.bossesKilled, scores: summary.scores } });
  summary.saving = false;
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
        <h1 class="ar-title" style="font-size:22px">${esc(t(summary.outcome === 'victory' ? 'st.over' : 'st.defeat'))}</h1>
        <div class="ar-result">
          <div class="lbl">${esc(t('ui.score'))}</div>
          <div class="big">${fmt(summary.score)}<small> / 10,000</small></div>
          <div class="sub">${esc(t('st.overSub', { s: summary.elapsed, k: summary.kills, b: summary.bossesKilled }))}</div>
          <div class="sub">${esc(t(summary.reason ? 'reason.' + summary.reason : 'st.success'))}</div>
          ${scoreMetrics(summary.scores, summary.availability)}
          <div class="sub">${esc(t('wf.runs',{n:summary.workflows||0}))}</div>
          ${result?.rank != null ? `<div class="sub">${esc(t('ui.youRank'))}<span class="hot">${result.rank}</span> · ${esc(boardLabel(result.mode))}</div>` : ''}
          ${window.__STAND_SERVER_REQUIRED && summary.outcome === 'victory' ? `<div class="sub" role="status">${esc(t(result?.saved ? 'board.saved' : result?.saved === false ? 'board.failed' : 'board.saving'))}</div>` : ''}
          ${result?.saved === false ? `<button class="btn ghost" data-act="retrySave">${esc(t('board.retry'))}</button>` : ''}
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
  el.workflow.hidden = true;
  paintScore(el.score, '0'); document.getElementById('stCloudScores').innerHTML = ''; document.getElementById('stNetwork').textContent = '';
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
  else if (act === 'retrySave' && lastSummary?.outcome === 'victory') saveResult(lastSummary);
});

const ABIL_HOTKEY = { q: 'ir', e: 'pt', r: 'rt', f: 'wf' };
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
  const text = `Sentinel · Last Stand — ${fmt(lastSummary.score)}/10,000 enterprise score, ${lastSummary.bossesKilled}/3 bosses, ${lastSummary.elapsed}s`;
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
