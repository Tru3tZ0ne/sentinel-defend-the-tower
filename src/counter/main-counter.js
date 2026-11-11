// Sentinel Counter-Breach orchestrator: the competitive-shooter HUD (radar, kill
// feed, vitals, ammo, buy menu, scoreboard), touch controls, leaderboard and EN / 中文.
// The game itself is ./engine.js (view + input) and ./sim.js (rules).
import { createCounterGame } from './engine.js?v=cb-2';
import { LEVELED, PRODUCTS, MAXLV, COLOR, WAVES, WIN_AT, GATES, THREAT, GUN, MUTATORS, CONTRACT_PAY, DIFF } from './sim.js';
import { snd, wake } from './sound.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { makeI18n } from '../arcade/i18n.js';
import { makeBoard, rankOf } from '../arcade/board.js';
import { fmt, esc, painter, soundIco } from '../arcade/ui-kit.js';
import { setMuted, isMuted, resumeAudio } from '../rush/audio.js';

const NAME = { EDR: 'Endpoint Secure', AF: 'NGAF', NDR: 'Cyber Command', XDR: 'XDR', HCI: 'HCI', IAG: 'IAG', ASTOR: 'aStor', MDR: 'MDR' };
const MARK = (id, cls = 'cb-mark') => `<img class="${cls}" src="assets/brand/products/sangfor-${PRODUCT_MARKS[id][0]}" alt="${esc(NAME[id])}" />`;

const EN = {
  'm.tag': 'A round-based first-person site defense. Threats breach from the Internet and a Ransomware carrier tries to plant an encryptor on Site A or B. Earn money, buy Sangfor products between rounds, hold the sites. First to {n} rounds wins.',
  'm.h1': 'Kill the Ransomware carrier before it plants - or hold E on the encryptor to defuse it before it detonates.',
  'm.h2': 'Every round starts with a buy phase. Each product does its real job: the rifle is endpoint protection, the firewall closes gates, Cyber Command is your radar.',
  'm.h3': 'Products have real limits too: worms start inside the firewall, a Zero-Day walks through it, APTs are invisible without Cyber Command.',
  'm.h4': 'Crates are cover. Crouch behind one and fire cannot reach you; jump onto one and worms cannot bite you. Jump over a Trojan shot to dodge it.',
  'm.keys': 'Controls', 'm.k1': 'WASD move · mouse aim · click fire · right mouse aim down sights', 'm.k2': 'SPACE jump · C or SHIFT crouch · R reload · E defuse', 'm.k4': 'G grenade · X call MDR · P pause', 'm.k3': 'Touch: left thumb moves, right thumb aims, it fires when you are on target',
  'm.play': 'PLAY', 'm.daily': 'DAILY OP', 'm.dailyD': 'One fixed operation per day, the same for everyone.', 'm.dailyBest': 'Your best today: {s}', 'm.board': 'Defender ranking', 'm.name': 'Callsign', 'm.medals': 'Medals', 'm.toNext': '{x} XP to {r}', 'm.maxRank': 'Top rank reached',
  'd.label': 'Difficulty', 'd.easy': 'Recruit', 'd.normal': 'Veteran', 'd.hard': 'Elite', 'd.easy.d': 'Threats hit softer. Score x0.7', 'd.normal.d': 'The intended fight. Score x1', 'd.hard.d': 'Threats hit harder and last longer. Score x1.5',
  'rk.0': 'Intern', 'rk.1': 'SOC Analyst', 'rk.2': 'Threat Hunter', 'rk.3': 'Incident Responder', 'rk.4': 'Security Architect', 'rk.5': 'CISO',
  'md.flawless': 'Untouched', 'md.flawless.d': 'Win a round without taking damage', 'md.rampage': 'Rampage', 'md.rampage.d': 'Chain 5 kills', 'md.air': 'Air Gap', 'md.air.d': 'Kill a threat while airborne', 'md.sweep': 'Clean Sweep', 'md.sweep.d': 'Win a match 4-0',
  'md.sharp': 'Sharpshooter', 'md.sharp.d': '10 headshots in one match', 'md.defuser': 'Cold Hands', 'md.defuser.d': 'Defuse an encryptor by hand', 'md.elite': 'Elite Defender', 'md.elite.d': 'Win a match on Elite', 'md.contracts': 'Contractor', 'md.contracts.d': 'Complete 3 contracts in one match',
  'mu.none': 'STANDARD BREACH', 'mu.none.d': 'Threats come through the three gates. Nothing unusual - yet.',
  'mu.outbreak': 'WORM OUTBREAK', 'mu.outbreak.d': 'Six extra worms spread from infected hosts inside. The firewall never sees them - correlated response clears crowds.',
  'mu.spear': 'SPEAR-PHISHING', 'mu.spear.d': 'More phish, and 35% faster. Lock them out with identity control before they reach you.',
  'mu.insider': 'INSIDER THREAT', 'mu.insider.d': 'The Ransomware carrier starts INSIDE the perimeter. Gates will not stop it - you need visibility to find it.',
  'mu.ddos': 'DDoS FLOOD', 'mu.ddos.d': 'Firewalls start at half strength and four extra phish pile in. The endpoint has to carry this one.',
  'mu.rush': 'FAST ENCRYPTOR', 'mu.rush.d': 'It plants in 2.3 s and the fuse is only 16 s. A backup is the only sure answer.',
  'c.title': 'Contract', 'c.heads': 'Land {n} headshots', 'c.air': 'Kill a threat while airborne', 'c.multi': 'Chain a triple kill', 'c.fast': 'Kill the Ransomware carrier within 30 s', 'c.clean': 'Win the round taking under 30 damage', 'c.high': 'Get {n} kills standing on a crate', 'c.done': 'CONTRACT COMPLETE',
  'k.2': 'DOUBLE KILL', 'k.3': 'TRIPLE KILL', 'k.4': 'QUAD KILL', 'k.5': 'RAMPAGE', 'k.6': 'UNSTOPPABLE', 'k.head': 'HEADSHOT',
  'l.intel': 'Threat intel', 'l.patch': 'Hotfix applied', 'mk.bomb': 'DEFUSE', 'mk.drop': 'ENCRYPTOR', 'mk.carrier': 'CARRIER', 'mk.patch': 'HOTFIX',
  'b.rec': 'RECOMMENDED', 'h.defend': 'DEFEND THE SITES', 'inv.jump': 'JUMP', 'inv.crouch': 'CROUCH', 'o.streak': 'Best streak', 'o.contracts': 'Contracts', 'o.xp': '+{x} XP', 'o.newMedal': 'New medal', 'o.rankUp': 'Promoted to {r}', 'o.daily': 'Daily Op',
  'h.round': 'ROUND {n}', 'h.threats': 'THREATS', 'h.buy': 'BUY PHASE', 'h.ready': 'READY', 'h.readyKey': 'ENTER', 'h.money': 'Funds', 'h.use': 'Hold E to defuse', 'h.useTouch': 'Hold DEFUSE', 'h.defusing': 'Defusing...',
  'h.sensors': '{n}/7 feeding it', 'h.snapshot': 'snapshot ready', 'h.failover': 'failover ready', 'h.oncall': 'on call', 'h.firstTo': 'first to {n}', 'h.paused': 'PAUSED', 'h.resume': 'Click to resume', 'h.quit': 'Quit match', 'h.click': 'Click to aim',
  'a.heading': 'Cyber Command: encryptor heading to SITE {s}', 'a.planting': 'Encryptor being planted at SITE {s}', 'a.planted': 'ENCRYPTOR PLANTED · SITE {s}', 'a.dropped': 'Encryptor dropped - they will come back for it',
  'gun.0': 'Endpoint Agent', 'gun.1': 'Endpoint Secure rifle', 'gun.2': 'Endpoint Secure rifle Mk-II', 'gun.3': 'Endpoint Secure rifle Mk-III', 'inv.nade': 'Access Denied', 'inv.mdr': 'Response team', 'inv.fire': 'FIRE', 'inv.defuse': 'DEFUSE',
  'role.EDR': 'PRIMARY · your weapon', 'role.AF': 'PERIMETER · closes gates', 'role.NDR': 'VISIBILITY · radar', 'role.XDR': 'CORRELATION · chain response', 'role.HCI': 'PLATFORM · armor', 'role.IAG': 'IDENTITY · grenade', 'role.ASTOR': 'BACKUP · single use', 'role.MDR': 'SERVICE · single call',
  'b.EDR.1': 'Full-auto rifle, 30 rounds. Endpoint protection is where a threat is actually stopped, so it is the gun in your hands.', 'b.EDR.2': 'Rifle Mk-II: +25% damage, 35 rounds, faster reload.', 'b.EDR.3': 'Rifle Mk-III: hits harder and faster, and every kill isolates the host - a burst that hurts threats next to it.',
  'b.AF.1': 'One firewall on a gate you choose. Threats from the Internet have to go around; your own fire passes outbound.', 'b.AF.2': 'A second firewall: two gates closed, one lane left to hold.', 'b.AF.3': 'A third firewall, thicker, with IPS that zaps whatever attacks it.',
  'b.NDR.1': 'Every threat shows on your radar and cloaked APTs become visible. Without it you only see what is in front of you.', 'b.NDR.2': 'See threats through walls, and get told which site the encryptor is heading for.', 'b.NDR.3': 'Threat hunting: everything it tracks takes +30% damage.',
  'b.XDR.1': 'Each rifle kill arcs to 2 more threats that a sensor can see. Its power comes from your other products - alone it is weak.', 'b.XDR.2': 'The response arcs to 3 threats.', 'b.XDR.3': 'The response arcs to 4 threats.',
  'b.HCI.1': '50 armor. Armor absorbs half of every hit.', 'b.HCI.2': '100 armor.', 'b.HCI.3': 'High availability: once per round a lethal hit fails you over to a standby at 60 HP.',
  'b.IAG.1': 'One Access Denied grenade per round: threats in the blast are locked out for 3.6 s.', 'b.IAG.2': 'Two grenades per round.', 'b.IAG.3': 'Three grenades and a wider blast.',
  'b.ASTOR.1': 'One snapshot. If the encryptor detonates, the site is restored and the round still counts as held. Used up when it fires.',
  'b.MDR.1': 'One call (X). Defuses a planted encryptor from anywhere - or, with nothing planted, stuns and damages every threat. Used up when called.',
  'lim.AF': 'Limit: worms start inside, a Zero-Day walks through.', 'lim.IAG': 'Limit: APTs use stolen credentials and recover in ~1 s.', 'lim.XDR': 'Now: {n}/7 products feeding it (x{p} power).', 'lim.NDR': 'Limit: it shows threats, it does not stop them.', 'lim.ASTOR': 'Limit: pays less than a clean win.', 'lim.HCI': 'Limit: armor only halves damage.', 'lim.EDR': 'Limit: it only stops what you can hit.', 'lim.MDR': 'Limit: one call, then you must buy again.',
  'b.owned': 'OWNED', 'b.max': 'MAX', 'b.fw': 'Firewall policy', 'b.fwHint': 'Click a gate to move a firewall. {n}/{m} placed.', 'b.fwNone': 'Buy NGAF to close gates.', 'b.gateW': 'WEST', 'b.gateM': 'MID', 'b.gateE': 'EAST', 'b.intel': 'Round intel', 'b.next': 'Incoming',
  'i.1': 'A Ransomware carrier will try to plant an encryptor on Site A or B. Kill it, or defuse the encryptor before it detonates.', 'i.2': 'Worms spread from infected hosts INSIDE the network (the green vents). A perimeter firewall never sees them.', 'i.3': 'Trojans shoot back. APTs are cloaked snipers - watch for the red laser and break line of sight. Cyber Command uncloaks them.', 'i.4': 'A Zero-Day is coming. No signature exists for it, so it walks straight through firewalls.', 'i.5': 'A larger combined assault. Correlated response (XDR) pays off against crowds.', 'i.6': 'Two Zero-Days and three APTs. Hold nothing back.', 'i.7': 'Final round. Everything they have.',
  'th.phish': 'PHISH', 'th.worm': 'WORM', 'th.trojan': 'TROJAN', 'th.apt': 'APT', 'th.brute': 'ZERO-DAY', 'th.carrier': 'RANSOMWARE', 'th.denied': 'ACCESS DENIED', 'th.you': 'YOU', 'th.encryptor': 'Encryptor defused', 'th.restore': 'Site restored',
  'sign.A': 'SITE A', 'sign.B': 'SITE B', 'sign.soc': 'SOC', 'sign.net': 'INTERNET', 'sign.gateW': 'GATE W', 'sign.gateM': 'GATE M', 'sign.gateE': 'GATE E',
  'z.internet': 'Internet', 'z.gate': 'Perimeter gate', 'z.west': 'West lane', 'z.mid': 'Mid', 'z.east': 'East lane', 'z.siteA': 'Site A', 'z.siteB': 'Site B', 'z.court': 'Court', 'z.backA': 'Back of A', 'z.backB': 'Back of B', 'z.soc': 'SOC',
  'r.win': 'ROUND WON', 'r.loss': 'ROUND LOST', 'res.eliminated': 'All threats eliminated', 'res.defused': 'Encryptor defused', 'res.time': 'The attack ran out of time', 'res.restored': 'Site encrypted - restored from the aStor snapshot', 'res.encrypted': 'The site was encrypted', 'res.down': 'You were taken down', 'r.flawless': 'Flawless +400',
  't.brute': 'Zero-Day inbound - firewalls will not stop it', 't.aptSeen': 'Cyber Command uncloaked an APT', 't.aptBlind': 'Something cloaked is out there - you have no Cyber Command', 't.dropped': 'Carrier down - encryptor dropped', 't.failover': 'HCI failover - standby took over', 't.aptCreds': 'APT used stolen credentials - barely slowed',
  't.mdrDefuse': 'MDR team defused the encryptor remotely', 't.mdrSweep': 'MDR response - every threat hit', 't.planted_A': 'Encryptor planted at SITE A', 't.planted_B': 'Encryptor planted at SITE B', 't.wallDown': 'A firewall was overwhelmed', 't.restored': 'aStor restored the site from a snapshot', 't.encrypted': 'Site encrypted', 't.defused': 'Encryptor defused',
  't.xdrAlone': 'XDR has little to correlate yet - other products power it', 't.noFunds': 'Not enough funds', 't.insider': 'Insider threat - the carrier is already inside', 't.contract': 'Contract complete',
  'o.victory': 'SITES DEFENDED', 'o.defeat': 'NETWORK BREACHED', 'o.rounds': 'Rounds', 'o.kills': 'Kills', 'o.heads': 'Headshots', 'o.acc': 'Accuracy', 'o.report': 'What each product did',
  's.EDR': '{k} kills', 's.XDR': '{k} chained kills', 's.AF': '{b} damage held at the gates · {k} IPS kills', 's.NDR': '{r} APTs uncloaked', 's.HCI': '{a} damage absorbed · {f} failovers', 's.IAG': '{s} threats locked out', 's.ASTOR': '{r} sites restored', 's.MDR': '{d} remote defuses · {k} kills', 's.none': 'not bought',
  'ui.again': 'Play again', 'ui.quit': 'Menu', 'ui.more': 'More modes',
};
const ZH = {
  'm.tag': '回合制第一人称据点防守。威胁从互联网侧突入，勒索软件携带者会设法在 A 点或 B 点安放加密器。赚取资金，在回合间购买深信服产品，守住据点。先赢 {n} 回合者获胜。',
  'm.h1': '在勒索软件携带者安放之前击杀它——或者在加密器引爆前按住 E 将其拆除。',
  'm.h2': '每回合以购买阶段开始。每款产品都做它真正的本职：步枪就是终端防护，防火墙封闭闸门，Cyber Command 是你的雷达。',
  'm.h3': '产品也有真实的局限：蠕虫从防火墙内部发起，零日漏洞直接穿墙，没有 Cyber Command 就看不见 APT。',
  'm.h4': '货箱就是掩体。蹲在后面，火力打不到你；跳上去，蠕虫咬不到你。跳起来还能躲开木马的子弹。',
  'm.keys': '操作', 'm.k1': 'WASD 移动 · 鼠标瞄准 · 点击开火 · 右键开镜', 'm.k2': '空格 跳跃 · C 或 SHIFT 下蹲 · R 换弹 · E 拆除', 'm.k4': 'G 手雷 · X 呼叫 MDR · P 暂停', 'm.k3': '触屏：左手移动，右手瞄准，准星对准目标时自动开火',
  'm.play': '开始', 'm.daily': '每日行动', 'm.dailyD': '每天一场固定行动，所有人面对同一局。', 'm.dailyBest': '你今天的最佳：{s}', 'm.board': '防守者排行榜', 'm.name': '代号', 'm.medals': '勋章', 'm.toNext': '距离 {r} 还差 {x} XP', 'm.maxRank': '已达最高军衔',
  'd.label': '难度', 'd.easy': '新兵', 'd.normal': '老兵', 'd.hard': '精英', 'd.easy.d': '威胁伤害较低。得分 x0.7', 'd.normal.d': '标准强度。得分 x1', 'd.hard.d': '威胁更痛、更耐打。得分 x1.5',
  'rk.0': '实习生', 'rk.1': 'SOC 分析师', 'rk.2': '威胁猎手', 'rk.3': '应急响应专家', 'rk.4': '安全架构师', 'rk.5': 'CISO',
  'md.flawless': '毫发无伤', 'md.flawless.d': '无伤赢下一个回合', 'md.rampage': '大杀特杀', 'md.rampage.d': '连续击杀 5 个', 'md.air': '空中隔离', 'md.air.d': '在空中击杀一个威胁', 'md.sweep': '完胜', 'md.sweep.d': '以 4-0 赢下一场',
  'md.sharp': '神枪手', 'md.sharp.d': '单场 10 次爆头', 'md.defuser': '冷静的手', 'md.defuser.d': '亲手拆除一个加密器', 'md.elite': '精英防守者', 'md.elite.d': '在精英难度下获胜', 'md.contracts': '合约达人', 'md.contracts.d': '单场完成 3 个合约',
  'mu.none': '常规入侵', 'mu.none.d': '威胁从三个闸门进入。暂时没有异常。',
  'mu.outbreak': '蠕虫爆发', 'mu.outbreak.d': '额外 6 只蠕虫从内部受感染主机扩散。防火墙看不到它们——关联响应最适合清理成群的敌人。',
  'mu.spear': '鱼叉式钓鱼', 'mu.spear.d': '钓鱼更多，速度快 35%。在它们贴近之前用身份管控把它们锁在外面。',
  'mu.insider': '内部威胁', 'mu.insider.d': '勒索软件携带者从边界内部出发。闸门拦不住它——你需要可视化才能找到它。',
  'mu.ddos': 'DDoS 洪水', 'mu.ddos.d': '防火墙只剩一半强度，另有 4 个钓鱼涌入。这一回合要靠终端顶住。',
  'mu.rush': '快速加密器', 'mu.rush.d': '2.3 秒即可安放，引信只有 16 秒。备份是唯一稳妥的答案。',
  'c.title': '合约', 'c.heads': '完成 {n} 次爆头', 'c.air': '在空中击杀一个威胁', 'c.multi': '完成一次三连杀', 'c.fast': '30 秒内击杀勒索软件携带者', 'c.clean': '受到伤害低于 30 并赢下回合', 'c.high': '站在货箱上击杀 {n} 个', 'c.done': '合约完成',
  'k.2': '双杀', 'k.3': '三杀', 'k.4': '四杀', 'k.5': '大杀特杀', 'k.6': '势不可挡', 'k.head': '爆头',
  'l.intel': '威胁情报', 'l.patch': '热补丁已应用', 'mk.bomb': '拆除', 'mk.drop': '加密器', 'mk.carrier': '携带者', 'mk.patch': '热补丁',
  'b.rec': '推荐', 'h.defend': '守住据点', 'inv.jump': '跳', 'inv.crouch': '蹲', 'o.streak': '最佳连杀', 'o.contracts': '合约', 'o.xp': '+{x} XP', 'o.newMedal': '新勋章', 'o.rankUp': '晋升为 {r}', 'o.daily': '每日行动',
  'h.round': '第 {n} 回合', 'h.threats': '威胁', 'h.buy': '购买阶段', 'h.ready': '准备就绪', 'h.readyKey': 'ENTER', 'h.money': '资金', 'h.use': '按住 E 拆除', 'h.useTouch': '按住“拆除”', 'h.defusing': '拆除中...',
  'h.sensors': '{n}/7 款为它供数', 'h.snapshot': '快照就绪', 'h.failover': '故障切换就绪', 'h.oncall': '待命', 'h.firstTo': '先赢 {n} 回合', 'h.paused': '已暂停', 'h.resume': '点击继续', 'h.quit': '退出对局', 'h.click': '点击开始瞄准',
  'a.heading': 'Cyber Command：加密器正前往 {s} 点', 'a.planting': '加密器正在 {s} 点安放', 'a.planted': '加密器已安放 · {s} 点', 'a.dropped': '加密器掉落——它们会回来捡',
  'gun.0': 'Endpoint Agent 手枪', 'gun.1': 'Endpoint Secure 步枪', 'gun.2': 'Endpoint Secure 步枪 Mk-II', 'gun.3': 'Endpoint Secure 步枪 Mk-III', 'inv.nade': '拒绝访问手雷', 'inv.mdr': '响应团队', 'inv.fire': '开火', 'inv.defuse': '拆除',
  'role.EDR': '主武器 · 你的枪', 'role.AF': '边界 · 封闭闸门', 'role.NDR': '可视化 · 雷达', 'role.XDR': '关联分析 · 连锁响应', 'role.HCI': '平台 · 护甲', 'role.IAG': '身份 · 手雷', 'role.ASTOR': '备份 · 一次性', 'role.MDR': '服务 · 单次呼叫',
  'b.EDR.1': '全自动步枪，30 发。终端防护是真正拦下威胁的地方，所以它就是你手里的枪。', 'b.EDR.2': '步枪 Mk-II：伤害 +25%，35 发，换弹更快。', 'b.EDR.3': '步枪 Mk-III：伤害与射速更高，每次击杀都会隔离主机——爆发波及旁边的威胁。',
  'b.AF.1': '在你选的一个闸门上部署一道防火墙。来自互联网的威胁只能绕路；你自己的火力可以向外穿过。', 'b.AF.2': '第二道防火墙：封住两个闸门，只剩一条通道要守。', 'b.AF.3': '第三道防火墙，更厚，并带有 IPS，会电击攻击它的威胁。',
  'b.NDR.1': '所有威胁都显示在雷达上，隐身的 APT 现形。没有它，你只能看到眼前的东西。', 'b.NDR.2': '透过墙壁看到威胁，并提示加密器正前往哪个据点。', 'b.NDR.3': '威胁狩猎：被它追踪的目标受到的伤害 +30%。',
  'b.XDR.1': '每次步枪击杀会连锁到另外 2 个被传感器看到的威胁。威力来自你的其他产品——单独使用很弱。', 'b.XDR.2': '响应连锁到 3 个威胁。', 'b.XDR.3': '响应连锁到 4 个威胁。',
  'b.HCI.1': '50 点护甲。护甲吸收每次伤害的一半。', 'b.HCI.2': '100 点护甲。', 'b.HCI.3': '高可用：每回合一次，致命一击会让你切换到备用节点，保留 60 生命。',
  'b.IAG.1': '每回合一枚“拒绝访问”手雷：爆炸范围内的威胁被锁定 3.6 秒。', 'b.IAG.2': '每回合两枚手雷。', 'b.IAG.3': '三枚手雷，范围更大。',
  'b.ASTOR.1': '一份快照。若加密器引爆，据点会被恢复，本回合仍算守住。触发后即消耗。',
  'b.MDR.1': '一次呼叫（X）。可在任何位置远程拆除已安放的加密器——若尚未安放，则眩晕并打击所有威胁。使用后即消耗。',
  'lim.AF': '局限：蠕虫从内部发起，零日漏洞直接穿过。', 'lim.IAG': '局限：APT 使用窃取的凭据，约 1 秒就恢复。', 'lim.XDR': '当前：{n}/7 款产品为它供数（威力 x{p}）。', 'lim.NDR': '局限：它让你看见威胁，但不会阻止威胁。', 'lim.ASTOR': '局限：奖励低于干净的胜利。', 'lim.HCI': '局限：护甲只能减半伤害。', 'lim.EDR': '局限：只能拦下你打得中的目标。', 'lim.MDR': '局限：只有一次，用完需再次购买。',
  'b.owned': '已拥有', 'b.max': '已满级', 'b.fw': '防火墙策略', 'b.fwHint': '点击闸门可移动防火墙。已部署 {n}/{m}。', 'b.fwNone': '购买 NGAF 才能封闭闸门。', 'b.gateW': '西', 'b.gateM': '中', 'b.gateE': '东', 'b.intel': '本回合情报', 'b.next': '来袭',
  'i.1': '勒索软件携带者会设法在 A 点或 B 点安放加密器。击杀它，或在引爆前拆除加密器。', 'i.2': '蠕虫从网络内部受感染的主机（绿色通风口）扩散。边界防火墙根本看不到它们。', 'i.3': '木马会还击。APT 是隐身狙击手——留意红色激光并切断视线。Cyber Command 能让它们现形。', 'i.4': '零日漏洞来袭。它没有任何特征库可匹配，会直接穿过防火墙。', 'i.5': '规模更大的联合进攻。面对成群的敌人，关联响应（XDR）最划算。', 'i.6': '两个零日漏洞加三个 APT。全力以赴。', 'i.7': '最终回合。它们倾巢而出。',
  'th.phish': '钓鱼', 'th.worm': '蠕虫', 'th.trojan': '木马', 'th.apt': 'APT', 'th.brute': '零日漏洞', 'th.carrier': '勒索软件', 'th.denied': '拒绝访问', 'th.you': '你', 'th.encryptor': '加密器已拆除', 'th.restore': '据点已恢复',
  'sign.A': 'A 点', 'sign.B': 'B 点', 'sign.soc': 'SOC', 'sign.net': '互联网', 'sign.gateW': '西闸门', 'sign.gateM': '中闸门', 'sign.gateE': '东闸门',
  'z.internet': '互联网', 'z.gate': '边界闸门', 'z.west': '西侧通道', 'z.mid': '中路', 'z.east': '东侧通道', 'z.siteA': 'A 点', 'z.siteB': 'B 点', 'z.court': '中庭', 'z.backA': 'A 点后方', 'z.backB': 'B 点后方', 'z.soc': 'SOC',
  'r.win': '回合胜利', 'r.loss': '回合失利', 'res.eliminated': '所有威胁已清除', 'res.defused': '加密器已拆除', 'res.time': '进攻超时', 'res.restored': '据点被加密——已从 aStor 快照恢复', 'res.encrypted': '据点已被加密', 'res.down': '你被击倒了', 'r.flawless': '无伤 +400',
  't.brute': '零日漏洞来袭——防火墙拦不住它', 't.aptSeen': 'Cyber Command 让一个 APT 现形', 't.aptBlind': '有隐身的东西在外面——你没有 Cyber Command', 't.dropped': '携带者被击杀——加密器掉落', 't.failover': 'HCI 故障切换——备用节点接管', 't.aptCreds': 'APT 使用了窃取的凭据——几乎没被拖住',
  't.mdrDefuse': 'MDR 团队远程拆除了加密器', 't.mdrSweep': 'MDR 响应——所有威胁受到打击', 't.planted_A': '加密器已安放在 A 点', 't.planted_B': '加密器已安放在 B 点', 't.wallDown': '一道防火墙被冲垮', 't.restored': 'aStor 已从快照恢复据点', 't.encrypted': '据点已被加密', 't.defused': '加密器已拆除',
  't.xdrAlone': 'XDR 还没有多少数据可关联——其他产品为它供能', 't.noFunds': '资金不足', 't.insider': '内部威胁——携带者已经在里面了', 't.contract': '合约完成',
  'o.victory': '据点守住了', 'o.defeat': '网络被攻破', 'o.rounds': '回合', 'o.kills': '击杀', 'o.heads': '爆头', 'o.acc': '命中率', 'o.report': '每款产品的战果',
  's.EDR': '{k} 次击杀', 's.XDR': '{k} 次连锁击杀', 's.AF': '闸门挡下 {b} 点伤害 · IPS 击杀 {k}', 's.NDR': '让 {r} 个 APT 现形', 's.HCI': '吸收 {a} 点伤害 · 故障切换 {f} 次', 's.IAG': '锁定 {s} 个威胁', 's.ASTOR': '恢复据点 {r} 次', 's.MDR': '远程拆除 {d} 次 · 击杀 {k}', 's.none': '未购买',
  'ui.again': '再来一局', 'ui.quit': '菜单', 'ui.more': '更多模式',
};
const i18n = makeI18n(EN, ZH), { t } = i18n;
const board = makeBoard({ lsKey: 'sentinel.counter.scores.v1', apiVar: '__COUNTER_API' });
const NAME_KEY = 'sentinel.arcade.name', BEST_KEY = 'sentinel.counter.best.v1';
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const CAREER_KEY = 'sentinel.counter.career.v1', DIFF_KEY = 'sentinel.counter.diff.v1';
const RANKS = [0, 1500, 4000, 8000, 14000, 22000], MEDALS = ['flawless', 'rampage', 'air', 'sweep', 'sharp', 'defuser', 'elite', 'contracts'];
const MEDAL_ICO = { flawless: '◆', rampage: '✹', air: '▲', sweep: '≡', sharp: '⌖', defuser: '✂', elite: '★', contracts: '✔' };
function career() { let c = {}; try { c = JSON.parse(ls.get(CAREER_KEY, '{}')) || {}; } catch { c = {}; } return { xp: +c.xp || 0, medals: Array.isArray(c.medals) ? c.medals : [], matches: +c.matches || 0, wins: +c.wins || 0, daily: c.daily && typeof c.daily === 'object' ? c.daily : {} }; }
const rankIdx = xp => { let i = 0; while (i < RANKS.length - 1 && xp >= RANKS[i + 1]) i++; return i; };
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
let diff = DIFF[ls.get(DIFF_KEY, 'normal')] ? ls.get(DIFF_KEY, 'normal') : 'normal', dailyMode = false;
function rankBlock(c, gained = 0) {
  const i = rankIdx(c.xp), top = i >= RANKS.length - 1, lo = RANKS[i], hi = top ? lo : RANKS[i + 1], f = top ? 1 : (c.xp - lo) / (hi - lo);
  return `<div class="cb-rank"><span class="chev r${i}">${'<i></i>'.repeat(Math.min(3, i + 1))}</span><div><b>${esc(t('rk.' + i))}${gained ? `<em>${esc(t('o.xp', { x: fmt(gained) }))}</em>` : ''}</b><div class="bar"><i style="width:${Math.round(f * 100)}%"></i></div><small>${esc(top ? t('m.maxRank') : t('m.toNext', { x: fmt(hi - c.xp), r: t('rk.' + (i + 1)) }))}</small></div></div>`;
}
function medalRow(c, fresh = []) { return `<div class="cb-medals">${MEDALS.map(m => `<span class="${c.medals.includes(m) ? 'on' : ''}${fresh.includes(m) ? ' new' : ''}" title="${esc(t('md.' + m))} - ${esc(t('md.' + m + '.d'))}"><i>${MEDAL_ICO[m]}</i><em>${esc(t('md.' + m))}</em></span>`).join('')}</div>`; }
const LINKS = [{ href: 'frame.html', label: 'Sentinel Frame' }, { href: 'stand3d.html', label: 'Sentinel Strike' }, { href: 'line.html', label: 'Breach Line' }, { href: 'index.html', label: 'Defend the Tower' }];
const LOGO = '<img class="cb-logo" src="assets/brand/sangfor-logo-white.png" alt="Sangfor" />';
const CROSS = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor"/></svg>';

const app = document.getElementById('app');
app.innerHTML = `
  <canvas id="cbCanvas"></canvas>
  <div class="cb-vig" id="cbVig"></div><div class="cb-dmg" id="cbDmg"></div>
  <div class="cb-hud" id="cbHud" hidden>
    <div class="cb-top">
      <div class="cb-team you">${LOGO}<b id="cbYou">0</b></div>
      <div class="cb-clock"><span id="cbTimer">0:00</span><small id="cbRound"></small></div>
      <div class="cb-team them"><b id="cbThem">0</b><span id="cbThemK"></span></div>
      <div class="cb-pips" id="cbPips"></div>
      <div class="cb-mut" id="cbMut" hidden></div>
    </div>
    <div class="cb-radarbox"><canvas id="cbRadar" width="320" height="320"></canvas><div class="cb-zone" id="cbZone"></div><div class="cb-money" id="cbMoney"></div><div class="cb-contract" id="cbContract"></div></div>
    <div class="cb-feed" id="cbFeed"></div>
    <div class="cb-alert" id="cbAlert" hidden></div>
    <div class="cb-low"></div><div class="cb-scope"></div>
    <div class="cb-marks" id="cbMarks"></div><div class="cb-nums" id="cbNums"></div>
    <div class="cb-cross" id="cbCross"><i></i><i></i><i></i><i></i><b></b><u id="cbHit"></u></div>
    <div class="cb-pop" id="cbPop"></div>
    <div class="cb-intro" id="cbIntro" hidden></div>
    <div class="cb-use" id="cbUse" hidden><span id="cbUseT"></span><div><i id="cbUseFill"></i></div></div>
    <div class="cb-vitals" id="cbVitals"></div>
    <div class="cb-inv" id="cbInv"></div>
    <div class="cb-ammo"><div><b id="cbMag">0</b><span>/ ∞</span></div><small id="cbGun"></small><div class="cb-reload"><i id="cbReload"></i></div></div>
    <div class="cb-banner" id="cbBanner" hidden></div>
    <div class="cb-hint" id="cbHint" hidden></div>
    <div class="cb-touch" id="cbTouch" hidden>
      <div class="cb-stick" id="cbStick"><i></i></div>
      <button class="cb-tb fire" data-t="fire"></button><button class="cb-tb use" data-t="use" hidden></button>
      <button class="cb-tb sm r" data-t="reload">R</button><button class="cb-tb sm g" data-t="nade">${MARK('IAG')}</button><button class="cb-tb sm x" data-t="mdr">${MARK('MDR')}</button>
      <button class="cb-tb jump" data-t="jump"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 4l8 9h-5v7H9v-7H4z" fill="currentColor"/></svg></button><button class="cb-tb sm crouch" data-t="crouch"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 20l-8-9h5V4h6v7h5z" fill="currentColor"/></svg></button>
    </div>
    <button class="cb-pausebtn" id="cbPause" type="button" aria-label="Pause">II</button>
  </div>
  <div class="cb-buy" id="cbBuy" hidden></div>
  <div class="cb-toasts" id="cbToasts"></div>
  <div id="cbOverlay"></div>`;
const $ = id => document.getElementById(id);
const el = Object.fromEntries(['cbCanvas', 'cbVig', 'cbDmg', 'cbHud', 'cbYou', 'cbThem', 'cbThemK', 'cbTimer', 'cbRound', 'cbPips', 'cbRadar', 'cbZone', 'cbMoney', 'cbFeed', 'cbAlert', 'cbCross', 'cbHit', 'cbUse', 'cbUseT', 'cbUseFill', 'cbVitals', 'cbInv', 'cbMag', 'cbGun', 'cbReload', 'cbBanner', 'cbHint', 'cbTouch', 'cbStick', 'cbPause', 'cbBuy', 'cbToasts', 'cbOverlay', 'cbMut', 'cbContract', 'cbMarks', 'cbNums', 'cbPop', 'cbIntro'].map(k => [k, $(k)]));
const paint = painter();
let phase = 'menu', lastSummary = null, lastResult = null, lastGain = null, touchMode = false, H = null;

const game = createCounterGame(el.cbCanvas, {
  radar: el.cbRadar, label: k => t(k),
  onHud: h => { H = h; if (phase === 'play') renderHud(h); },
  onFeed: f => { if (phase === 'play') pushFeed(f); },
  onToast: (k, kind) => { if (!k.startsWith('planted_')) toast(t('t.' + k), kind); },
  onOver: s => onOver(s),
  onEvent: (type, d) => {
    if (type === 'hit') { if (el.cbHit._k > performance.now()) return; el.cbHit.className = d ? 'on head' : 'on'; clearTimeout(el.cbHit._t); el.cbHit._t = setTimeout(() => { el.cbHit.className = ''; }, 110); }
    else if (type === 'kill') { el.cbHit._k = performance.now() + 240; el.cbHit.className = 'on kill'; clearTimeout(el.cbHit._t); el.cbHit._t = setTimeout(() => { el.cbHit.className = ''; }, 260); pop(`+$${fmt(d.reward)}`, d.hs ? t('k.head') : '', 'cash'); }
    else if (type === 'streak') pop(t('k.' + Math.min(6, d.n)), `+$${d.bonus}`, 'streak s' + Math.min(6, d.n));
    else if (type === 'num') dmgNum(d);
    else if (type === 'loot') pop(d.kind === 'patch' ? `+${d.val} HP` : `+$${fmt(d.val)}`, t('l.' + d.kind), d.kind === 'patch' ? 'heal' : 'intel');
    else if (type === 'contract') pop(t('c.done'), `+$${CONTRACT_PAY}`, 'streak s4');
    else if (type === 'round') intro(d);
    else if (type === 'hurt') { el.cbVig.style.setProperty('--vc', 'rgba(220,30,30,.55)'); pulse(el.cbVig); el.cbDmg.style.transform = `translate(-50%,-50%) rotate(${-d.angle}rad)`; pulse(el.cbDmg); }
    else if (type === 'flash') { el.cbVig.style.setProperty('--vc', d); pulse(el.cbVig); }
    else if (type === 'unlock') { if (phase === 'play') pause(); }
    else if (type === 'phase') onSimPhase(d);
  },
  onMarkers: list => drawMarkers(list),
});
// ---------- moment-to-moment feedback: pops, damage numbers, objective pointers ----------
let popSlot = 0;
function pop(big, small, cls) {
  if (phase !== 'play') return; const n = document.createElement('div'); n.className = 'cb-popi ' + cls; n.innerHTML = `<b>${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ''}`;
  if (cls.startsWith('streak')) { el.cbPop.querySelectorAll('.streak').forEach(o => o.remove()); } else { n.style.setProperty('--row', popSlot = (popSlot + 1) % 3); }
  el.cbPop.appendChild(n); setTimeout(() => n.remove(), cls.startsWith('streak') ? 1500 : 950); while (el.cbPop.children.length > 5) el.cbPop.firstChild.remove();
}
function dmgNum(d) {
  if (phase !== 'play') return; const n = document.createElement('i'); n.className = d.hs ? 'hs' : d.by !== 'EDR' && d.by !== 'EDRB' ? 'prod' : ''; n.textContent = d.d; if (COLOR[d.by] && d.by !== 'EDR') n.style.color = COLOR[d.by];
  n.style.left = (d.x * 100 + (Math.random() - .5) * 3).toFixed(1) + '%'; n.style.top = (d.y * 100).toFixed(1) + '%'; el.cbNums.appendChild(n); setTimeout(() => n.remove(), 650); while (el.cbNums.children.length > 16) el.cbNums.firstChild.remove();
}
const markEls = {};
function drawMarkers(list) {
  const seen = {};
  for (const m of list) {
    seen[m.kind] = 1; let n = markEls[m.kind]; if (!n) { n = markEls[m.kind] = document.createElement('div'); n.className = 'cb-mk ' + m.kind; n.innerHTML = '<u></u><b></b><small></small>'; el.cbMarks.appendChild(n); }
    n.hidden = false; n.style.left = (m.x * 100).toFixed(2) + '%'; n.style.top = (m.y * 100).toFixed(2) + '%'; n.classList.toggle('off', m.off); n.firstChild.style.transform = m.off ? `rotate(${m.rot}rad)` : '';
    const lab = t('mk.' + m.kind), dist = Math.round(m.dist) + ' m'; if (n.children[1].textContent !== lab) n.children[1].textContent = lab; if (n.children[2].textContent !== dist) n.children[2].textContent = dist;
  }
  for (const k in markEls) if (!seen[k]) markEls[k].hidden = true;
}
let introT = 0;
function intro(d) {
  const c = H?.contract; el.cbIntro.hidden = false; el.cbIntro.className = 'cb-intro' + (d.mut ? ' mut' : '');
  el.cbIntro.innerHTML = `<small>${esc(t('h.round', { n: d.n }))}</small><b>${esc(d.mut ? t('mu.' + d.mut) : t('h.defend'))}</b>${c ? `<span>${esc(t('c.title'))}: ${esc(t('c.' + c.id, { n: c.need }))} · +$${CONTRACT_PAY}</span>` : ''}`;
  clearTimeout(introT); introT = setTimeout(() => { el.cbIntro.hidden = true; }, 2600);
}
function pulse(n) { n.classList.remove('on'); void n.offsetWidth; n.classList.add('on'); }
function toast(msg, kind = '') { if (!msg || phase !== 'play') return; const n = document.createElement('div'); n.className = `cb-toast ${kind}`.trim(); n.textContent = msg; el.cbToasts.appendChild(n); setTimeout(() => n.remove(), 3200); while (el.cbToasts.children.length > 3) el.cbToasts.firstChild.remove(); }
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };
const pips = n => `<span class="cb-lv">${Array.from({ length: MAXLV }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

// ---------- in-round HUD ----------
function pushFeed(f) {
  const n = document.createElement('div'); n.className = 'cb-kill' + (f.bad ? ' bad' : '');
  if (f.bad) n.innerHTML = `<b class="th">${esc(t('th.' + f.a))}</b><span class="x">✕</span><b class="me">${esc(t('th.you'))}</b>`;
  else n.innerHTML = `<b class="me">${esc(f.prod === 'EDR' || f.prod === 'MDR' || f.prod === 'ASTOR' ? (ls.get(NAME_KEY, '') || t('th.you')) : NAME[f.prod])}</b>${MARK(f.prod)}${f.hs ? '<em class="hs" title="headshot">⌖</em>' : ''}<b class="th">${esc(t('th.' + f.v))}</b>`;
  el.cbFeed.appendChild(n); setTimeout(() => n.classList.add('out'), 5200); setTimeout(() => n.remove(), 5800); while (el.cbFeed.children.length > 6) el.cbFeed.firstChild.remove();
}
function invHTML(h) {
  const row = (key, id, name, extra = '', cls = '') => `<div class="cb-slot ${cls}" style="--cap:${COLOR[id]}"><span class="t"><b>${esc(name)}</b>${extra}</span>${MARK(id)}${key ? `<kbd>${key}</kbd>` : ''}</div>`;
  let s = '';
  if (h.lv.NDR) s += row('', 'NDR', NAME.NDR, pips(h.lv.NDR), 'pas');
  if (h.lv.XDR) s += row('', 'XDR', 'XDR', `<small>${esc(t('h.sensors', { n: h.sensors }))}</small>`, 'pas');
  if (h.lv.AF) s += row('', 'AF', 'NGAF', `<span class="cb-gates">${GATES.map((g, i) => { const w = h.walls.find(o => o.gate === i); return `<i class="${w ? (w.down ? 'down' : 'on') : ''}"><u style="width:${w ? Math.round(w.frac * 100) : 0}%"></u><em>${g.id}</em></i>`; }).join('')}</span>`, 'pas');
  if (h.snap) s += row('', 'ASTOR', 'aStor', `<small>${esc(t('h.snapshot'))}</small>`, 'pas');
  if (h.mdr) s += row(touchMode ? '' : 'X', 'MDR', t('inv.mdr'), `<small>${esc(t('h.oncall'))}</small>`);
  if (h.lv.IAG) s += row(touchMode ? '' : 'G', 'IAG', t('inv.nade'), `<small>x${h.nades}</small>`, h.nades ? '' : 'empty');
  s += row(touchMode ? '' : 'R', 'EDR', t('gun.' + h.lv.EDR), '', 'gun');
  return s;
}
function renderHud(h) {
  const live = h.phase === 'live' || h.phase === 'end';
  el.cbYou.textContent = h.you; el.cbThem.textContent = h.them; el.cbRound.textContent = h.phase === 'buy' ? t('h.buy') : t('h.round', { n: h.round });
  el.cbTimer.textContent = mmss(h.timer); el.cbTimer.classList.toggle('bomb', h.bomb === 'planted' && live);
  paint(el.cbPips, live ? Array.from({ length: Math.min(30, h.total) }, (_, i) => `<i class="${i < h.alive ? 'on' : ''}"></i>`).join('') : '');
  el.cbZone.textContent = t('z.' + h.zone); el.cbMoney.textContent = '$' + fmt(h.money);
  { const c = h.contract; paint(el.cbContract, c ? `<small>${esc(t('c.title'))} · +$${CONTRACT_PAY}</small><span class="${c.done ? 'done' : ''}">${esc(t('c.' + c.id, { n: c.need }))}${c.need > 1 ? ` <b>${c.have}/${c.need}</b>` : ''}${c.done ? ' <b>✔</b>' : ''}</span>` : ''); }
  el.cbMut.hidden = !(live && h.mut); if (live && h.mut) el.cbMut.textContent = t('mu.' + h.mut);
  paint(el.cbVitals, `<div class="v hp${h.hp <= 30 ? ' low' : ''}" style="--f:${Math.max(0, Math.min(100, h.hp))}%">${CROSS}<b>${h.hp}</b></div><div class="v ar${h.armor ? '' : ' off'}" style="--f:${Math.min(100, h.armor)}%">${MARK('HCI')}<b>${h.armor}</b></div>${h.failover ? `<div class="v fo">${esc(t('h.failover'))}</div>` : ''}`);
  paint(el.cbInv, invHTML(h));
  el.cbMag.textContent = h.mag; el.cbMag.classList.toggle('low', h.mag <= h.magMax * .25); el.cbGun.textContent = t('gun.' + h.lv.EDR); el.cbReload.style.width = h.reload >= 0 ? (h.reload * 100) + '%' : '0';
  const gap = 5 + h.bloom * 420; el.cbCross.style.setProperty('--gap', gap.toFixed(1) + 'px');
  let alert = '', cls = '';
  if (h.phase === 'live') {
    if (h.bomb === 'planted') { alert = t('a.planted', { s: h.site }); cls = 'bad'; }
    else if (h.bomb === 'dropped') alert = t('a.dropped');
    else if (h.bomb === 'carried' && h.siteKnown && h.plantFrac > 0) { alert = t('a.planting', { s: h.site }); cls = 'bad'; }
    else if (h.bomb === 'carried' && h.siteKnown) alert = t('a.heading', { s: h.site });
  }
  el.cbAlert.hidden = !alert; if (alert) { el.cbAlert.textContent = alert; el.cbAlert.className = 'cb-alert ' + cls; }
  const use = h.phase === 'live' && h.near; el.cbUse.hidden = !use; if (use) { el.cbUseT.textContent = h.defuse > 0 ? t('h.defusing') : t(touchMode ? 'h.useTouch' : 'h.use'); el.cbUseFill.style.width = (h.defuse * 100) + '%'; }
  const ub = el.cbTouch.querySelector('[data-t="use"]'); ub.hidden = !use; el.cbTouch.querySelector('[data-t="nade"]').hidden = !h.nades; el.cbTouch.querySelector('[data-t="mdr"]').hidden = !h.mdr;
  el.cbHud.classList.toggle('live', live); el.cbHud.classList.toggle('dead', h.hp <= 0); el.cbHud.classList.toggle('lowhp', h.phase === 'live' && h.hp > 0 && h.hp <= 30); el.cbHud.classList.toggle('ads', h.phase === 'live' && h.ads > .5); el.cbHud.classList.toggle('scoped', h.phase === 'live' && h.ads > .8 && h.lv.EDR >= 2);
  el.cbTouch.querySelector('[data-t="crouch"]').classList.toggle('on', game.touch.crouching);
  el.cbHint.hidden = !(h.phase === 'live' && !touchMode && !game.locked && h.hp > 0); if (!el.cbHint.hidden) el.cbHint.textContent = t('h.click');
  if (h.phase === 'buy') { el.cbBuyTimer && (el.cbBuyTimer.textContent = mmss(h.timer)); renderBuy(h); }
}
function onSimPhase(p) {
  el.cbBuy.hidden = p !== 'buy'; el.cbBanner.hidden = p !== 'end'; if (p !== 'live') { el.cbIntro.hidden = true; el.cbNums.innerHTML = ''; el.cbPop.innerHTML = ''; drawMarkers([]); }
  if (p === 'buy') { el.cbBuy.innerHTML = ''; buyKey = ''; el.cbFeed.innerHTML = ''; if (H) renderBuy(H); }
  if (p === 'end' && H?.last) { const l = H.last; el.cbBanner.className = 'cb-banner ' + (l.win ? 'win' : 'loss'); el.cbBanner.innerHTML = `<b>${esc(t(l.win ? 'r.win' : 'r.loss'))}</b><span>${esc(t('res.' + l.result))}</span><em>+$${fmt(l.reward)}${l.flawless ? ' · ' + esc(t('r.flawless')) : ''}</em>`; }
}

// ---------- buy menu ----------
let buyKey = '';
function cardHTML(id, h, n, rec) {
  const lv = id === 'ASTOR' ? h.snap : id === 'MDR' ? h.mdr : h.lv[id], max = LEVELED.includes(id) ? MAXLV : 1, price = game.priceOf(id), can = price != null && h.money >= price;
  const next = Math.min(max, lv + 1), lim = id === 'XDR' ? t('lim.XDR', { n: h.sensors, p: (.5 + .25 * h.sensors).toFixed(2) }) : t('lim.' + id);
  return `<button class="cb-card${price == null ? ' maxed' : can ? '' : ' poor'}${lv ? ' has' : ''}${rec && price != null ? ' rec' : ''}" data-buy="${id}" style="--cap:${COLOR[id]}" type="button">
    ${rec && price != null ? `<span class="rec">${esc(t('b.rec'))}</span>` : ''}<span class="k">${n}</span><span class="hd">${MARK(id)}<span><b>${esc(NAME[id])}</b><em>${esc(t('role.' + id))}</em></span></span>
    ${max > 1 ? pips(lv) : `<span class="cb-lv one"><i class="${lv ? 'on' : ''}"></i></span>`}
    <span class="d">${esc(t(`b.${id}.${max > 1 ? next : 1}`))}</span><span class="lim">${esc(lim)}</span>
    <span class="p">${price == null ? esc(t(max > 1 ? 'b.max' : 'b.owned')) : '$' + fmt(price)}</span></button>`;
}
function renderBuy(h) {
  const key = [h.money, h.round, h.snap, h.mdr, h.mut, h.contract?.id, h.gateSel.join(), ...LEVELED.map(id => h.lv[id]), i18n.getLang()].join('|'); if (key === buyKey) return; buyKey = key;
  const spec = { ...WAVES[Math.min(WAVES.length - 1, h.round - 1)] }, placed = h.gateSel.filter(Boolean).length, mut = h.mut, c = h.contract;
  if (mut === 'outbreak') spec.worm = (spec.worm || 0) + 6; if (mut === 'spear') spec.phish += 3; if (mut === 'ddos') spec.phish += 4;
  const rec = mut ? MUTATORS[mut].rec : h.lv.EDR ? '' : 'EDR';
  const inc = ['carrier', ...Object.keys(spec)].map(k => `<span class="cb-inc" style="--cap:${THREAT[k].color}"><b>${k === 'carrier' ? 1 : spec[k]}</b>${esc(t('th.' + k))}</span>`).join('');
  el.cbBuy.innerHTML = `<div class="cb-buy-in">
    <div class="cb-buy-h"><div><small>${esc(t('h.round', { n: h.round }))} · ${esc(t('h.firstTo', { n: WIN_AT }))}</small><b>${esc(t('h.buy'))}</b></div>
      <div class="money"><small>${esc(t('h.money'))}</small><b>$${fmt(h.money)}</b></div>
      <div class="go"><span id="cbBuyTimer">${mmss(h.timer)}</span><button class="cb-btn primary" data-act="ready" type="button">${esc(t('h.ready'))}<kbd>${esc(t('h.readyKey'))}</kbd></button></div></div>
    <div class="cb-buy-grid">${PRODUCTS.map((id, i) => cardHTML(id, h, i + 1, id === rec)).join('')}</div>
    <div class="cb-buy-f">
      <div class="cb-fw"><h4>${MARK('AF')}${esc(t('b.fw'))}</h4><div class="cb-fw-map"><span class="net">${esc(t('sign.net'))}</span>${GATES.map((g, i) => `<button type="button" class="cb-gate${h.gateSel[i] && h.lv.AF ? ' on' : ''}" data-gate="${i}" ${h.lv.AF ? '' : 'disabled'}>${esc(t('b.gate' + g.id))}</button>`).join('')}<span class="in">A · ${esc(t('z.mid'))} · B</span></div>
        <p>${esc(h.lv.AF ? t('b.fwHint', { n: placed, m: h.lv.AF }) : t('b.fwNone'))}</p></div>
      <div class="cb-intel${mut ? ' mut' : ''}"><h4>${esc(t('b.intel'))}<em>${esc(t('mu.' + (mut || 'none')))}</em></h4><p>${esc(mut ? t('mu.' + mut + '.d') : t('i.' + Math.min(7, h.round)))}</p><div class="cb-incs"><small>${esc(t('b.next'))}</small>${inc}</div></div>
      <div class="cb-ctr"><h4>${esc(t('c.title'))}<em>+$${CONTRACT_PAY}</em></h4><p>${c ? esc(t('c.' + c.id, { n: c.need })) : ''}</p></div>
    </div></div>`;
  el.cbBuyTimer = $('cbBuyTimer');
}
function tryBuy(id) {
  if (phase !== 'play' || game.state.phase !== 'buy') return; const before = H?.sensors;
  if (game.buy(id)) { snd.buy(); if (id === 'XDR' && game.state.lv.XDR === 1 && before < 2) toast(t('t.xdrAlone')); } else { snd.deny(); if (game.priceOf(id) != null) toast(t('t.noFunds'), 'bad'); }
}
el.cbBuy.addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'), g = e.target.closest('[data-gate]'), a = e.target.closest('[data-act]'); wake();
  if (b) tryBuy(b.dataset.buy); else if (g) { if (game.toggleGate(+g.dataset.gate)) snd.tick(); } else if (a?.dataset.act === 'ready') game.ready();
});

// ---------- menus ----------
function footer() { return `<div class="cb-foot"><span class="more">${esc(t('ui.more'))}: ${LINKS.map(l => `<a href="${l.href}">${esc(l.label)}</a>`).join('')}</span><span><button class="cb-ico" data-act="mute" title="${esc(t('ui.mute'))}" type="button">${soundIco(isMuted())}</button><button class="cb-ico txt" data-act="lang" type="button">${esc(t('ui.lang'))}</button></span></div>`; }
function boardBlock(b, meId) {
  const rows = b.rows?.length ? b.rows.slice(0, 6).map(r => `<li class="${r.id === meId ? 'me' : ''}"><i>${rankOf(b.rows, r.score)}</i><span>${esc(r.name)}</span><b>${fmt(r.score)}</b></li>`).join('') : `<li class="empty">${esc(t('ui.empty'))}</li>`;
  return `<div class="cb-board"><h4>${esc(t('m.board'))}<em>${esc(b.mode === 'world' ? t('ui.world') : t('ui.local'))}</em></h4><ol>${rows}</ol></div>`;
}
function hudOn(on) { el.cbHud.hidden = !on; if (!on) { el.cbBuy.hidden = true; el.cbBanner.hidden = true; } }
async function showMenu() {
  phase = 'menu'; game.stop(); hudOn(false); el.cbToasts.innerHTML = '';
  const b = await board.fetchBoard(); if (phase !== 'menu') return; const c = career(), best = c.daily.date === today() ? c.daily.best : 0;
  el.cbOverlay.innerHTML = `<div class="cb-menu"><div class="cb-panel">
    <div class="cb-brand">${LOGO}<span>SENTINEL</span></div>
    <h1>COUNTER<em>-BREACH</em></h1>
    <p class="tag">${esc(t('m.tag', { n: WIN_AT }))}</p>
    ${rankBlock(c)}
    <label>${esc(t('m.name'))}<input id="nameIn" maxlength="14" placeholder="${esc(t('ui.namePh'))}" value="${esc(ls.get(NAME_KEY, ''))}" /></label>
    <div class="cb-diff"><small>${esc(t('d.label'))}</small><div>${Object.keys(DIFF).map(k => `<button type="button" data-diff="${k}" class="${k === diff ? 'on' : ''}">${esc(t('d.' + k))}</button>`).join('')}</div><p>${esc(t('d.' + diff + '.d'))}</p></div>
    <div class="cb-row"><button class="cb-btn primary big" data-act="play" type="button">${esc(t('m.play'))}</button><button class="cb-btn big daily" data-act="daily" type="button" title="${esc(t('m.dailyD'))}">${esc(t('m.daily'))}</button></div>
    <p class="dailyline">${esc(t('m.dailyD'))}${best ? ' ' + esc(t('m.dailyBest', { s: fmt(best) })) : ''}</p>
    <ol class="how">${[1, 2, 3, 4].map(i => `<li>${esc(t('m.h' + i))}</li>`).join('')}</ol>
    <div class="keys"><h4>${esc(t('m.keys'))}</h4><p>${esc(t('m.k1'))}</p><p>${esc(t('m.k2'))}</p><p>${esc(t('m.k4'))}</p><p>${esc(t('m.k3'))}</p></div>
    <div class="loadout">${PRODUCTS.map(id => `<span style="--cap:${COLOR[id]}" title="${esc(t('role.' + id))}">${MARK(id)}<em>${esc(NAME[id])}</em></span>`).join('')}</div>
    <h4>${esc(t('m.medals'))}<em>${c.medals.length}/${MEDALS.length}</em></h4>${medalRow(c)}
    ${boardBlock(b)}${footer()}</div></div>`;
}
function statLine(id, s) {
  const st = s.stats[id] || {}, own = id === 'ASTOR' ? st.restores > 0 : id === 'MDR' ? (st.defuses + st.kills) > 0 : id === 'EDR' ? true : s.lv[id] > 0; if (!own) return t('s.none');
  return t('s.' + id, { k: fmt(st.kills || 0), b: fmt(st.blocked || 0), r: st.revealed ?? st.restores ?? 0, a: fmt(st.absorbed || 0), f: st.failovers || 0, s: st.stuns || 0, d: st.defuses || 0 });
}
function renderOver(s, result) {
  el.cbOverlay.innerHTML = `<div class="cb-menu over"><div class="cb-panel wide">
    <div class="cb-brand">${LOGO}<span>SENTINEL · COUNTER-BREACH${dailyMode ? ' · ' + esc(t('o.daily')) : ''}</span></div>
    <h1 class="${s.outcome}">${esc(t('o.' + s.outcome))}</h1>
    <div class="cb-final"><b class="you">${s.you}</b><span>:</span><b class="them">${s.them}</b><div class="hist">${s.history.map(h => `<i class="${h.win ? 'w' : 'l'}" title="${esc(t('res.' + h.result))}">${h.round}</i>`).join('')}</div></div>
    <div class="cb-score"><small>${esc(t('ui.score'))}</small><b>${fmt(s.score)}</b>${result ? `<em>${esc(t('ui.youRank'))}${result.rank} · ${esc(result.mode === 'world' ? t('ui.world') : t('ui.local'))}</em>` : ''}</div>
    ${lastGain ? rankBlock(career(), lastGain.xp) : ''}${lastGain?.rankUp ? `<div class="cb-promo">${esc(t('o.rankUp', { r: t('rk.' + lastGain.rank) }))}</div>` : ''}
    ${lastGain?.medals.length ? `<h4>${esc(t('o.newMedal'))}</h4>${`<div class="cb-medals fresh">${lastGain.medals.map(m => `<span class="on new"><i>${MEDAL_ICO[m]}</i><em>${esc(t('md.' + m))}</em><small>${esc(t('md.' + m + '.d'))}</small></span>`).join('')}</div>`}` : ''}
    <div class="cb-meta"><span><small>${esc(t('o.kills'))}</small><b>${s.kills}</b></span><span><small>${esc(t('o.heads'))}</small><b>${s.heads}</b></span><span><small>${esc(t('o.acc'))}</small><b>${Math.round(s.acc * 100)}%</b></span><span><small>${esc(t('o.streak'))}</small><b>${s.maxStreak || 0}</b></span><span><small>${esc(t('o.contracts'))}</small><b>${s.contracts || 0}</b></span><span><small>${esc(t('d.label'))}</small><b class="sm">${esc(t('d.' + (s.diff || 'normal')))}</b></span></div>
    <h4>${esc(t('o.report'))}</h4>
    <table class="cb-sb">${PRODUCTS.map(id => `<tr class="${statLine(id, s) === t('s.none') ? 'off' : ''}" style="--cap:${COLOR[id]}"><td>${MARK(id)}</td><td><b>${esc(NAME[id])}</b>${LEVELED.includes(id) ? pips(s.lv[id]) : ''}</td><td>${esc(statLine(id, s))}</td></tr>`).join('')}</table>
    <div class="cb-row"><button class="cb-btn" data-act="quit" type="button">${esc(t('ui.quit'))}</button><button class="cb-btn primary" data-act="again" type="button">${esc(t('ui.again'))}</button></div>
    ${result ? boardBlock(result, result.id) : ''}${footer()}</div></div>`;
}
async function onOver(s) {
  phase = 'over'; lastSummary = s; lastResult = null; hudOn(false);
  { // career: XP, rank and medals persist between matches
    const c = career(), before = rankIdx(c.xp), win = s.outcome === 'victory', xp = Math.round(s.score / 10) + (win ? 200 : 50);
    const earned = { flawless: s.flawless > 0, rampage: s.maxStreak >= 5, air: s.airKills > 0, sweep: win && s.them === 0, sharp: s.heads >= 10, defuser: s.defuses > 0, elite: win && s.diff === 'hard', contracts: s.contracts >= 3 };
    const fresh = MEDALS.filter(m => earned[m] && !c.medals.includes(m)); c.xp += xp; c.medals.push(...fresh); c.matches++; if (win) c.wins++;
    if (dailyMode) { const d = today(); c.daily = { date: d, best: Math.max(c.daily.date === d ? c.daily.best || 0 : 0, s.score) }; }
    ls.set(CAREER_KEY, JSON.stringify(c)); lastGain = { xp, medals: fresh, rankUp: rankIdx(c.xp) > before, rank: rankIdx(c.xp) };
  }
  if (s.score > (+ls.get(BEST_KEY, 0) || 0)) ls.set(BEST_KEY, String(s.score)); renderOver(s, null);
  const result = await board.submitScore({ name: ls.get(NAME_KEY, '') || 'Anonymous', score: s.score, note: `${s.you}-${s.them} · ${s.kills} kills · ${s.heads} headshots · ${s.diff}${dailyMode ? ' · daily' : ''}` });
  if (phase !== 'over' || lastSummary !== s) return; lastResult = result; renderOver(s, result);
}
function play(daily = dailyMode) {
  const name = ($('nameIn')?.value || '').trim(); if (name) ls.set(NAME_KEY, name); dailyMode = !!daily;
  resumeAudio(); wake(); el.cbOverlay.innerHTML = ''; el.cbToasts.innerHTML = ''; el.cbFeed.innerHTML = ''; phase = 'play'; hudOn(true); el.cbThemK.textContent = t('h.threats'); game.start(dailyMode ? today() : undefined, { diff });
}
function pause() {
  if (phase !== 'play' || game.phase !== 'play') return; game.pause();
  el.cbOverlay.innerHTML = `<div class="cb-menu pause"><div class="cb-panel small"><h1>${esc(t('h.paused'))}</h1><button class="cb-btn primary big" data-act="resume" type="button">${esc(t('h.resume'))}</button><button class="cb-btn" data-act="quit" type="button">${esc(t('h.quit'))}</button><div class="keys"><h4>${esc(t('m.keys'))}</h4><p>${esc(t('m.k1'))}</p><p>${esc(t('m.k2'))}</p><p>${esc(t('m.k4'))}</p></div>${footer()}</div></div>`;
}
function resume() { if (game.phase === 'paused') { el.cbOverlay.innerHTML = ''; game.resume(); } }
function rerender() { game.relabel(); el.cbThemK.textContent = t('h.threats'); if (phase === 'over' && lastSummary) renderOver(lastSummary, lastResult); else if (phase === 'menu') showMenu(); else if (game.phase === 'paused') { game.resume(); pause(); } }
el.cbOverlay.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const df = e.target.closest('[data-diff]')?.dataset.diff; if (df && DIFF[df]) { diff = df; ls.set(DIFF_KEY, df); const nm = $('nameIn')?.value; if (nm != null) ls.set(NAME_KEY, nm.trim()); showMenu(); return; }
  if (!act) return;
  if (act === 'play') play(false); else if (act === 'daily') play(true); else if (act === 'again') play(); else if (act === 'quit') showMenu(); else if (act === 'resume') resume();
  else if (act === 'lang') { i18n.toggleLang(); rerender(); } else if (act === 'mute') { setMuted(!isMuted()); rerender(); }
});
el.cbPause.addEventListener('click', pause);
window.addEventListener('keydown', e => {
  if (e.target?.tagName === 'INPUT') { if (e.key === 'Enter' && phase === 'menu') play(false); return; }
  if (phase === 'play' && game.phase === 'play' && game.state.phase === 'buy') { if (e.key >= '1' && e.key <= '8') tryBuy(PRODUCTS[+e.key - 1]); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); game.ready(); } }
  if (e.key === 'p' || e.key === 'P') { if (game.phase === 'paused') resume(); else pause(); }
  else if (e.key === 'Escape' && phase === 'play') { if (game.phase === 'paused') resume(); else if (!game.locked) pause(); }
  else if (e.key === 'Enter' && (phase === 'menu' || phase === 'over')) play(phase === 'over' ? dailyMode : false);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- touch controls ----------
function enableTouch() { if (touchMode) return; touchMode = true; game.touch.enable(); el.cbTouch.hidden = false; document.body.classList.add('touch'); }
window.addEventListener('touchstart', enableTouch, { passive: true, once: true });
{ let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0; const knob = el.cbStick.firstElementChild;
  el.cbTouch.addEventListener('pointerdown', e => {
    const btn = e.target.closest('[data-t]'); wake();
    if (btn) { const k = btn.dataset.t; if (k === 'fire') game.touch.fire(true); else if (k === 'use') game.touch.use(true); else if (k === 'crouch') game.touch.crouch(!game.touch.crouching); else game.touch.tap(k); btn.setPointerCapture?.(e.pointerId); e.preventDefault(); return; }
    if (e.clientX < innerWidth * .42 && stickId == null) { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; el.cbStick.style.left = sx + 'px'; el.cbStick.style.top = sy + 'px'; el.cbStick.classList.add('on'); }
    else if (lookId == null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
  });
  el.cbTouch.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { let dx = (e.clientX - sx) / 46, dy = (e.clientY - sy) / 46; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } game.touch.move(dx, dy); knob.style.transform = `translate(${dx * 30}px,${dy * 30}px)`; }
    else if (e.pointerId === lookId) { game.touch.look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; }
  });
  const up = e => {
    const btn = e.target.closest?.('[data-t]'); if (btn) { if (btn.dataset.t === 'fire') game.touch.fire(false); if (btn.dataset.t === 'use') game.touch.use(false); }
    if (e.pointerId === stickId) { stickId = null; game.touch.move(0, 0); knob.style.transform = ''; el.cbStick.classList.remove('on'); } if (e.pointerId === lookId) lookId = null;
  };
  el.cbTouch.addEventListener('pointerup', up); el.cbTouch.addEventListener('pointercancel', up); }

showMenu();
window.__counter = { game, board, i18n, PRODUCTS, GUN };
