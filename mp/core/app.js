/* =========================================================
   core/app.js —— 状态机 / 输入 / 主循环
   ========================================================= */
const UI = require('./ui.js');
const ST = require('./store.js');
const BT = require('./battle.js');

const TABS = [
  { k: 'home', n: '江湖' }, { k: 'hero', n: '侠客' }, { k: 'team', n: '布阵' },
  { k: 'stage', n: '闯关' }, { k: 'recruit', n: '招募' },
];

const A = {
  page: 'home',
  ov: null,          // null | 'detail' | 'battle' | 'new'
  curId: null,
  heroFilter: 'own',
  recRes: null,
  newList: null,
  result: null,      // 战斗结算数据
  toastTxt: '', toastT: 0,
  scroll: 0,
  battleT: 0,
  idleT: 0,
  ready: false,
};

function tabTitle() {
  const S = ST.state();
  return { home: '江湖', hero: '侠客谱', team: '布 阵', stage: '闯 关', recruit: '招 募' }[A.page] || '';
}
function tabSub() {
  const S = ST.state();
  const r = ST.resonance();
  return '银两 ' + ST.fmt(S.gold) + '　修为 ' + ST.fmt(S.exp) + '　招募帖 ' + S.tic
    + '　战力 ' + ST.fmt(ST.teamPower()) + (r.parts.length ? '　共鸣+' + Math.round(r.add * 100) + '%' : '');
}

function toast(msg) { A.toastTxt = msg; A.toastT = 1.6; }
function go(pg) {
  if (A.ov === 'battle') return;
  A.page = pg; A.scroll = 0; A.ov = A.ov === 'detail' ? null : A.ov;
}

/* ---------- 养成 ---------- */
function train(id) {
  const S = ST.state(), h = S.heroes[id];
  if (!h) return toast('尚未招募');
  const c = ST.trainCost(id);
  if (S.gold < c.gold || S.exp < c.exp) return toast('资源不足：需 ' + ST.fmt(c.gold) + ' 银两 / ' + ST.fmt(c.exp) + ' 修为');
  S.gold -= c.gold; S.exp -= c.exp; h.lv++;
  ST.save();
  toast(ST.FIG_MAP[id].name + ' 修炼至 Lv' + h.lv);
}
function breakUp(id) {
  const S = ST.state(), h = S.heroes[id];
  if (!h) return toast('尚未招募');
  const cap = ST.STAR_CAP[ST.FIG_MAP[id].tier];
  if (h.star >= cap) return toast('已达当前稀有度的圆满境界');
  const c = ST.breakCost(id);
  if (S.gold < c.gold || S.exp < c.exp) return toast('资源不足：需 ' + ST.fmt(c.gold) + ' 银两 / ' + ST.fmt(c.exp) + ' 修为');
  S.gold -= c.gold; S.exp -= c.exp; h.star++;
  ST.save();
  toast(ST.FIG_MAP[id].name + ' 突破至 ★' + h.star);
}
function toggleSlot(i, id) {
  const S = ST.state();
  if (S.team[i] === id) { S.team[i] = null; }
  else {
    const at = S.team.indexOf(id);
    if (at >= 0) S.team[at] = null;
    S.team[i] = id;
  }
  ST.save();
}
function autoFill() {
  const S = ST.state();
  const own = ST.owned().map(f => f.id);
  const front = own.slice().sort((a, b) => ST.heroStat(b).hpMax - ST.heroStat(a).hpMax).slice(0, 3);
  const back = own.filter(x => front.indexOf(x) < 0).sort((a, b) => ST.power(b) - ST.power(a)).slice(0, 3);
  const t = front.concat(back);
  S.team = [t[0] || null, t[1] || null, t[2] || null, t[3] || null, t[4] || null, t[5] || null];
  ST.save();
  toast('已按最优阵容布阵');
}

/* ---------- 招募 ---------- */
function recruit(n) {
  const r = ST.doRecruit(n, false);
  if (!r.ok) return toast(r.msg);
  A.recRes = r.got;
  A.newList = r.got.filter(g => g.type === 'new');
  if (A.newList.length) A.ov = 'new';
  toast('招募完成');
}

/* ---------- 战斗 ---------- */
function fight(n) {
  const S = ST.state();
  n = Math.max(1, Math.min(n || S.stage, S.maxStage));
  const b = BT.startBattle(n);
  if (!b) return toast('先去布阵上阵一位侠客');
  A.ov = 'battle'; A.result = null; A.battleT = 0;
}
function nextStage() {
  const S = ST.state();
  BT.clearBattle();
  A.ov = null; A.result = null;
  A.page = 'stage'; A.scroll = 0;
}

/* ---------- 挂机 ---------- */
function idleTick(silent) {
  const S = ST.state();
  const now = Date.now();
  const dt = Math.min(3600, (now - (S.lastIdle || now)) / 1000);
  if (dt < 5) return null;
  const tp = ST.teamPower();
  const per = Math.max(1, tp / 780);
  const gold = Math.round(dt * per * 1.05 + S.stage * dt * .07);
  const exp = Math.round(dt * per * .8 + S.stage * dt * .05);
  const tic = dt > 240 ? Math.floor(dt / 240) : (Math.random() < dt / 240 ? 1 : 0);
  S.gold += gold; S.exp += exp; S.tic += tic;
  S.lastIdle = now;
  ST.save();
  if (!silent && (gold || exp)) toast('挂机到账：银两 +' + ST.fmt(gold) + '　修为 +' + ST.fmt(exp));
  return { gold, exp, tic, dt };
}

/* ---------- 主循环 ---------- */
function frame(dt) {
  if (A.toastT > 0) A.toastT -= dt;
  A.idleT += dt;
  if (A.idleT >= 3) { A.idleT = 0; idleTick(true); }
  if (A.ov === 'battle') {
    const b = BT.battleState();
    if (b && b.phase === 'run') {
      A.battleT += dt;
      const step = 0.03;                      // 每 30ms 一步
      const S = ST.state();
      let budget = Math.min(20, Math.floor(A.battleT / step));
      A.battleT -= budget * step;
      while (budget-- > 0 && b.phase === 'run') {
        for (let k = 0; k < (S.speed || 2); k++) BT.battleStep();
      }
      if (b.phase === 'end' && !A.result) A.result = b.result || null;
    }
    if (b && b.phase === 'end' && !A.result) A.result = b.result || { win: b.ended, turns: b.turn, heroTotal: b.heroes.length };
  }
}

/* ---------- 输入 ---------- */
function tap(x, y) {
  const z = UI.pick(x, y);
  if (z && z.fn) z.fn();
}
function drag(dy) {
  if (A.page === 'hero' || A.page === 'stage' || A.page === 'team') {
    A.scroll = Math.max(0, A.scroll - dy);
  }
}

module.exports = {
  A, TABS, toast, go, train, breakUp, toggleSlot, autoFill, recruit,
  fight, nextStage, idleTick, frame, tap, drag, tabTitle, tabSub,
};
