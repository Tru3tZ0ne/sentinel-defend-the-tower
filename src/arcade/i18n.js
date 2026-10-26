// Shared bilingual (EN / 中文) strings for the Sentinel quick-play arcade games,
// plus a tiny i18n factory so each game can add its own keys. Language choice is
// shared across the whole suite via localStorage ('sentinel.lang').
//
// GOTCHA (whole project): straight ASCII quotes/apostrophes only in EN strings —
// curly ones render full-width next to the CJK font stack.

const LANG_KEY = 'sentinel.lang';

const COMMON = {
  en: {
    'ui.play': 'Play',
    'ui.start': 'Start',
    'ui.again': 'Play again',
    'ui.quit': 'Quit',
    'ui.back': 'Back',
    'ui.how': 'How to play',
    'ui.name': 'Agent name',
    'ui.namePh': 'Enter your name',
    'ui.best': 'Best',
    'ui.score': 'Score',
    'ui.rank': 'Rank',
    'ui.world': 'WORLD',
    'ui.local': 'THIS DEVICE',
    'ui.board': 'World ranking',
    'ui.empty': 'No scores yet. Be the first.',
    'ui.share': 'Copy result',
    'ui.copied': 'Copied!',
    'ui.youRank': 'You placed #',
    'ui.newBest': 'New personal best!',
    'ui.lang': '中文',
    'ui.mute': 'Mute',
    'ui.suite': 'Part of the Sentinel security game suite',
    'ui.more': 'More modes',
    'ui.sangfor': 'A Sangfor presales demo',
  },
  zh: {
    'ui.play': '开始',
    'ui.start': '开始',
    'ui.again': '再来一局',
    'ui.quit': '退出',
    'ui.back': '返回',
    'ui.how': '玩法',
    'ui.name': '特工代号',
    'ui.namePh': '输入你的名字',
    'ui.best': '最高',
    'ui.score': '得分',
    'ui.rank': '排名',
    'ui.world': '全球',
    'ui.local': '本机',
    'ui.board': '世界排行榜',
    'ui.empty': '暂无记录，抢占第一名。',
    'ui.share': '复制成绩',
    'ui.copied': '已复制！',
    'ui.youRank': '你排名第 ',
    'ui.newBest': '新的个人纪录！',
    'ui.lang': 'EN',
    'ui.mute': '静音',
    'ui.suite': 'Sentinel 安全游戏合集的一部分',
    'ui.more': '更多模式',
    'ui.sangfor': '深信服售前演示',
  },
};

let lang = 'en';
try { const s = localStorage.getItem(LANG_KEY); if (s === 'en' || s === 'zh') lang = s; } catch { /* ignore */ }

export function makeI18n(extraEN = {}, extraZH = {}) {
  const dict = {
    en: { ...COMMON.en, ...extraEN },
    zh: { ...COMMON.zh, ...extraZH },
  };
  const t = (k, vars) => {
    let s = (dict[lang] && dict[lang][k]) ?? dict.en[k] ?? k;
    if (vars) for (const key in vars) s = s.replace(new RegExp(`\\{${key}\\}`, 'g'), vars[key]);
    return s;
  };
  return {
    t,
    getLang: () => lang,
    setLang: l => { lang = (l === 'zh' ? 'zh' : 'en'); try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ } },
    toggleLang() { this.setLang(lang === 'en' ? 'zh' : 'en'); return lang; },
  };
}
