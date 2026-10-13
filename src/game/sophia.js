// Sophia — the guide. Layered, event-triggered hints that point at the BUILDING first,
// then explain the product and reasoning, without solving the incident for the player.
// Authored for Milestone 2; shape (dir/more) is swappable for live Security-GPT output later.

export const HINTS = {
  // ---- prep phase (no clock) ----
  welcome: {
    dir:  { en: "Welcome to Meridian Tower. Take a moment — drag to look around, and click a room, a desk, or a person to inspect it. No clock is running yet.", zh: '欢迎来到子午大厦。先别急——拖动视角四处看看，点击房间、工位或人物即可查看详情。此刻还没有计时。' },
    more: { en: "The crown-jewel records live in the Data Room across the floor. Attackers want to reach it. Your job is to see them coming and stop them before they do.", zh: '最核心的数据记录存放在这层楼另一侧的数据中心，攻击者正是冲它而来。你的任务，是抢在他们得手之前发现并阻止他们。' },
  },
  deployFirst: {
    dir:  { en: "Give yourself eyes before the day begins. Pick a capability from the tray and place it in the building — try a sensor on the network, or screening at the entrance.", zh: '在这一天开始前，先让自己“看得见”。从下方选择一个能力部署到楼里——比如在网络上放一个传感器，或在入口做安检。' },
    more: { en: "Each product reveals something different: AF watches the entrance, NDR watches movement between areas, EDR watches a single workstation, IAG watches the way out. No single tool sees everything — that's the point.", zh: '每种产品揭示的东西不同：AF 看入口，NDR 看区域间的移动，EDR 看单台工作站，IAG 看出口。没有任何单一工具能看见全部——这正是关键。' },
  },
  readyToBegin: {
    dir:  { en: "Whenever you feel set up, press “Begin the day”. The pressure will come from the incident, not from me — you can keep deploying once it starts.", zh: '准备好了，就按“开始这一天”。压力来自接下来的事件，而不是我——开始后你仍然可以继续部署。' },
    more: { en: "A balanced start is one sensor for movement (NDR), one or two protected endpoints (EDR) near valuable areas, and a way to confirm what you see (XDR). But experiment — try your own strategy.", zh: '一个均衡的开局：一个看移动的传感器（NDR）、一两台靠近重要区域的受保护终端（EDR），再加一个能帮你确认判断的手段（XDR）。当然，尽管尝试你自己的打法。' },
  },

  // ---- incident ----
  incidentStart: {
    dir:  { en: "The day has begun. Staff are arriving and working normally. Watch the Signal Feed — and the building — for anything that stands out.", zh: '这一天开始了。员工陆续到岗、照常工作。留意信号流——也留意楼里的动静——看有没有异常之处。' },
    more: { en: "A real intruder won't look obviously different from an employee at first. You'll notice them through the traces your tools pick up, not by how they look.", zh: '真正的入侵者一开始并不会和员工有明显不同。你会通过工具捕捉到的痕迹发现他，而不是靠外表。' },
  },
  firstClue: {
    dir:  { en: "There's your first signal — see the marker that just appeared in the building? Click it, and the room under it, to understand what was seen.", zh: '第一个信号出现了——看到楼里刚冒出的那个标记了吗？点它，再点它下面的房间，弄清楚究竟看到了什么。' },
    more: { en: "One clue on its own is easy to dismiss. Its real value comes when it lines up with another kind of clue — that's what a command center (XDR) is for.", zh: '单个线索很容易被忽略。它真正的价值，在于与另一类线索相互印证——这正是指挥中心（XDR）的用处。' },
  },
  afBlocked: {
    dir:  { en: "Nice — AF blocked an intrusion at the entrance and flagged it. But stay alert: a determined actor will look for another way in.", zh: '不错——AF 在入口拦下了一次入侵并发出了告警。但别松懈：有备而来的攻击者会去找别的入口。' },
    more: { en: "Perimeter screening buys time and gives early warning; it isn't the whole answer. Pair it with visibility inside the building — that's defense-in-depth.", zh: '边界安检能争取时间、提供预警，但并非全部答案。要与楼内的可见性配合——这就是纵深防御。' },
  },
  needCorrelate: {
    dir:  { en: "You now have more than one kind of clue. A command console (XDR) in the Security Office could tie them together and show you exactly where the actor is.", zh: '你现在已经有不止一类线索了。安防办公室里的指挥控制台（XDR）可以把它们串起来，精确告诉你攻击者在哪。' },
    more: { en: "Without correlation you're guessing which room to act on — and acting on the wrong area disrupts the business. XDR (and MDR analysts) turn scattered weak signals into a decision you can trust.", zh: '没有关联，你只能猜该处置哪个房间——处置错区域会干扰业务。XDR（以及 MDR 专家）能把零散的弱信号变成你可以信赖的决策。' },
  },
  confirmed: {
    dir:  { en: "Incident confirmed — the actor is marked in the building now. If a protected workstation (EDR) is where they are, isolate that device to cut them off.", zh: '事件已确认——攻击者已在楼里被标记出来。如果他所在的位置有受保护的工作站（EDR），就隔离那台设备，切断他的通路。' },
    more: { en: "Isolating a device is precise and keeps the rest of the business running. Locking down a whole area also works, but it disrupts the people there — use it when you can't be precise.", zh: '隔离单台设备既精准，又能让其余业务照常运转。封锁整个区域也有效，但会打扰该区域的人——在无法精准处置时再用。' },
  },
  ransomLock: {
    dir:  { en: "A room just locked up — ransomware. Business uptime is dropping. If you prepared aStor snapshots beforehand, you can restore that room.", zh: '有个房间刚被锁住——勒索软件。业务在线率正在下降。如果你事先准备了 aStor 快照，就能恢复这个房间。' },
    more: { en: "EDR on that endpoint could have stopped the encryption before it ran. aStor only helps if its protected snapshots were set up in advance — recovery is a fallback, not a magic undo.", zh: '那台终端上的 EDR 本可在加密发生前就将其阻断。aStor 只有在事先配置了受保护快照时才能帮上忙——恢复是兜底，而非一键撤销。' },
  },
  exfilSoon: {
    dir:  { en: "The actor has reached the Data Room. The last gate is the mailroom exit — a checkpoint (IAG) there can stop the data from leaving.", zh: '攻击者已到达数据中心。最后一道闸门是收发室出口——那里的检查点（IAG）可以阻止数据外发。' },
    more: { en: "IAG is your final safety net against exfiltration, but relying on the last gate is risky — ideally you'd have contained the actor well before here.", zh: 'IAG 是防外泄的最后一道安全网，但只靠最后一道闸门很冒险——理想情况下，你早该在抵达这里之前就遏制住攻击者。' },
  },
};

export function getHint(id) { return HINTS[id] || null; }
