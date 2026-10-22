/* =========================================================
   core/store.js —— 存档 / 数值模型 / 关卡曲线
   从 cyber-pets/jianghu.js 移植：去掉 DOM，存档改走 wx.setStorageSync
   ========================================================= */
const D = require('../data.js');

const FIGURES = D.FIGURES;
const FIG_ALL = FIGURES.filter(s => !s.nc);
const FIG_MAP = {};
FIGURES.forEach(s => { FIG_MAP[s.id] = s; });

const SCHOOL = {
  fist: { full: '拳掌', short: '拳', col: '#d4b060', desc: '近身缠斗，血厚防高' },
  blade: { full: '刀法', short: '刀', col: '#d1495b', desc: '流血叠加，越打越痛' },
  sword: { full: '剑法', short: '剑', col: '#6fb4e8', desc: '专攻残血，收割收尾' },
  art: { full: '术法', short: '术', col: '#a58be0', desc: '群伤控制，驱散增益' },
  heal: { full: '辅佐', short: '辅', col: '#4fbf87', desc: '治疗群增益，续航核心' },
};
const CLASS2SCHOOL = {
  hard: 'fist', rush: 'fist',
  frenzy: 'blade', stab: 'blade',
  snipe: 'sword',
  stunt: 'art',
  lead: 'heal', witness: 'heal',
};
const TIER_BASE = { R: 1.0, SR: 1.18, SSR: 1.42, UR: 1.72 };
const STAR_CAP = { R: 3, SR: 4, SSR: 5, UR: 5 };
/* 开局六人：前排拳/拳/刀扛伤，后排剑/术/辅输出与治疗 */
const STARTER = ['niuge', 'dingzhen', 'zhouzhou', 'diaoyu', 'mabaoguo', 'baize'];

const SAVE_KEY = 'jh-save-v1';
let S = null;

/* ---------- 存档适配：小程序 wx / Node 测试注入 ---------- */
const adapter = {
  get: function () {
    try { if (typeof wx !== 'undefined' && wx.getStorageSync) return wx.getStorageSync(SAVE_KEY) || null; } catch (e) { }
    return adapter._mem || null;
  },
  set: function (v) {
    adapter._mem = v;
    try { if (typeof wx !== 'undefined' && wx.setStorageSync) wx.setStorageSync(SAVE_KEY, v); } catch (e) { }
  },
};

function defaultSave() {
  return {
    gold: 0, exp: 0, tic: 20,
    heroes: {},
    team: [null, null, null, null, null, null], // 0-2 前排 / 3-5 后排
    stage: 1, maxStage: 1,
    lastIdle: Date.now(),
    wins: 0, fights: 0,
    speed: 2, free10: true,
  };
}
function load() {
  let raw = null;
  try { raw = adapter.get(); } catch (e) { }
  S = raw ? Object.assign(defaultSave(), raw) : defaultSave();
  if (!S.heroes || !Object.keys(S.heroes).length) {
    S.heroes = S.heroes || {};
    STARTER.forEach(id => { if (FIG_MAP[id]) grant(id); });
    S.team = STARTER.slice(0, 6);
    S.free10 = true;
  }
  return S;
}
function save() { try { adapter.set(S); } catch (e) { } }
function reset() { adapter.set(null); adapter._mem = null; S = null; return load(); }
function state() { return S; }

function grant(id) {
  if (!S.heroes[id]) { S.heroes[id] = { lv: 1, star: 0, exp: 0 }; return 'new'; }
  S.heroes[id].star = Math.min(STAR_CAP[FIG_MAP[id].tier], S.heroes[id].star + 1);
  return 'star';
}
function owned() { return FIG_ALL.filter(s => S.heroes[s.id]); }
function schoolOf(id) { return CLASS2SCHOOL[FIG_MAP[id].class] || 'fist'; }

/* ---------- 数值 ---------- */
function heroStat(id) {
  const f = FIG_MAP[id], h = S.heroes[id];
  const m = TIER_BASE[f.tier] * Math.pow(1.085, h.lv - 1) * (1 + h.star * .28);
  const st = f.stats;
  return {
    hpMax: Math.round((st.耐 * 5.4 + 180) * m),
    atk: Math.round((st.力 * .82 + st.宝 * .38 + 12) * m),
    def: Math.round((st.耐 * .52 + 8) * m),
    spd: Math.round(st.敏 * .6 + st.幸 * .18 + 18),
    crit: Math.min(.55, .04 + st.幸 * .0035 + h.star * .012),
    heal: Math.round((st.魔 * .5 + st.宝 * .22 + 6) * m),
    school: schoolOf(id), name: f.name, lv: h.lv, star: h.star, tier: f.tier, id,
  };
}
function power(id) {
  const s = heroStat(id);
  return Math.round(s.hpMax * .5 + s.atk * 3.2 + s.def * 2.4 + s.heal * 1.6 + s.spd * 1.2);
}
function teamPower() {
  return S.team.filter(Boolean).reduce((a, id) => a + power(id), 0);
}
/* 流派共鸣：同流派 2/3/4+ 人分别 +8% / +15% / +24% */
function resonance() {
  const cnt = {};
  S.team.filter(Boolean).forEach(id => { const s = schoolOf(id); cnt[s] = (cnt[s] || 0) + 1; });
  const parts = Object.keys(cnt).filter(k => cnt[k] >= 2);
  const add = parts.reduce((a, k) => a + (cnt[k] >= 4 ? .24 : cnt[k] === 3 ? .15 : .08), 0);
  return { parts, add: Math.min(.5, add) };
}

/* ---------- 养成成本 ---------- */
function trainCost(id) {
  const h = S.heroes[id] || { lv: 1, star: 0 };
  return { gold: Math.round(40 * Math.pow(1.24, h.lv)), exp: Math.round(30 * Math.pow(1.22, h.lv)) };
}
function breakCost(id) {
  const h = S.heroes[id] || { lv: 1, star: 0 };
  return { gold: Math.round(260 * Math.pow(1.85, h.star)), exp: Math.round(200 * Math.pow(1.8, h.star)) };
}

/* ---------- 关卡曲线 ---------- */
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function foeM(n) { return 0.94 + Math.min(.32, n / 62); }
function stageCnt(n) { return n <= 2 ? 2 : n <= 5 ? 3 : n <= 10 ? 4 : n <= 18 ? 5 : 6; }
function stagePool(n) {
  const allow = n <= 4 ? f => f.tier === 'R' || f.tier === 'SR'
    : n <= 10 ? f => f.tier !== 'UR' : () => true;
  let pool = FIG_ALL.filter(allow);
  if (pool.length < 3) pool = FIG_ALL.slice();
  const rnd = mulberry(n * 9301 + 49297);
  const out = [], lv = Math.max(1, Math.round(1 + n * .8));
  for (let i = 0; i < stageCnt(n) && pool.length; i++) {
    const f = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out.push({ id: f.id, lv });
  }
  return out;
}
const _siCache = {};
function stageInfo(n) {
  if (_siCache[n]) return _siCache[n];
  const tierName = n <= 5 ? '新手村' : n <= 12 ? '州府道' : n <= 22 ? '五岳争锋' : n <= 35 ? '京师会武' : '天下论剑';
  const info = { n, name: tierName + ' · 第 ' + n + ' 阵', cnt: stageCnt(n), power: 0 };
  let sum = 0;
  stagePool(n).forEach(o => {
    const f = FIG_MAP[o.id], st = f.stats;
    const m = TIER_BASE[f.tier] * Math.pow(1.085, o.lv - 1) * foeM(n);
    const hp = (st.耐 * 5.4 + 180) * m, atk = (st.力 * .82 + st.宝 * .38 + 12) * m * .92;
    const def = (st.耐 * .52 + 8) * m, spd = st.敏 * .6 + st.幸 * .18 + 18;
    sum += hp * .5 + atk * 3.2 + def * 2.4 + spd * 1.2;
  });
  info.power = Math.round(sum * .82);
  _siCache[n] = info;
  return info;
}

/* ---------- 招募 ---------- */
const TIER_W = { R: 54, SR: 30, SSR: 13, UR: 3 };
function rollOne(forceSR) {
  let pool = FIG_ALL;
  if (forceSR) pool = FIG_ALL.filter(f => f.tier === 'SR' || f.tier === 'SSR' || f.tier === 'UR');
  const total = pool.reduce((a, f) => a + (TIER_W[f.tier] || 1), 0);
  let x = Math.random() * total;
  for (const f of pool) {
    x -= (TIER_W[f.tier] || 1);
    if (x <= 0) return f;
  }
  return pool[0];
}
function doRecruit(n, free) {
  if (!free && S.tic < n) return { ok: false, msg: '招募帖不足（当前 ' + S.tic + ' 张）' };
  if (!free) S.tic -= n;
  const got = [];
  for (let i = 0; i < n; i++) {
    const f = rollOne(n === 10 && i === n - 1);
    const before = !!S.heroes[f.id];
    got.push({ f, type: grant(f.id) });
  }
  save();
  return { ok: true, got };
}

function fmt(v) {
  const n = Math.round(v);
  if (n >= 100000) return (n / 10000).toFixed(1) + '万';
  if (n >= 10000) return (n / 10000).toFixed(2) + '万';
  return String(n);
}

module.exports = {
  FIGURES, FIG_ALL, FIG_MAP, SCHOOL, CLASS2SCHOOL, TIER_BASE, STAR_CAP, STARTER,
  load, save, reset, state, grant, owned, schoolOf,
  heroStat, power, teamPower, resonance, trainCost, breakCost,
  stageInfo, stagePool, stageCnt, foeM, doRecruit, fmt, adapter,
};
