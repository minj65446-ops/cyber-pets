/* =========================================================
   core/battle.js —— 回合制战斗引擎
   从 cyber-pets/jianghu.js 移植：去掉 DOM/Canvas，
   日志进 B.log、飘字进 B.fx，渲染层自行消费
   ========================================================= */
const ST = require('./store.js');
const FIG_MAP = ST.FIG_MAP;

let B = null;
let _uid = 0;

function mkUnit(id, slot, boost) {
  const s = ST.heroStat(id);
  return {
    uid: ++_uid, id, side: 'hero', slot, name: s.name, school: s.school, tier: s.tier,
    hp: Math.round(s.hpMax * (1 + boost)), hpMax: Math.round(s.hpMax * (1 + boost)),
    atk: Math.round(s.atk * (1 + boost)), def: s.def, spd: s.spd, crit: s.crit,
    heal: Math.round(s.heal * (1 + boost)), rage: 30, dead: false,
    buf: { atkUp: 0, defUp: 0, slow: 0, stun: 0, shield: 0, dot: 0, dotT: 0 },
  };
}
function mkFoe(o, i, n) {
  const f = FIG_MAP[o.id], st = f.stats;
  const m = ST.TIER_BASE[f.tier] * Math.pow(1.085, o.lv - 1) * ST.foeM(n);
  const u = {
    uid: ++_uid, id: o.id, side: 'foe', slot: i, name: f.name, tier: f.tier,
    school: ST.schoolOf(o.id),
    hpMax: Math.round((st.耐 * 5.4 + 180) * m),
    atk: Math.round((st.力 * .82 + st.宝 * .38 + 12) * m * .92),
    def: Math.round((st.耐 * .52 + 8) * m),
    spd: Math.round(st.敏 * .6 + st.幸 * .18 + 18),
    crit: Math.min(.4, .03 + st.幸 * .003),
    heal: Math.round((st.魔 * .5 + 6) * m),
    rage: 0, dead: false,
    buf: { atkUp: 0, defUp: 0, slow: 0, stun: 0, shield: 0, dot: 0, dotT: 0 },
  };
  u.hp = u.hpMax;
  return u;
}

function startBattle(n) {
  const S = ST.state();
  const team = S.team.filter(Boolean);
  if (!team.length) return null;
  const r = ST.resonance();
  const heroes = team.map((id, i) => mkUnit(id, i, r.add));
  const foes = ST.stagePool(n).map((o, i) => mkFoe(o, i, n));
  B = {
    n, heroes, foes, all: heroes.concat(foes),
    turn: 0, order: [], oi: 0, phase: 'run', ended: null,
    ourDead: 0, foeDead: 0, dmgUs: 0, dmgThem: 0,
    log: [], fx: [],
  };
  B.order = B.all.slice().sort((a, b) => b.spd - a.spd).map(u => u.uid);
  addLog('—— 开战 ——');
  S.fights++;
  ST.save();
  return B;
}
function addLog(t) { if (B) { B.log.push(t); if (B.log.length > 40) B.log.shift(); } }
function pushFx(o) { if (B) { B.fx.push(o); if (B.fx.length > 30) B.fx.shift(); } }

function aliveOf(side) { return B.all.filter(u => !u.dead && u.side === side); }
function allHeroesDead() { return aliveOf('hero').length === 0; }
function allFoesDead() { return aliveOf('foe').length === 0; }

function lateGame() {
  if (!B || B.turn < 18) return { dmg: 1, heal: 1 };
  const k = Math.min(1, (B.turn - 18) / 45);
  return { dmg: 1 + k * .95, heal: 1 - k * .72 };
}
function healMul() { return lateGame().heal; }

function calcDmg(u, tgt, mul) {
  const crit = Math.random() < u.crit ? 1.75 : 1;
  const raw = u.atk * mul * crit * lateGame().dmg;
  const red = raw * (tgt.def / (tgt.def + 260));
  return Math.max(1, Math.round(raw - red * .5));
}
function hurt(t, src, d, tag) {
  if (t.buf.shield > 0) {
    const absorb = Math.min(t.buf.shield, d);
    t.buf.shield -= absorb; d -= absorb;
  }
  t.hp -= d;
  if (src) {
    if (src.side === 'hero') B.dmgUs += d; else B.dmgThem += d;
    pushFx({ t: .55, c: '#fca5a5', txt: '-' + d, unit: t });
  } else {
    pushFx({ t: .55, c: '#fb923c', txt: '-' + d + (tag ? ' ' + tag : ''), unit: t });
  }
  if (t.hp <= 0) {
    t.hp = 0; t.dead = true;
    addLog(t.name + ' 力竭退场');
    if (t.side === 'foe') B.foeDead++; else B.ourDead++;
  }
}
function pickTarget(from, prefer) {
  const foes = aliveOf(from.side === 'hero' ? 'foe' : 'hero');
  if (!foes.length) return null;
  if (prefer === 'low') return foes.slice().sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
  if (prefer === 'back') return foes.slice().sort((a, b) => a.def - b.def)[0];
  if (prefer === 'front') return foes.slice().sort((a, b) => b.def - a.def)[0];
  return foes[Math.floor(Math.random() * foes.length)];
}
function tickBuf(u) {
  const b = u.buf;
  if (b.dot > 0) { hurt(u, null, b.dot, '流 血'); b.dotT--; if (b.dotT <= 0) b.dot = 0; }
  if (b.atkUp > 0) b.atkUp--;
  if (b.defUp > 0) b.defUp--;
  if (b.shield > 0) b.shield = Math.max(0, b.shield - Math.round(u.hpMax * .008));
  if (b.slow > 0) b.slow--;
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
      pushFx({ t: .5, c: '#22c55e', txt: '+' + h, unit: wounded });
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
    addLog(u.name + (Math.random() < u.crit ? ' 一剑破空，暴击 ' : ' 御剑远击，') + tgt.name + ' ' + dmg);
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
  tgt = pickTarget(u, 'front'); if (!tgt) return;
  dmg = calcDmg(u, tgt, .8); hurt(tgt, u, dmg, '');
  if (Math.random() < .3) { tgt.buf.stun = 1; extra = '并予以重击致眩晕'; }
  addLog(u.name + ' 近身出拳，' + tgt.name + ' 受创 ' + dmg + (extra ? '，' + extra : ''));
}
function useNP(u) {
  const f = FIG_MAP[u.id];
  const mates = aliveOf(u.side), foes = aliveOf(u.side === 'hero' ? 'foe' : 'hero');
  const sc = u.school;
  addLog('★ ' + u.name + ' 施展成名作「' + f.np.name + '」');
  pushFx({ t: .9, c: '#f0d488', txt: f.np.name, unit: u, big: 1 });
  if (sc === 'fist') {
    foes.forEach(t => { hurt(t, u, calcDmg(u, t, .95), ''); t.buf.stun = 1; });
    mates.forEach(m => m.buf.shield = Math.max(m.buf.shield, Math.round(u.hpMax * .16)));
  } else if (sc === 'blade') {
    const t = foes.slice().sort((a, b) => b.hp - a.hp)[0] || foes[0];
    if (t) { const d = calcDmg(u, t, 2.4); hurt(t, u, d, ''); t.buf.dot = Math.round(d * .3); t.buf.dotT = 3; }
  } else if (sc === 'sword') {
    foes.slice(0, 3).forEach((t, i) => hurt(t, u, calcDmg(u, t, 1.35 - i * .12), ''));
  } else if (sc === 'art') {
    foes.forEach(t => { t.buf.slow = 3; t.buf.atkUp = 0; t.buf.defUp = 0; });
    mates.forEach(m => m.buf.atkUp = 3);
  } else {
    mates.forEach(m => {
      const hv = Math.round(u.heal * 1.5 * healMul());
      m.hp = Math.min(m.hpMax, m.hp + hv);
      pushFx({ t: .6, c: '#22c55e', txt: '+' + hv, unit: m });
    });
    mates.forEach(m => m.buf.defUp = 3);
  }
}
function battleStep() {
  if (!B || B.phase !== 'run') return;
  /* 这两个是模块内函数，别写成 B.xxx() —— 移植时在这里栽过一次 */
  if (allHeroesDead()) { finish(false); return; }
  if (allFoesDead()) { finish(true); return; }
  /* 回合上限：治疗可能压过输出，防止无限僵局 */
  if (B.turn > 360) {
    const hr = B.heroes.filter(u => !u.dead), fr = aliveOf('foe');
    const hp = a => a.reduce((x, u) => x + u.hp / u.hpMax, 0) / (a.length || 1);
    addLog('—— 战至时限，按存活性判定 ——');
    finish(hp(hr) >= hp(fr));
    return;
  }
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
  if (act.rage >= 100) { act.rage = 0; useNP(act); }
  else { act.rage = Math.min(100, act.rage + 22); normalAttack(act); }
}

/* ---------- 结算：算完奖励写存档，返回值交给 UI 显示 ---------- */
function finish(win) {
  if (!B || B.ended !== null) return null;
  B.ended = win;
  B.phase = 'end';
  const S = ST.state();
  let gain = { gold: 0, exp: 0, tic: 0 };
  if (win) {
    S.wins++;
    gain.gold = Math.round((75 + B.n * 32) * (1 + B.dmgUs / 5000));
    gain.exp = Math.round((55 + B.n * 24) * (1 + B.foeDead * .12));
    gain.tic = B.n % 5 === 0 ? 3 : (Math.random() < .34 ? 1 : 0);
    S.gold += gain.gold; S.exp += gain.exp; S.tic += gain.tic;
    if (B.n >= S.maxStage) S.maxStage = B.n + 1;
    S.stage = Math.min(S.maxStage, B.n + 1);
  } else {
    gain.gold = Math.round(12 + B.n * 4);
    gain.exp = Math.round(10 + B.n * 3);
    S.gold += gain.gold; S.exp += gain.exp;
  }
  ST.save();
  const res = {
    win, gain, stage: B.n, turns: B.turn,
    aliveHero: B.heroes.filter(u => !u.dead).length,
    heroTotal: B.heroes.length,
    foeTotal: B.foes.length,
  };
  B.result = res;
  return res;
}
function battleState() { return B; }
function clearBattle() { B = null; }
function quit() { B = null; }

module.exports = {
  startBattle, battleStep, battleState, clearBattle, quit, finish,
  mkUnit, mkFoe,
};
