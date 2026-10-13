// Sophia — the guide. Milestone 1 uses carefully authored, event-triggered hints.
// Each hint is LAYERED: `dir` gives a direction first; `more` explains the reasoning
// only if the player asks for more. Hints never make the decision for the player.
//
// Live LLM integration (e.g. Sangfor Security GPT) is an optional later stage; the
// data shape here (a list of {dir, more}) is designed to be swappable for model output.

export const HINTS = {
  intro: {
    dir:  { en: "Start by giving yourself eyes. You can't defend what you can't see — pick a capability from the left and place it on a glowing slot.", zh: '先让自己“看得见”。看不见就守不住——从左侧选一个能力，放到发光的部署位上。' },
    more: { en: "Different products reveal different things: AF watches the entrance, NDR watches the corridors, EDR watches inside a room, IAG watches the way out. No single one sees everything.", zh: '不同产品揭示不同的东西：AF 看入口，NDR 看走廊，EDR 看房间内部，IAG 看出口。没有任何单一产品能看见全部。' },
  },
  noSensors: {
    dir:  { en: "You're flying blind right now. Deploy at least one sensor so the Signal Feed starts filling up.", zh: '你现在是“盲打”。至少部署一个传感能力，右侧的信号流才会开始有内容。' },
    more: { en: "NDR is a strong first buy — one deployment gives you movement visibility across the whole building. AF at the perimeter gives you an early, loud warning at the door.", zh: 'NDR 是很好的第一选择——部署一次即可获得全楼的移动可见性。而把 AF 放在边界，能在大门口给你最早、最响亮的预警。' },
  },
  exploitBlocked: {
    dir:  { en: "Nice — AF just blocked an intrusion at the perimeter and told you about it. But don't relax: a determined attacker will look for another way in.", zh: '不错——AF 刚在边界拦下了一次入侵，并把它告诉了你。但别松懈：有备而来的攻击者会去找别的入口。' },
    more: { en: "Perimeter defense buys time and gives early warning, it isn't the whole answer. This is why defense-in-depth matters — pair AF with visibility inside the building.", zh: '边界防御能争取时间、提供预警，但并非全部答案。这正是“纵深防御”的意义——把 AF 与楼内的可见性配合使用。' },
  },
  firstClueWeak: {
    dir:  { en: "That's a weak signal — one sensor saw something odd, but on its own it's just a hint. Watch whether it repeats or shows up elsewhere.", zh: '这是一个弱信号——单个传感器发现了异常，但仅凭它只是一个提示。留意它会不会重复，或在别处再次出现。' },
    more: { en: "One clue is easy to dismiss. The real power comes from correlating several — that's exactly what XDR does. Two different clue types about the same incident become a confident lead.", zh: '单个线索很容易被忽略。真正的力量来自把多个线索关联起来——这正是 XDR 做的事。同一事件的两类不同线索，就能汇成一个可靠的判断。' },
  },
  needCorrelate: {
    dir:  { en: "You now have clues of more than one kind. A Command Room (XDR) could tie them into one confirmed incident and show you where the attacker is.", zh: '你现在已经有不止一类线索了。部署指挥中心（XDR）可以把它们关联成一起已确认事件，并告诉你攻击者在哪里。' },
    more: { en: "Without correlation you're guessing which room to act on, and acting on the wrong room disrupts the business. XDR (and MDR analysts) turn scattered weak signals into a decision you can trust.", zh: '没有关联，你只能猜该处置哪个房间，而处置错房间会干扰业务。XDR（以及 MDR 专家）能把零散的弱信号变成你可以信赖的决策。' },
  },
  confirmed: {
    dir:  { en: "Incident confirmed. You can see the attacker's location now. If you have EDR in that room, isolate it to cut the attacker off.", zh: '事件已确认。你现在能看见攻击者的位置了。如果那个房间里有 EDR，就隔离它，切断攻击者的通路。' },
    more: { en: "Isolation (an EDR response) contains the host where the attacker is. Contain them before they reach the Vault and you stop the breach. No EDR there? You may need to place one, or let MDR assist.", zh: '隔离（EDR 的处置动作）会封控攻击者所在的主机。赶在他们进入金库之前完成遏制，就能阻止入侵。那里没有 EDR？你可能需要补一个，或让 MDR 协助处置。' },
  },
  ransomLock: {
    dir:  { en: "A room was just locked by ransomware — business uptime is dropping. If you have aStor, use it to recover that room.", zh: '有一个房间刚被勒索软件锁定——业务在线率正在下降。如果部署了 aStor，就用它恢复这个房间。' },
    more: { en: "EDR in a room stops ransomware before it detonates (bait-file honeypots, ~3-second kill). aStor is the safety net after the fact: its backups restore a locked room. Prevention plus recovery.", zh: '房间里的 EDR 能在勒索软件引爆前就阻断它（诱饵文件蜜罐，约 3 秒处置）。aStor 则是事后的安全网：用备份恢复被锁定的房间。预防加恢复，缺一不可。' },
  },
  exfilImminent: {
    dir:  { en: "The attacker has reached the Data Vault. The last gate is the Outbound Gateway — IAG there can block the data from leaving (DLP).", zh: '攻击者已经到达数据金库。最后一道闸门是出口网关——那里的 IAG 可以用 DLP 阻止数据外发。' },
    more: { en: "If you can't contain them in time, IAG is your final safety net against exfiltration. But relying only on the last gate is risky — ideally you'd have contained the attacker long before here.", zh: '如果来不及遏制，IAG 就是防外泄的最后一道安全网。但只靠最后一道闸门很冒险——理想情况下，你早该在抵达这里之前就遏制住攻击者。' },
  },
};

export function getHint(id) { return HINTS[id] || null; }
