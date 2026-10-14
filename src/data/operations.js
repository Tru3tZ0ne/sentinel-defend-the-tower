// Illustrative game rules, not product performance promises or a live AI integration.
export const OPERATIONS = {
  HCI: { name: 'Sangfor HCI', icon: 'astor', cost: 4, room: 'server',
    text: { en: 'Reserve failover capacity before the incident. Reduces host-failure impact and encryption downtime; does not stop malware.', zh: '事件前预留故障转移容量，降低主机故障影响与加密停机损失，不阻止恶意软件。' } },
  ADC: { name: 'Sangfor ADC', icon: 'af', cost: 3, room: 'server',
    text: { en: 'Distribute application load. Mitigates this scenario’s traffic surge; not unlimited DDoS protection.', zh: '分发应用负载，缓解本场景中的流量激增，并非无限抗 DDoS 防护。' } },
  SASE: { name: 'Sangfor SASE', icon: 'iag', cost: 4, room: 'l2-finance',
    text: { en: 'Prepare scoped remote access before the incident. Rejects the unauthorized session, forcing a slower local route.', zh: '事件前设置限定范围的远程访问策略，拒绝未授权会话，迫使攻击者改走更慢的本地路径。' } },
  AICP: { name: 'AICP + Agent Builder', icon: 'sophia', cost: 3, room: 'soc',
    text: { en: 'Run a local scripted helper: notify on correlated evidence, or recover prepared snapshots. Requires XDR or aStor respectively. No external AI call.', zh: '运行本地规则助手：关联证据后提醒，或恢复已准备的快照；分别依赖 XDR 或 aStor，不调用外部 AI。' } },
};
