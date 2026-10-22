/* =========================================================
   赛博江湖 · 侠客谱 —— 武侠卡牌放置
   依赖：hall-data.js（FIGURES/CLASSES）、portrait.js（drawFigure）
   ========================================================= */
const FIG_ALL = FIGURES.filter(s => !s.nc);
const FIG_MAP = Object.fromEntries(FIGURES.map(s => [s.id, s]));

/* ---------- 流派：把八种生态位映射成像版纳位置和行当 ---------- */
const SCHOOL = {
  fist:  { name: '拳', full: '拳掌', col: '#c0392b', row: 'front', desc: '前排肉盾，扛伤与控制' },
  blade: { name: '刀', full: '刀法', col: '#c2410c', row: 'mid',   desc: '中距离持续伤害与流血' },
  sword: { name: '剑', full: '剑法', col: '#3b82f6', row: 'back',  desc: '远程爆发，越打越猛' },
  art:   { name: '术', full: '术法', col: '#8b5cf6', row: 'back',  desc: '控制与削弱，花样最多' },
  heal:  { name: '辅', full: '辅佐', col: '#22c55e', row: 'back',  desc: '治疗与增益，队伍续航' },
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

/* ---------- 存档 ---------- */
const SAVE_KEY = 'jh-save-v1';
let S = null;
/* 开局六人：前排 拳/拳/刀 扛伤，后排 剑/术/辅 输出与治疗 */
const STARTER = ['niuge', 'dingzhen', 'zhouzhou', 'diaoyu', 'mabaoguo', 'baize'];
function defaultSave() {
  return {
    gold: 0, exp: 0, tic: 20,
    heroes: {},          // id -> {lv, star, exp}
    team: [null, null, null, null, null, null], // 0-2 前排, 3-5 后排
    stage: 1, maxStage: 1,
    lastIdle: Date.now(),
    wins: 0, fights: 0,
    speed: 2, free10: true,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    S = raw ? Object.assign(defaultSave(), JSON.parse(raw)) : defaultSave();
  } catch (e) { S = defaultSave(); }
  /* 新档赠礼：直接给一支六人队伍（覆盖五流派），外加一次免费十连 */
  if (!Object.keys(S.heroes).length) {
    STARTER.forEach(id => { if (FIG_MAP[id]) { grant(id); } });
    S.team = STARTER.slice(0, 6);
    S.free10 = true;
  }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
}
function grant(id) {
  if (S.heroes[id]) {
    S.heroes[id].star = Math.min(STAR_CAP[FIG_MAP[id].tier], S.heroes[id].star + 1);
    return 'star';
  }
  S.heroes[id] = { lv: 1, star: 0, exp: 0 };
  return 'new';
}
function owned() { return FIG_ALL.filter(s => S.heroes[s.id]); }

/* ---------- 头像缓存 ---------- */
const FACES = {};
FIGURES.forEach(s => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  drawFigure(c.getContext('2d'), s, 64, { still: true });
  FACES[s.id] = c;
});

/* ---------- 数值模型 ---------- */
const schoolOf = id => CLASS2SCHOOL[FIG_MAP[id].class] || 'fist';
function heroStat(id) {
  const f = FIG_MAP[id], h = S.heroes[id];
  const tb = TIER_BASE[f.tier];
  const lvM = Math.pow(1.085, h.lv - 1);
  const stM = 1 + h.star * .28;
  const m = tb * lvM * stM;
  const st = f.stats;
  return {
    hpMax: Math.round((st.耐 * 5.4 + 180) * m),
    atk:   Math.round((st.力 * .82 + st.宝 * .38 + 12) * m),
    def:   Math.round((st.耐 * .52 + 8) * m),
    spd:   Math.round(st.敏 * .6 + st.幸 * .18 + 18),
    crit:  Math.min(.55, .04 + st.幸 * .0035 + h.star * .012),
    heal:  Math.round((st.魔 * .5 + st.宝 * .22 + 6) * m),
    school: schoolOf(id), name: f.name, lv: h.lv, star: h.star, tier: f.tier,
  };
}
function power(id) {
  const s = heroStat(id);
  return Math.round(s.hpMax * .5 + s.atk * 3.2 + s.def * 2.4 + s.heal * 1.6 + s.spd * 1.2);
}
function teamPower() {
  return S.team.filter(Boolean).reduce((a, id) => a + power(id), 0);
}
/* 同流派共鸣：2/3/4+ 个同门派给全队加成 */
function resonance() {
  const team = S.team.filter(Boolean);
  const cnt = {};
  team.forEach(id => { const k = schoolOf(id); cnt[k] = (cnt[k] || 0) + 1; });
  let add = 0; const parts = [];
  Object.keys(cnt).forEach(k => {
    const n = cnt[k];
    if (n >= 2) { const a = n >= 4 ? .24 : n === 3 ? .15 : .08; add += a; parts.push(SCHOOL[k].full + n + '人 +' + Math.round(a * 100) + '%'); }
  });
  return { add, parts };
}

/* ---------- 关卡 ---------- */
const _siCache = {};
/* 敌人数单独抽出来，避免 stageInfo ↔ stagePool 互相调用形成递归 */
function stageCnt(n) {
  return n <= 2 ? 2 : n <= 5 ? 3 : n <= 10 ? 4 : n <= 18 ? 5 : 6;
}
function stageInfo(n) {
  if (_siCache[n]) return _siCache[n];
  const tierName = n <= 5 ? '新手村' : n <= 12 ? '州府道' : n <= 22 ? '五岳争锋' : n <= 35 ? '京师会武' : '天下论剑';
  const info = {
    n, name: tierName + ' · 第 ' + n + ' 阵',
    cnt: stageCnt(n),
    power: 0,
  };
  /* 建议战力按敌群真实总战力折算，别再用拍脑袋的指数曲线 */
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
/* 敌人的额外强度系数，随关卡缓慢抬升 */
function foeM(n) { return 0.94 + Math.min(.32, n / 62); }
function stagePool(n) {
  /* 前几阵只放低稀有度的敌人，保证开局六人不会被直接打崩 */
  const allow = n <= 4 ? f => f.tier === 'R' || f.tier === 'SR'
    : n <= 10 ? f => f.tier !== 'UR' : () => true;
  let pool = FIG_ALL.filter(allow);
  if (pool.length < 3) pool = FIG_ALL.slice();
  const rnd = mulberry(n * 9301 + 49297);
  const out = [];
  const num = stageCnt(n);
  /* 敌人等级贴近玩家成长线，靠「数量 + 稀有度」而不是「等级碾压」制造压力 */
  const lv = Math.max(1, Math.round(1 + n * .8));
  for (let i = 0; i < num && pool.length; i++) {
    const idx = Math.floor(rnd() * pool.length);
    const f = pool.splice(idx, 1)[0];
    out.push({ id: f.id, lv });
  }
  return out;
}
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* =========================================================
   战斗
   ========================================================= */
let B = null;   // battle state
let bTimer = null;

function startBattle(n) {
  const team = S.team.filter(Boolean);
  if (!team.length) { toast('先去布阵上阵一位侠客'); return false; }
  const r = resonance();
  const heroes = team.map((id, i) => mkUnit(id, i, r.add, true));
  const foes = stagePool(n).map((o, i) => mkFoe(o, i, n));
  B = {
    n, heroes, foes, all: heroes.concat(foes),
    turn: 0, order: [], oi: 0, phase: 'run', log: [],
    t: 0, tickT: 0, ended: null, ourDead: 0, foeDead: 0, dmgUs: 0, dmgThem: 0,
  };
  B.order = B.all.slice().sort((a, b) => b.spd - a.spd).map(u => u.uid);
  document.getElementById('bov').classList.remove('hide');
  document.getElementById('bRes').classList.add('hide');
  document.getElementById('bL').textContent = '我方 ' + heroes.length + ' 人 · 战力 ' + teamPower();
  document.getElementById('bR').textContent = '第 ' + n + ' 阵 · 敌 ' + foes.length;
  const sp = stageInfo(n);
  document.getElementById('bmid').textContent = sp.name + '　建议战力 ' + sp.power;
  document.getElementById('blog').innerHTML = '';
  addLog('—— 开战 ——');
  S.fights++;
  loop();
  if (bTimer) clearInterval(bTimer);
  /* 30ms 一步，默认 ×2：一场约 10 秒出结果，不至于盯着看半天 */
  bTimer = setInterval(tick, 30);
  return true;
}
let _uid = 0;
function mkUnit(id, slot, boost, isHero) {
  const s = heroStat(id);
  return {
    uid: ++_uid, id, side: isHero ? 'hero' : 'foe', slot,
    name: s.name, school: s.school, tier: s.tier,
    hp: Math.round(s.hpMax * (1 + boost)), hpMax: Math.round(s.hpMax * (1 + boost)),
    atk: Math.round(s.atk * (1 + boost)), def: s.def, spd: s.spd, crit: s.crit,
    heal: Math.round(s.heal * (1 + boost)), rage: isHero ? 30 : 0, dead: false,
    buf: { atkUp: 0, defUp: 0, slow: 0, stun: 0, shield: 0, dot: 0, dotT: 0 },
  };
}
function mkFoe(o, i, n) {
  const f = FIG_MAP[o.id];
  const st = f.stats;
  const tb = TIER_BASE[f.tier];
  const m = tb * Math.pow(1.085, o.lv - 1) * foeM(n);
  const u = {
    uid: ++_uid, id: o.id, side: 'foe', slot: i, name: f.name, tier: f.tier,
    school: schoolOf(o.id), hpMax: Math.round((st.耐 * 5.4 + 180) * m),
    atk: Math.round((st.力 * .82 + st.宝 * .38 + 12) * m * .92),
    def: Math.round((st.耐 * .52 + 8) * m), spd: Math.round(st.敏 * .6 + st.幸 * .18 + 18),
    crit: Math.min(.4, .03 + st.幸 * .003), heal: Math.round((st.魔 * .5 + 6) * m),
    rage: 0, dead: false, buf: { atkUp: 0, defUp: 0, slow: 0, stun: 0, shield: 0, dot: 0, dotT: 0 },
  };
  u.hp = u.hpMax;
  return u;
}
function addLog(t) {
  const el = document.getElementById('blog');
  if (!el) return;
  const d = document.createElement('div');
  d.textContent = t;
  el.insertBefore(d, el.firstChild);
  while (el.children.length > 6) el.removeChild(el.lastChild);
}

function tick() {
  if (!B || B.phase !== 'run') return;
  const n = S.speed;
  for (let i = 0; i < n; i++) battleStep();
}
function battleStep() {
  B.t += .06;
  /* 注意：这两个是全局函数，不要写成 B.xxx() */
  if (allHeroesDead()) { finish(false); return; }
  if (allFoesDead()) { finish(true); return; }
  /* 回合上限：双方治疗能力都可能压过输出，必须防止无限僵局 */
  if (B.turn > 360) {
    const hr = B.heroes.filter(u => !u.dead);
    const fr = aliveOf('foe');
    const hp = a => a.reduce((x, u) => x + u.hp / u.hpMax, 0) / (a.length || 1);
    const win = hp(hr) >= hp(fr);
    addLog('—— 战至时限，按存活性判定 ——');
    finish(win);
    return;
  }
  /* 取当前行动单位 */
  let act = null, guard = 0;
  while (!act && guard++ < 60) {
    const u = B.all.find(x => x.uid === B.order[B.oi]);
    B.oi = (B.oi + 1) % B.order.length;
    if (u && !u.dead && u.buf.stun <= 0) act = u;
    if (u && u.buf.stun > 0) u.buf.stun--;
  }
  if (!act) return;
  B.turn++;
  tickBuf(act);
  if (act.dead) return;
  /* 怒气满放成名作 */
  if (act.rage >= 100) {
    act.rage = 0;
    useNP(act);
  } else {
    act.rage = Math.min(100, act.rage + 22);
    normalAttack(act);
  }
}
function tickBuf(u) {
  const b = u.buf;
  if (b.dot > 0) { hurt(u, null, b.dot, '流 血'); b.dotT--; if (b.dotT <= 0) b.dot = 0; }
  if (b.atkUp > 0) b.atkUp--;
  if (b.defUp > 0) b.defUp--;
  if (b.shield > 0) b.shield = Math.max(0, b.shield - Math.round(u.hpMax * .008));
  if (b.slow > 0) b.slow--;
}
function aliveOf(side) { return B.all.filter(u => !u.dead && u.side === side); }
function allHeroesDead() { return aliveOf('hero').length === 0; }
function allFoesDead() { return aliveOf('foe').length === 0; }

function pickTarget(from, prefer) {
  const foes = aliveOf(from.side === 'hero' ? 'foe' : 'hero');
  if (!foes.length) return null;
  if (prefer === 'low') return foes.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
  if (prefer === 'back') {
    /* 刺客：优先打对面后排/低防 */
    const soft = foes.slice().sort((a, b) => a.def - b.def);
    return soft[0];
  }
  if (prefer === 'front') {
    const t = foes.slice().sort((a, b) => b.def - a.def);
    return t[0];
  }
  return foes[Math.floor(Math.random() * foes.length)];
}
function normalAttack(u) {
  const sc = u.school;
  let tgt = null, dmg = 0, extra = '';
  if (sc === 'heal') {
    const mates = aliveOf(u.side).slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax);
    const wounded = mates.find(m => m.hp < m.hpMax * .92);
    if (wounded) {
      const h = Math.round(u.heal * 1.15 * healMul());
      wounded.hp = Math.min(wounded.hpMax, wounded.hp + h);
      addLog(u.name + ' 施以援手，为 ' + wounded.name + ' 回复 ' + h);
      FX.push({ x: 0, y: 0, t: .5, c: '#22c55e', txt: '+' + h, unit: wounded });
    } else {
      tgt = pickTarget(u, 'low'); if (!tgt) return;
      dmg = calcDmg(u, tgt, .62); hurt(tgt, u, dmg, '');
      addLog(u.name + ' 出手，' + tgt.name + ' 受创 ' + dmg);
    }
    return;
  }
  if (sc === 'art') {
    tgt = pickTarget(u, 'back'); if (!tgt) return;
    dmg = calcDmg(u, tgt, .78); hurt(tgt, u, dmg, '');
    const r = Math.random();
    if (r < .45) { tgt.buf.slow = 2; extra = '并使其迟滞'; }
    else if (r < .7) { tgt.buf.atkUp = 0; tgt.buf.defUp = 0; extra = '并卸去增益'; }
    addLog(u.name + ' 施术，' + tgt.name + ' 受创 ' + dmg + (extra ? '，' + extra : ''));
    return;
  }
  if (sc === 'sword') {
    tgt = pickTarget(u, 'low'); if (!tgt) return;
    dmg = calcDmg(u, tgt, 1.12); hurt(tgt, u, dmg, '');
    if (Math.random() < u.crit) { addLog(u.name + ' 一剑破空，暴击 ' + tgt.name + ' ' + dmg); }
    else addLog(u.name + ' 御剑远击，' + tgt.name + ' 受创 ' + dmg);
    return;
  }
  if (sc === 'blade') {
    tgt = pickTarget(u, 'back'); if (!tgt) return;
    dmg = calcDmg(u, tgt, .86); hurt(tgt, u, dmg, '');
    tgt.buf.dot = Math.max(tgt.buf.dot, Math.round(dmg * .32));
    tgt.buf.dotT = 2;
    addLog(u.name + ' 挥刀，' + tgt.name + ' 受创 ' + dmg + ' 并流血');
    return;
  }
  /* fist */
  tgt = pickTarget(u, 'front'); if (!tgt) return;
  dmg = calcDmg(u, tgt, .8); hurt(tgt, u, dmg, '');
  if (Math.random() < .3) { tgt.buf.stun = 1; extra = '并予以重击致眩晕'; }
  addLog(u.name + ' 近身出拳，' + tgt.name + ' 受创 ' + dmg + (extra ? '，' + extra : ''));
}
function calcDmg(u, tgt, mul) {
  const crit = Math.random() < u.crit ? 1.75 : 1;
  const raw = u.atk * mul * crit * lateGame().dmg;
  const red = raw * (tgt.def / (tgt.def + 260));
  return Math.max(1, Math.round(raw - red * .5));
}
/* 久战加压：回合越久治疗越弱、伤害越高，避免双方互相奶到天荒地老 */
function lateGame() {
  if (!B || B.turn < 18) return { dmg: 1, heal: 1 };
  const k = Math.min(1, (B.turn - 18) / 45);
  return { dmg: 1 + k * .95, heal: 1 - k * .72 };
}
function healMul() { return lateGame().heal; }
function hurt(t, src, d, tag) {
  if (t.buf.shield > 0) {
    const absorb = Math.min(t.buf.shield, d);
    t.buf.shield -= absorb; d -= absorb;
  }
  t.hp -= d;
  if (src) {
    if (src.side === 'hero') B.dmgUs += d; else B.dmgThem += d;
    FX.push({ x: 0, y: 0, t: .55, c: '#fca5a5', txt: '-' + d, unit: t });
  } else {
    FX.push({ x: 0, y: 0, t: .55, c: '#fb923c', txt: '-' + d + (tag ? ' ' + tag : ''), unit: t });
  }
  if (t.hp <= 0) {
    t.hp = 0; t.dead = true;
    addLog(t.name + ' 力竭退场');
    if (t.side === 'foe') B.foeDead++; else B.ourDead++;
  }
}
/* 成名作 */
function useNP(u) {
  const f = FIG_MAP[u.id];
  const mates = aliveOf(u.side), foes = aliveOf(u.side === 'hero' ? 'foe' : 'hero');
  const sc = u.school;
  addLog('★ ' + u.name + ' 施展成名作「' + f.np.name + '」');
  FX.push({ x: 0, y: 0, t: .9, c: '#f0d488', txt: f.np.name, unit: u, big: 1 });
  if (sc === 'fist') {
    foes.forEach(t => { const d = calcDmg(u, t, .95); hurt(t, u, d, ''); t.buf.stun = 1; });
    mates.forEach(m => m.buf.shield = Math.max(m.buf.shield, Math.round(u.hpMax * .16)));
  } else if (sc === 'blade') {
    const t = foes.slice().sort((a, b) => b.hp - a.hp)[0] || foes[0];
    if (t) { const d = calcDmg(u, t, 2.4); hurt(t, u, d, ''); t.buf.dot = Math.round(d * .3); t.buf.dotT = 3; }
  } else if (sc === 'sword') {
    const list = foes.slice(0, 3);
    list.forEach((t, i) => { const d = calcDmg(u, t, 1.35 - i * .12); hurt(t, u, d, ''); });
  } else if (sc === 'art') {
    foes.forEach(t => { t.buf.slow = 3; t.buf.atkUp = 0; t.buf.defUp = 0; });
    mates.forEach(m => m.buf.atkUp = 3);
  } else {
    /* heal */
    mates.forEach(m => {
      const hv = Math.round(u.heal * 1.5 * healMul());
      m.hp = Math.min(m.hpMax, m.hp + hv);
      FX.push({ x: 0, y: 0, t: .6, c: '#22c55e', txt: '+' + hv, unit: m });
    });
    mates.forEach(m => m.buf.defUp = 3);
  }
}

function finish(win) {
  if (B.ended) return;
  B.ended = win;
  B.phase = 'end';
  if (bTimer) { clearInterval(bTimer); bTimer = null; }
  const g = stageInfo(B.n);
  let gold = 0, exp = 0, tic = 0;
  if (win) {
    S.wins++;
    gold = Math.round((75 + B.n * 32) * (1 + B.dmgUs / 5000));
    exp = Math.round((55 + B.n * 24) * (1 + B.foeDead * .12));
    tic = B.n % 5 === 0 ? 3 : (Math.random() < .34 ? 1 : 0);
    S.gold += gold; S.exp += exp; S.tic += tic;
    if (B.n >= S.maxStage) { S.maxStage = B.n + 1; }
    S.stage = Math.min(S.maxStage, B.n + 1);
  } else {
    gold = Math.round(12 + B.n * 4); exp = Math.round(10 + B.n * 3);
    S.gold += gold; S.exp += exp;
  }
  save();
  document.getElementById('resBig').textContent = win ? '大 获 全 胜' : '力 有 未 逮';
  document.getElementById('resSml').innerHTML = win
    ? '第 ' + B.n + ' 阵告破　·　存活 ' + (B.heroes.length - B.ourDead) + '/' + B.heroes.length + ' 人'
    : '第 ' + B.n + ' 阵失利　·　建议提升侠客等级或调整阵容';
  document.getElementById('resGain').innerHTML =
    '银两 +' + gold + '　修为 +' + exp + (tic ? '　招募帖 +' + tic : '')
    + '<br><span style="font-size:10px;color:#6b6675">可在「侠客」页消耗资源修炼与突破</span>';
  /* 守卫一下：快速连点时这个延时可能落到下一场战斗里，导致结算面板串场 */
  setTimeout(() => {
    if (B && B.phase === 'end') document.getElementById('bRes').classList.remove('hide');
  }, 420);
  refreshTop(); renderStage(); renderHero();
}
function quitBattle() {
  if (bTimer) { clearInterval(bTimer); bTimer = null; }
  B = null;
  document.getElementById('bov').classList.add('hide');
  toast('已撤退');
}

/* ---------- 战斗画布 ---------- */
const bcv = document.getElementById('bcv'), bctx = bcv.getContext('2d');
const FX = [];
function layout() {
  const pos = {};
  const heroes = B.heroes, foes = B.foes;
  heroes.forEach((u, i) => {
    const row = i < 3 ? 0 : 1, col = i % 3;
    pos[u.uid] = { x: 62 + col * 52, y: row === 0 ? 150 : 226 };
  });
  foes.forEach((u, i) => {
    const row = i < 3 ? 0 : 1, col = i % 3;
    pos[u.uid] = { x: 366 + col * 52, y: row === 0 ? 150 : 226 };
  });
  return pos;
}
function loop() {
  requestAnimationFrame(loop);
  const cv = bcv, c = bctx;
  c.clearRect(0, 0, cv.width, cv.height);
  if (!B) return;
  const t = performance.now() / 1000;
  /* 背景 */
  const g = c.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#1b1730'); g.addColorStop(1, '#0d0b16');
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = 'rgba(212,176,98,.14)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(cv.width / 2, 20); c.lineTo(cv.width / 2, cv.height - 20); c.stroke();
  const pos = layout();
  B.all.forEach(u => {
    const p = pos[u.uid]; if (!p) return;
    const wob = Math.sin(t * 2.2 + u.uid) * 2;
    if (u.dead) c.globalAlpha = .22;
    /* 影子 */
    c.fillStyle = 'rgba(0,0,0,.34)';
    c.beginPath(); c.ellipse(p.x, p.y + 30, 22, 7, 0, 0, 6.28); c.fill();
    /* 头像 */
    const sz = 52;
    c.drawImage(FACES[u.id], p.x - sz / 2, p.y - sz / 2 + wob, sz, sz);
    /* 门派色环 */
    c.strokeStyle = SCHOOL[u.school].col; c.lineWidth = 2;
    c.globalAlpha = (u.dead ? .22 : 1) * (.65 + Math.sin(t * 3 + u.uid) * .2);
    c.beginPath(); c.arc(p.x, p.y + wob, 28, 0, 6.28); c.stroke();
    c.globalAlpha = u.dead ? .22 : 1;
    /* 血条 */
    const bw = 44, bx = p.x - bw / 2, by = p.y - 34 + wob;
    c.fillStyle = 'rgba(0,0,0,.62)'; c.fillRect(bx - 1, by - 1, bw + 2, 6);
    const r = Math.max(0, u.hp / u.hpMax);
    c.fillStyle = u.side === 'hero' ? (r > .35 ? '#22c55e' : '#f59e0b') : (r > .35 ? '#c0392b' : '#7f1d1d');
    c.fillRect(bx, by, bw * r, 4);
    /* 怒气 */
    if (!u.dead) {
      c.fillStyle = 'rgba(240,212,136,.85)';
      c.fillRect(bx, by + 6, bw * (u.rage / 100), 1.5);
    }
    /* 名前 */
    c.font = '9px sans-serif'; c.textAlign = 'center';
    c.fillStyle = u.dead ? '#5b566a' : '#e8e4da';
    c.fillText(u.name, p.x, p.y + 42 + wob);
    /* 门派标签 */
    c.fillStyle = SCHOOL[u.school].col;
    c.font = 'bold 8px sans-serif';
    c.fillText(SCHOOL[u.school].name, p.x, p.y + 51 + wob);
    /* 盾 */
    if (u.buf.shield > 0 && !u.dead) {
      c.strokeStyle = 'rgba(56,189,248,.85)'; c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y + wob, 33, 0, 6.28); c.stroke();
    }
    c.globalAlpha = 1;
  });
  /* 飘字 */
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i];
    f.t -= .016;
    if (f.t <= 0) { FX.splice(i, 1); continue; }
    const p = pos[f.unit.uid]; if (!p) continue;
    c.globalAlpha = Math.min(1, f.t * 2);
    c.fillStyle = f.c;
    c.font = f.big ? 'bold 13px sans-serif' : 'bold 11px sans-serif';
    c.textAlign = 'center';
    c.fillText(f.txt, p.x, p.y - 14 - (1 - f.t) * 30);
    c.globalAlpha = 1;
  }
}

/* =========================================================
   界面渲染
   ========================================================= */
const $ = id => document.getElementById(id);
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 1400);
}
function fmt(n) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(Math.round(n)); }

function refreshTop() {
  $('rGold').textContent = fmt(S.gold);
  $('rExp').textContent = fmt(S.exp);
  $('rTic').textContent = S.tic;
  const sp = stageInfo(S.stage);
  $('stageName').textContent = sp.name;
}
function renderHome() {
  const r = resonance();
  const tp = teamPower();
  $('homeInfo').innerHTML =
    '上阵 <b style="color:var(--gold2)">' + S.team.filter(Boolean).length + '</b>/6 人　·　阵容战力 <b style="color:var(--gold2)">' + fmt(tp) + '</b><br>'
    + '当前进度：第 <b style="color:var(--gold2)">' + S.stage + '</b> 阵　·　最高抵达第 ' + S.maxStage + ' 阵<br>'
    + '战斗记录：' + S.wins + ' 胜 / ' + S.fights + ' 战<br>'
    + (r.parts.length ? '门派共鸣：<span style="color:#a78bfa">' + r.parts.join('、') + '</span>' : '门派共鸣：<span style="color:#6b6675">凑同门派 2 人以上可激活</span>');
  drawIdleArt();
}
/* 主页挂机插画 */
function drawIdleArt() {
  const cv = $('homeCv'), c = cv.getContext('2d');
  const t = performance.now() / 1000;
  c.clearRect(0, 0, cv.width, cv.height);
  const g = c.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#2a2340'); g.addColorStop(1, '#15121f');
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  /* 远山 */
  c.fillStyle = 'rgba(212,176,98,.07)';
  c.beginPath(); c.moveTo(0, 92);
  for (let x = 0; x <= cv.width; x += 24) {
    c.lineTo(x, 78 + Math.sin(x * .017) * 13 + Math.cos(x * .031) * 7);
  }
  c.lineTo(cv.width, cv.height); c.lineTo(0, cv.height); c.fill();
  /* 灯笼 */
  for (let i = 0; i < 5; i++) {
    const x = 46 + i * 92, y = 30 + Math.sin(t * 1.1 + i) * 3;
    c.strokeStyle = 'rgba(212,176,98,.2)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x, y); c.stroke();
    c.fillStyle = 'rgba(240,212,136,' + (.5 + Math.sin(t * 2 + i) * .18) + ')';
    c.beginPath(); c.ellipse(x, y + 5, 6.5, 8, 0, 0, 6.28); c.fill();
  }
  /* 上阵侠客排排站 */
  const team = S.team.filter(Boolean);
  if (!team.length) {
    c.fillStyle = '#5b566a'; c.font = '12px sans-serif'; c.textAlign = 'center';
    c.fillText('未曾有人上阵，江湖空空如也', cv.width / 2, 108);
    return;
  }
  team.forEach((id, i) => {
    const x = cv.width / 2 + (i - (team.length - 1) / 2) * 46;
    const y = 74 + Math.sin(t * 2.4 + i * .9) * 3;
    c.globalAlpha = .95;
    c.drawImage(FACES[id], x - 19, y, 38, 38);
    c.globalAlpha = 1;
    c.strokeStyle = SCHOOL[schoolOf(id)].col + '88'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y + 19, 21, 0, 6.28); c.stroke();
  });
  /* 地面倒影 */
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 116, cv.width, 34);
}

/* ---------- 挂机 ---------- */
function idleTick() {
  if (!S) return;
  const now = Date.now();
  const dt = Math.min(3600, (now - (S.lastIdle || now)) / 1000);
  if (dt < 5) return;
  const tp = teamPower();
  const per = Math.max(1, tp / 780);
  const gold = Math.round(dt * per * 1.05 + S.stage * dt * .07);
  const exp = Math.round(dt * per * .8 + S.stage * dt * .05);
  const tic = dt > 240 ? Math.floor(dt / 240) : (Math.random() < dt / 240 ? 1 : 0);
  S.gold += gold; S.exp += exp; S.tic += tic;
  S.lastIdle = now;
  save(); refreshTop();
  updateIdleTxt(gold, exp, tic, Math.round(dt));
}
function updateIdleTxt(g, e, t, sec) {
  const el = $('idleTxt');
  if (g === undefined) {
    el.innerHTML = '江湖还在运转，挂机收益随时结算<br><b>在线即自动积累</b>';
    return;
  }
  el.innerHTML = '离线 <b>' + fmt(sec) + ' 秒</b> 的收益已到账<br>'
    + '银两 <b>+' + fmt(g) + '</b>　修为 <b>+' + fmt(e) + '</b>' + (t ? '　招募帖 <b>+' + t + '</b>' : '');
}
function quickIdle() {
  const tp = teamPower();
  if (tp <= 0) { toast('先布阵'); return; }
  const gold = Math.round(tp * .11 + S.stage * 14);
  const exp = Math.round(tp * .09 + S.stage * 11);
  S.gold += gold; S.exp += exp;
  S.tic += Math.random() < .18 ? 1 : 0;
  save(); refreshTop();
  toast('挂机 +' + fmt(gold) + ' 银两 · +' + fmt(exp) + ' 修为');
}

/* ---------- 侠客列表 ---------- */
let heroFilter = 'all';
function renderHero() {
  const grid = $('heroGrid');
  const list = heroFilter === 'own' ? owned() : FIG_ALL;
  grid.innerHTML = '';
  list.forEach(f => {
    const own = !!S.heroes[f.id];
    const on = S.team.includes(f.id);
    const d = document.createElement('div');
    d.className = 'hc' + (own ? '' : ' lock') + (on ? ' on' : '');
    const tier = document.createElement('span');
    tier.className = 'tier t-' + f.tier; tier.textContent = f.tier;
    d.appendChild(tier);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    cv.getContext('2d').drawImage(FACES[f.id], 0, 0);
    d.appendChild(cv);
    if (own) {
      const n = document.createElement('div'); n.className = 'n'; n.textContent = f.name; d.appendChild(n);
      const l = document.createElement('div'); l.className = 'l';
      l.textContent = 'Lv' + S.heroes[f.id].lv + (S.heroes[f.id].star ? ' ★' + S.heroes[f.id].star : '');
      d.appendChild(l);
    } else {
      const n = document.createElement('div'); n.className = 'n'; n.style.color = '#6b6675';
      n.textContent = '未知'; d.appendChild(n);
      const l = document.createElement('div'); l.className = 'l'; l.style.color = '#6b6675';
      l.textContent = '未招募'; d.appendChild(l);
    }
    if (on) { const dot = document.createElement('span'); dot.className = 'dot'; d.appendChild(dot); }
    d.onclick = () => openDetail(f.id, own);
    grid.appendChild(d);
  });
  $('heroCnt').textContent = '已招募 ' + owned().length + ' / ' + FIG_ALL.length;
}

/* ---------- 布阵 ---------- */
function renderTeam() {
  const field = $('field');
  field.innerHTML = '';
  const roles = ['前排·扛伤', '前排·扛伤', '前排·扛伤', '后排·输出', '后排·输出', '后排·输出'];
  S.team.forEach((id, i) => {
    const d = document.createElement('div');
    d.className = 'slot ' + (i < 3 ? 'f' : 'b') + (id ? ' has' : '');
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = i < 3 ? '前' : '后';
    d.appendChild(tag);
    if (id) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      if (FACES[id]) cv.getContext('2d').drawImage(FACES[id], 0, 0);
      d.appendChild(cv);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = FIG_MAP[id].name;
      d.appendChild(nm);
      const rm = document.createElement('div'); rm.className = 'rm';
      rm.style.color = SCHOOL[schoolOf(id)].col;
      rm.textContent = SCHOOL[schoolOf(id)].full + ' Lv' + S.heroes[id].lv;
      d.appendChild(rm);
    } else {
      const nm = document.createElement('div'); nm.className = 'rm'; nm.textContent = '空 位';
      d.appendChild(nm);
    }
    d.onclick = () => {
      if (S.team[i]) { S.team[i] = null; save(); renderTeam(); renderHero(); toast('已卸下'); }
    };
    field.appendChild(d);
  });
  const r = resonance();
  $('bpr').textContent = r.parts.length ? '威力加成 +' + Math.round(r.add * 100) + '%' : '威力加成 —';
  /* 候选 */
  const bench = $('benchGrid');
  bench.innerHTML = '';
  owned().forEach(f => {
    const on = S.team.includes(f.id);
    const d = document.createElement('div');
    d.className = 'hc' + (on ? ' on' : '');
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    cv.getContext('2d').drawImage(FACES[f.id], 0, 0);
    d.appendChild(cv);
    const n = document.createElement('div'); n.className = 'n'; n.textContent = f.name; d.appendChild(n);
    const l = document.createElement('div'); l.className = 'l'; l.textContent = SCHOOL[schoolOf(f.id)].full;
    d.appendChild(l);
    d.onclick = () => {
      if (on) { const i = S.team.indexOf(f.id); S.team[i] = null; }
      else {
        /* 按流派自动排位：fist/blade 前排，其余后排 */
        const wantFront = ['fist', 'blade'].includes(schoolOf(f.id));
        const prefer = wantFront ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
        let put = -1;
        for (const p of prefer) if (!S.team[p]) { put = p; break; }
        if (put < 0) put = S.team.indexOf(null);
        if (put < 0) { toast('阵容已满，先点一个位置卸下'); return; }
        S.team[put] = f.id;
      }
      save(); renderTeam(); renderHero(); renderHome();
    };
    bench.appendChild(d);
  });
  if (!owned().length) $('teamTip').textContent = '尚无侠客，请先在「招募」页投帖';
  else $('teamTip').textContent = '点击下方侠客上阵（自动排位） / 点击阵位卸下';
}

/* ---------- 闯关 ---------- */
function renderStage() {
  const list = $('stageList');
  const info = $('stageInfo');
  const from = Math.max(1, S.stage - 2);
  const to = from + 11;
  info.innerHTML = '当前第 <b style="color:var(--gold2)">' + S.stage + '</b> 阵　·　最高第 ' + S.maxStage + ' 阵<br>'
    + '阵容战力 <b style="color:var(--gold2)">' + fmt(teamPower()) + '</b>　·　'
    + '<span style="color:#6b6675">每 5 阵必得招募帖</span>';
  list.innerHTML = '';
  for (let n = from; n <= to; n++) {
    const sp = stageInfo(n);
    const d = document.createElement('div');
    const locked = n > S.maxStage;
    d.className = 'stg' + (n === S.stage ? ' cur' : '') + (n < S.stage ? ' done' : '') + (locked ? ' lockst' : '');
    d.innerHTML = '<div class="no">' + n + '</div>'
      + '<div class="info"><div class="tt">' + sp.name + '</div>'
      + '<div class="dd">敌方 ' + sp.cnt + ' 人　建议战力 ' + fmt(sp.power) + '</div></div>'
      + '<div class="bn">' + (locked ? '未解锁' : n < S.stage ? '已通过' : '挑战') + '</div>';
    d.onclick = () => {
      if (locked) { toast('先通过前面的关卡'); return; }
      S.stage = n; save(); renderStage(); refreshTop();
      startBattle(n);
    };
    list.appendChild(d);
  }
}

/* ---------- 详情 / 养成 ---------- */
let curId = null;
function openDetail(id, own) {
  curId = id;
  const f = FIG_MAP[id];
  const sch = SCHOOL[schoolOf(id)];
  $('dName').textContent = own ? f.name : '？？？';
  $('dTx').textContent = (own ? (f.title + '　·　' + f.region + '　·　' + f.era) : '尚未招募，前往「招募」页投帖试试');
  $('dBadges').innerHTML = own
    ? '<span class="badge t-' + f.tier + '" style="background:' + tierColor(f.tier) + '">' + f.tier + '</span>'
      + '<span class="badge" style="background:' + sch.col + ';color:#fff">' + sch.full + '</span>'
      + '<span class="badge" style="background:#2e2a3c;color:var(--ink2)">' + CLASSES[f.class].name + '</span>'
    : '';
  const c = $('dFace'), cc = c.getContext('2d');
  cc.clearRect(0, 0, c.width, c.height);
  cc.drawImage(FACES[id], 0, 0, 96, 96);
  if (!own) { cc.fillStyle = 'rgba(10,9,16,.72)'; cc.fillRect(0, 0, 96, 96); }
  /* 资质 */
  const st = f.stats, keys = ['力', '耐', '敏', '魔', '幸', '宝'];
  const stt = own ? heroStat(id) : null;
  $('dStats').innerHTML = keys.map(k =>
    '<div class="statline"><span class="k">' + k + '</span>'
    + '<span class="bar"><i style="width:' + Math.min(100, st[k]) + '%"></i></span>'
    + '<span class="v">' + st[k] + '</span></div>').join('')
    + (stt ? '<div class="sub" style="margin-top:6px">生命 ' + fmt(stt.hpMax) + '　攻击 ' + fmt(stt.atk)
      + '　防御 ' + fmt(stt.def) + '<br>速度 ' + stt.spd + '　暴击 ' + Math.round(stt.crit * 100)
      + '%　治疗 ' + fmt(stt.heal) + '<br>战力评分 <b style="color:var(--gold2)">' + fmt(power(id)) + '</b></div>'
      : '<div class="sub" style="margin-top:6px">招募后可见详细数值</div>');
  /* 招式 */
  $('dSkills').innerHTML = (own ? f.skills : []).map(s =>
    '<div class="skli"><span class="rk">' + s.rank + '</span><span class="nm2">' + s.name + '</span>'
    + '<span class="dd">' + s.desc + '</span></div>').join('')
    + '<div class="skli" style="border-top:none"><span class="rk">EX</span><span class="nm2">' + (own ? f.np.name : '未知') + '</span>'
    + '<span class="dd">' + (own ? f.np.effect : '招募后解锁成名作') + '</span></div>'
    + '<div class="skli"><span class="rk" style="color:' + sch.col + '">' + sch.name + '</span>'
    + '<span class="nm2">' + sch.full + '</span><span class="dd">' + sch.desc + '</span></div>';
  $('dNp').innerHTML = own ? ('<b style="color:var(--gold2)">' + f.np.name + '</b>　' + f.np.desc) : '招募后解锁';
  $('dLore').textContent = own ? f.lore : '尚未招募。';
  $('dWeak').textContent = own ? ('弱点：' + f.weak) : '';
  const cost = trainCost(id), br = breakCost(id);
  const h = S.heroes[id];
  $('dCost').innerHTML = own
    ? '<span>等级 Lv' + h.lv + '　星级 ' + (h.star ? '★'.repeat(h.star) : '未突破') + '</span>'
    : '';
  const bUp = $('dUp'), bTr = $('dTrain');
  bUp.disabled = !own || h.star >= STAR_CAP[f.tier];
  bTr.disabled = !own;
  bUp.textContent = own
    ? (h.star >= STAR_CAP[f.tier] ? '已达圆满' : '突破 · ' + fmt(br.gold) + ' 银两 / ' + fmt(br.exp) + ' 修为')
    : '突 破';
  bTr.textContent = own ? ('修炼 · ' + fmt(cost.gold) + ' 银两 / ' + fmt(cost.exp) + ' 修为') : '修 炼';
  $('detailOv').classList.remove('hide');
}
function tierColor(t) { return { R: '#94a3b8', SR: '#f0d488', SSR: '#f0abfc', UR: '#fdba74' }[t] || '#94a3b8'; }
function trainCost(id) {
  const h = S.heroes[id] || { lv: 1, star: 0 };
  return { gold: Math.round(40 * Math.pow(1.24, h.lv)), exp: Math.round(30 * Math.pow(1.22, h.lv)) };
}
function breakCost(id) {
  const h = S.heroes[id] || { lv: 1, star: 0 };
  return { gold: Math.round(260 * Math.pow(1.85, h.star)), exp: Math.round(200 * Math.pow(1.8, h.star)) };
}
function doTrain() {
  const id = curId, h = S.heroes[id];
  if (!h) return;
  const c = trainCost(id);
  if (S.gold < c.gold || S.exp < c.exp) { toast('资源不足：需 ' + fmt(c.gold) + ' 银两 / ' + fmt(c.exp) + ' 修为'); return; }
  S.gold -= c.gold; S.exp -= c.exp;
  h.lv++;
  save(); refreshTop(); openDetail(id, true); renderHero(); renderTeam(); renderHome();
  toast(FIG_MAP[id].name + ' 修炼至 Lv' + h.lv);
}
function doBreak() {
  const id = curId, h = S.heroes[id];
  if (!h) return;
  const cap = STAR_CAP[FIG_MAP[id].tier];
  if (h.star >= cap) { toast('已达当前稀有度的圆满境界'); return; }
  const c = breakCost(id);
  if (S.gold < c.gold || S.exp < c.exp) { toast('资源不足：需 ' + fmt(c.gold) + ' 银两 / ' + fmt(c.exp) + ' 修为'); return; }
  S.gold -= c.gold; S.exp -= c.exp;
  h.star++;
  save(); refreshTop(); openDetail(id, true); renderHero(); renderTeam(); renderHome();
  toast(FIG_MAP[id].name + ' 突破至 ★' + h.star);
}

/* ---------- 招募 ---------- */
const TIER_W = { R: 54, SR: 30, SSR: 13, UR: 3 };
function rollOne(forceSR) {
  let pool = FIG_ALL;
  if (forceSR) {
    const hi = pool.filter(f => f.tier === 'SR' || f.tier === 'SSR' || f.tier === 'UR');
    if (hi.length) pool = hi;
  }
  /* 按权重抽稀有度 */
  let total = 0; const entries = [];
  pool.forEach(f => { const w = TIER_W[f.tier] || 10; total += w; entries.push([f, w]); });
  let r = Math.random() * total;
  for (const [f, w] of entries) { r -= w; if (r <= 0) return f; }
  return pool[pool.length - 1];
}
function doRecruit(n, free) {
  if (!free && S.tic < n) { toast('招募帖不足（当前 ' + S.tic + ' 张）'); return; }
  if (free) { } else S.tic -= n;
  const got = [];
  for (let i = 0; i < n; i++) {
    const f = rollOne(n === 10 && i === n - 1);
    const before = !!S.heroes[f.id];
    grant(f.id);
    got.push({ f, before });
  }
  save(); refreshTop(); renderHero(); renderTeam(); renderHome();
  const box = $('recRes');
  box.innerHTML = '';
  got.forEach(g => {
    const d = document.createElement('div');
    d.className = 'rc';
    const t = document.createElement('span');
    t.className = 'tier t-' + g.f.tier; t.textContent = g.f.tier;
    d.appendChild(t);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    cv.getContext('2d').drawImage(FACES[g.f.id], 0, 0);
    d.appendChild(cv);
    const nm = document.createElement('div'); nm.className = 'n'; nm.textContent = g.f.name; d.appendChild(nm);
    box.appendChild(d);
  });
  /* 首次获得的弹出 */
  const fresh = got.filter(g => !g.before);
  if (fresh.length) {
    const nl = $('newList'); nl.innerHTML = '';
    fresh.forEach(g => {
      const d = document.createElement('div');
      d.style.cssText = 'background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 2px;text-align:center';
      const t = document.createElement('div');
      t.className = 'tier t-' + g.f.tier;
      t.style.cssText = 'font-size:8px;font-weight:800;color:#15131c;padding:1px 4px;display:inline-block;border-radius:4px';
      t.textContent = g.f.tier; d.appendChild(t);
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      cv.width = 72; cv.style.width = '72px'; cv.style.height = '72px';
      cv.getContext('2d').drawImage(FACES[g.f.id], 0, 0, 72, 72);
      d.appendChild(cv);
      const nm = document.createElement('div');
      nm.style.cssText = 'font-size:10.5px;font-weight:700;margin-top:3px';
      nm.textContent = g.f.name; d.appendChild(nm);
      const tx = document.createElement('div');
      tx.style.cssText = 'font-size:8.5px;color:var(--ink2)';
      tx.textContent = SCHOOL[schoolOf(g.f.id)].full; d.appendChild(tx);
      nl.appendChild(d);
    });
    $('newOv').classList.remove('hide');
  } else {
    toast('重复招募，转化为突破星级 +1');
  }
}

/* =========================================================
   事件绑定
   ========================================================= */
function switchPage(id) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  $(id).classList.add('on');
  document.querySelectorAll('.tb').forEach(t => t.classList.toggle('on', t.dataset.pg === id));
  if (id === 'pgHero') renderHero();
  if (id === 'pgTeam') renderTeam();
  if (id === 'pgStage') renderStage();
  if (id === 'pgHome') renderHome();
}
document.querySelectorAll('.tb').forEach(t => {
  t.onclick = () => switchPage(t.dataset.pg);
});
document.querySelectorAll('[data-f]').forEach(b => {
  b.onclick = () => { heroFilter = b.dataset.f; renderHero(); };
});
$('btnQuick').onclick = () => startBattle(S.stage);
$('btnIdle10').onclick = quickIdle;
$('btnRec1').onclick = () => doRecruit(1);
$('btnRec10').onclick = () => doRecruit(10);
$('newClose').onclick = () => $('newOv').classList.add('hide');
$('dClose').onclick = () => $('detailOv').classList.add('hide');
$('dTrain').onclick = doTrain;
$('dUp').onclick = doBreak;
$('bQuit').onclick = quitBattle;
$('bSpeed').onclick = () => {
  S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1;
  $('bSpeed').textContent = '×' + S.speed + ' 加速';
  save();
};
$('resNext').onclick = () => {
  $('bov').classList.add('hide');
  $('bRes').classList.add('hide');
  if (bTimer) { clearInterval(bTimer); bTimer = null; }
  B = null;
  switchPage('pgStage');
};

/* ---------- 缩放适配 ---------- */
function fit() {
  const app = $('app');
  const s = Math.min(innerWidth / 480, innerHeight / 880);
  app.style.transform = 'scale(' + s + ')';
  app.style.left = ((innerWidth - 480 * s) / 2) + 'px';
  app.style.top = ((innerHeight - 880 * s) / 2) + 'px';
}
addEventListener('resize', fit);

/* ---------- 启动 ---------- */
load();
S.lastIdle = S.lastIdle || Date.now();
idleTick();
fit();
refreshTop();
renderHome();
renderHero();
renderTeam();
renderStage();
updateIdleTxt();
$('bSpeed').textContent = '×' + S.speed + ' 加速';
loop();
setInterval(idleTick, 3000);
setInterval(() => { if (!B) drawIdleArt(); }, 120);
/* 新档礼：开局先来一次免费十连，把卡池撑起来 */
if (S.free10) {
  S.free10 = false;
  save();
  setTimeout(() => {
    doRecruit(10, true);
    toast('新档赠礼：免费十连已到账');
  }, 420);
}
