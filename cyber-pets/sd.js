/* =========================================================
   赛博突围战 · 竖屏割草生存
   依赖：hall-data.js（FIGURES/CLASSES）、portrait.js（drawFigure）
   ========================================================= */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

/* ---------- 头像预渲染 ---------- */
const FACES = {};
FIGURES.forEach(s => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  drawFigure(c.getContext('2d'), s, 64, { still: true });
  FACES[s.id] = c;
});

/* ---------- 英雄武学由 heroes.js 提供：UNIQUE / ARCH_CFG ---------- */

/* ---------- 状态 ---------- */
let G = null;
function newGame(fig) {
  return {
    mode: 'pick', t: 0, fig,
    P: { x: 0, y: 0, hp: 100, hpMax: 100, spd: 165, r: 15, invT: 0, face: 1 },
    lv: 1, xp: 0, xpMax: 10, kills: 0,
    sk: {},                 // 已获技能 -> 等级
    enemies: [], bullets: [], orbs: [], dmgTxt: [], fx: [],
    fireT: 0, spawnT: 0, bossT: 60, bossAlive: 0,
    /* ---- 热度：既是分数也是风险 ---- */
    heat: 0, crisis: 0, coolT: 0, crisisCount: 0,
    /* ---- 舆论风向 ---- */
    wind: 'calm', windT: 22,
    best: +(localStorage.getItem('sd-best') || 0),
    /* ---- 英雄专属武学运行时 ---- */
    art: (UNIQUE[fig.id] || {}).art || 'gun',
    artLv: 1,
    hero: {                 // 每局重置的专属计数器
      kickN: 0, tianCount: 0, lianN: 0, hitOne: 0, sameTgt: null,
      giaoN: 0, spiritT: 0, healAcc: 0, gold: 0, parts: 0,
      mubu: 0, jianN: 0, camT: 0, record: 0, combo: 0, comboT: 0,
      stopT: 0, standT: 0, lastHit: 0, hitStack: 0, paid: 0,
      debt: 0, zhenStack: 0, dmgMul: 1, invuln: 0, alive: 1,
      pet: [], marks: [], zones: [], webs: [],
    },
  };
}
const WIND = {
  calm: { ic: '↔', name: '静风', desc: '一切照常', xpM: 1, heatM: 1, decay: 1.0, hpM: 1 },
  tail: { ic: '↑', name: '顺风', desc: '经验 ×1.6，热度衰减加倍', xpM: 1.6, heatM: 1, decay: 2.4, hpM: 1 },
  head: { ic: '↓', name: '逆风', desc: '敌人更硬，热度收益 ×1.6', xpM: 1.2, heatM: 1.6, decay: .6, hpM: 1.3 },
};
const HEAT_OF = { fan: 2, mail: 5, bot: 11, boss: 30 };

/* ---------- 输入：虚拟摇杆 + 键盘 ---------- */
const IN = { dx: 0, dy: 0, active: false };
const stick = document.getElementById('stick'), knob = document.getElementById('knob');
let stBase = null;
function stickStart(x, y) { stBase = { x, y }; IN.active = true; stick.classList.add('on'); stick.style.left = (x - 56) + 'px'; stick.style.top = (y - 56) + 'px'; }
function stickMove(x, y) {
  if (!stBase) return;
  let dx = x - stBase.x, dy = y - stBase.y;
  const d = Math.hypot(dx, dy), lim = 52;
  if (d > lim) { dx = dx / d * lim; dy = dy / d * lim; }
  IN.dx = dx / lim; IN.dy = dy / lim;
  knob.style.transform = `translate(${dx}px,${dy}px)`;
}
function stickEnd() { stBase = null; IN.active = false; IN.dx = IN.dy = 0; stick.classList.remove('on'); knob.style.transform = ''; }
const KEYS = {};
addEventListener('keydown', e => { KEYS[e.key.toLowerCase()] = 1; });
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = 0; });

/* ---------- 选人界面 ---------- */
let picks = [], selPick = -1;
function shufflePicks() {
  const pool = FIGURES.filter(s => !s.nc);
  picks = [];
  const used = new Set();
  while (picks.length < 6 && used.size < pool.length) {
    const s = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(s.id)) continue;
    used.add(s.id); picks.push(s);
  }
  selPick = 0;
  renderPicks();
}
function renderPicks() {
  const box = document.getElementById('picks');
  box.innerHTML = '';
  picks.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'pk' + (i === selPick ? ' on' : '');
    d.innerHTML = `<div class="n">${s.name}</div><div class="t">${s.tier} · ${CLASSES[s.class].name}</div>`;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    c.getContext('2d').drawImage(FACES[s.id], 0, 0);
    d.insertBefore(c, d.firstChild);
    d.onclick = () => { selPick = i; renderPicks(); };
    box.appendChild(d);
  });
}

/* ---------- 开战 ---------- */
function startGame() {
  /* 防呆：选人池空 / 选中越界时自动兜底 */
  if (!picks.length) shufflePicks();
  if (selPick < 0 || selPick >= picks.length) selPick = 0;
  const fig = picks[selPick];
  try {
    G = newGame(fig);
    G.mode = 'play';
    const st = fig.stats;
    G.P.hpMax = G.P.hp = 60 + st.耐 * .8;
    G.P.spd = 140 + st.敏 * .5;
    /* 开局立刻在近处刷 3 个粉丝，画面马上有动静 */
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * 6.28 + Math.random(), dist = 170 + Math.random() * 60;
      const c = ECFG.fan;
      G.enemies.push({
        kind: 'fan', x: G.P.x + Math.cos(ang) * dist, y: G.P.y + Math.sin(ang) * dist,
        hp: c.hp, hpMax: c.hp, spd: c.spd, dmg: c.dmg, r: c.r, xp: c.xp, slow: 0, hitT: 0, wob: Math.random() * 6.28,
      });
    }
    G.dmgTxt.push({ x: G.P.x, y: G.P.y - 70, v: '拖动屏幕走位 · 站定自动开火', life: 3.5, color: '#ffd97a' });
    document.getElementById('ovPick').classList.add('hide');
    document.getElementById('ovEnd').classList.add('hide');
    const wc = document.getElementById('who').getContext('2d');
    wc.clearRect(0, 0, 64, 64);
    wc.drawImage(FACES[fig.id], 0, 0);
    document.getElementById('pName').textContent = fig.name;
  const hm = document.getElementById('heroMode');
  if (hm) {
    const a = ARCH[G.art] || ARCH.gun;
    hm.textContent = a.ic + ' ' + ((UNIQUE[fig.id] || {}).name || a.name) + ' · ' + a.desc;
  }
    renderSkillBar();
  } catch (err) {
    /* 任何异常直接显示在界面上，不再静默 */
    const ov = document.getElementById('ovPick');
    ov.classList.remove('hide');
    let box = document.getElementById('errBox');
    if (!box) { box = document.createElement('p'); box.id = 'errBox'; box.style.cssText = 'color:#ff6b6b;font-size:11px'; ov.insertBefore(box, ov.querySelector('button')); }
    box.textContent = '开战异常：' + err.message;
    G = null;
  }
}

/* ---------- 技能栏 ---------- */
function renderSkillBar() {
  const box = document.getElementById('skills');
  if (!G) { box.innerHTML = ''; return; }
  const cfg = UNIQUE[G.fig.id] || {};
  const art = ARCH[G.art] || ARCH.gun;
  let html = `<div class="sk main"><div class="ic">${art.ic}</div><div class="lv">Lv${G.artLv}</div><div class="nm2">${cfg.name || art.name}</div></div>`;
  const own = Object.keys(G.sk).filter(k => k.startsWith(G.fig.id + '_'));
  own.forEach(k => {
    const nm = (cfg[k.slice(G.fig.id.length)] || '').split('：')[0] || k;
    html += `<div class="sk hero"><div class="ic">✦</div><div class="lv">Lv${G.sk[k]}</div><div class="nm2">${nm}</div></div>`;
  });
  if (!own.length) html += '<div style="font-size:10px;color:#6b6675;padding:0 4px">升级解锁专属</div>';
  box.innerHTML = html;
}

/* ---------- 升级三选一：专属武学 + 通用强化 ---------- */
const COMMON_SK = [
  { id: 'c_hp',    ic: '❤️', name: '体质增强', get: l => `最大生命 +${18 * l}%（并立即回满）` },
  { id: 'c_spd',   ic: '👟', name: '灵活走位', get: l => `移速 +${8 * l}%` },
  { id: 'c_magnet',ic: '🧲', name: '磁力',     get: l => `拾取范围 +${50 * l}` },
  { id: 'c_dmg',   ic: '🔥', name: '输出强化', get: l => `全部伤害 +${12 * l}%` },
  { id: 'c_cool',  ic: '⏱',  name: '专注',     get: l => `技能冷却 -${8 * l}%` },
  { id: 'c_heat',  ic: '📈', name: '热度掌控', get: l => `热度增伤额外 +${10 * l}%，但热度衰减 -${(10 + l * 5)}%` },
];
const COMMON_MAX = 5;

function heroUpgrades() {
  const cfg = UNIQUE[G.fig.id] || {};
  const list = [];
  /* 1) 专属武学升级（提升普攻形态本身） */
  list.push({
    id: '_art', ic: (ARCH[G.art] || ARCH.gun).ic,
    name: (ARCH[G.art] || ARCH.gun).name + '·进阶',
    get: () => `普攻伤害 +22%，形态强化（当前 Lv${G.artLv}）`,
    apply: () => { G.artLv++; },
    cur: () => G.artLv - 1,
  });
  /* 2) 英雄独有三条路径 */
  Object.keys(cfg).filter(k => k.startsWith('_') && k !== '_art').forEach(k => {
    const id = G.fig.id + k;
    const lv = G.sk[id] || 0;
    if (lv >= 3) return;
    list.push({
      id, ic: '✦', hero: true,
      name: cfg[k].split('：')[0],
      get: () => cfg[k].split('：')[1] || cfg[k],
      apply: () => {},
      cur: () => lv,
    });
  });
  /* 3) 通用 */
  COMMON_SK.forEach(s => {
    const lv = G.sk[s.id] || 0;
    if (lv >= COMMON_MAX) return;
    list.push({ id: s.id, ic: s.ic, name: s.name, get: () => s.get(lv + 1), apply: () => {}, cur: () => lv });
  });
  return list;
}

function openUpgrade() {
  G.mode = 'up';
  const pool = heroUpgrades();
  const three = [];
  const cp = pool.slice();
  /* 专属项优先：至少给 2 个英雄专属选项 */
  const own = cp.filter(s => s.hero || s.id === '_art');
  const gen = cp.filter(s => !(s.hero || s.id === '_art'));
  while (three.length < 2 && own.length) three.push(own.splice(Math.floor(Math.random() * own.length), 1)[0]);
  const rest = own.concat(gen);
  while (three.length < 3 && rest.length) three.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  const box = document.getElementById('ups');
  box.innerHTML = '';
  three.forEach(s => {
    const d = document.createElement('div');
    d.className = 'up' + (s.hero ? ' hero' : '');
    const lvTxt = s.id === '_art' ? 'Lv' + (G.artLv + 1) : (s.cur() ? 'Lv' + (s.cur() + 1) : 'NEW');
    d.innerHTML = `<div class="ic">${s.ic}</div><div class="tx"><div class="tt">${s.name}</div>`
      + `<div class="dd">${s.get()}</div></div><div class="lv">${lvTxt}</div>`;
    d.onclick = () => {
      if (s.id === '_art') s.apply();
      else G.sk[s.id] = (G.sk[s.id] || 0) + 1;
      applyUpgradeEffect(s.id);
      document.getElementById('ovUp').classList.add('hide');
      G.mode = 'play';
      renderSkillBar();
    };
    box.appendChild(d);
  });
  if (!three.length) {
    const d = document.createElement('div');
    d.className = 'up';
    d.innerHTML = `<div class="ic">💊</div><div class="tx"><div class="tt">恢复状态</div><div class="dd">生命全满 + 热度清空</div></div>`;
    d.onclick = () => { G.P.hp = G.P.hpMax; G.heat = 0; document.getElementById('ovUp').classList.add('hide'); G.mode = 'play'; };
    box.appendChild(d);
  }
  document.getElementById('ovUp').classList.remove('hide');
}

/* 通用升级的即时效果 */
function applyUpgradeEffect(id) {
  if (id === 'c_hp') {
    const n = G.sk.c_hp || 1;
    const base = G.P.hpMax / (1 + (n - 1) * .18);
    G.P.hpMax = base * (1 + n * .18);
    G.P.hp = G.P.hpMax;
  }
  if (id === 'c_spd') G.P.spd = (G.P.spd || 160) * (1 + .08);
  if (id === 'c_dmg') G.hero.dmgMul = (G.hero.dmgMul || 1) + .12;
  if (id === 'c_heat') G.hero.heatBoost = (G.hero.heatBoost || 0) + .10;
  if (id === 'c_magnet') G.hero.pickR = (G.hero.pickR || 0) + 50;
  /* 冬泳怪哥：每次升级全属性 +8% */
  if (G.fig.id === 'guige') {
    G.hero.aoStack = (G.hero.aoStack || 0) + 1;
    G.P.spd *= 1.02;
  }
  /* 章同学：机位随等级解锁 */
  if (G.fig.id === 'zhangtongxue') G.hero.camT = (G.hero.camT || 0) + 6;
}

/* ---------- 敌人 ---------- */
const ECFG = {
  fan: { hp: 16, spd: 62, dmg: 5, r: 15, xp: 2, boss: 0 },
  mail: { hp: 46, spd: 48, dmg: 9, r: 17, xp: 5, boss: 0 },
  bot: { hp: 150, spd: 34, dmg: 14, r: 20, xp: 14, boss: 0 },
  boss: { hp: 1400, spd: 30, dmg: 24, r: 34, xp: 80, boss: 1 },
};
function spawn() {
  const t = G.t, m = 1 + t / 70;
  let kind = 'fan';
  const r = Math.random();
  if (t > 100 && r < .12) kind = 'bot';
  else if (t > 40 && r < .42) kind = 'mail';
  const ang = Math.random() * 6.28;
  const dist = 300 + Math.random() * 80;
  const c = ECFG[kind];
  G.enemies.push({
    kind, x: G.P.x + Math.cos(ang) * dist, y: G.P.y + Math.sin(ang) * dist,
    hp: c.hp * m, hpMax: c.hp * m, spd: c.spd * (1 + Math.min(.35, t / 400)),
    dmg: c.dmg, r: c.r, xp: c.xp, slow: 0, hitT: 0, wob: Math.random() * 6.28,
  });
}
function spawnBoss() {
  const c = ECFG.boss, m = 1 + G.t / 70;
  const ang = Math.random() * 6.28;
  G.enemies.push({
    kind: 'boss', x: G.P.x + Math.cos(ang) * 340, y: G.P.y + Math.sin(ang) * 340,
    hp: c.hp * m, hpMax: c.hp * m, spd: c.spd, dmg: c.dmg, r: c.r, xp: c.xp,
    slow: 0, hitT: 0, wob: 0,
  });
  G.bossAlive++;
}

/* ---------- 伤害 ---------- */
function dmgTo(e, d, color) {
  /* 英雄专属增伤（破防/连击/残血等）与破防状态统一在此结算 */
  let mul = (G.hero && G.hero.dmgMul) || 1;
  if (e.breakT > 0) mul *= 1.4;
  d *= mul;
  e.hp -= d;
  e.hitT = .12;
  G.dmgTxt.push({ x: e.x, y: e.y - e.r - 4, v: Math.round(d), life: .6, color: color || '#f0d488' });
  if (e.hp <= 0) {
    G.kills++;
    /* 击杀产热：热度越高，敌人越疯 —— 这是本作的核心张力 */
    if (G.crisis <= 0) {
      G.heat = Math.min(100, G.heat + (HEAT_OF[e.kind] || 1) * (WIND[G.wind].heatM));
    }
    /* 击杀后英雄专属连锁 */
    if (G.fig && G.fig.id === 'liangzi' && (G.sk.liangzi_chi)) G.P.hp = Math.min(G.P.hpMax, G.P.hp + G.P.hpMax * .01);
    if (G.fig && G.fig.id === 'dingzhen') G.P.hp = Math.min(G.P.hpMax, G.P.hp + 1.5);
    if (G.fig && G.fig.id === 'xiaohua' && (G.sk.xiaohua_xiao)) {
      /* 爆炸延迟到下一帧统一结算，避免 dmgTo 递归导致栈溢出 */
      G.boomQ = G.boomQ || [];
      G.boomQ.push({ x: e.x, y: e.y, dmg: 12 * G.sk.xiaohua_xiao });
    }
    for (let i = 0; i < (e.kind === 'boss' ? 26 : 6); i++) {
      const a = Math.random() * 6.28, s = 40 + Math.random() * 130;
      G.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .45 + Math.random() * .3, c: e.kind === 'boss' ? '#ef4444' : '#a78bfa', sz: 2 + Math.random() * 3 });
    }
    G.orbs.push({ x: e.x, y: e.y, v: e.xp });
    if (e.kind === 'boss') G.bossAlive = Math.max(0, G.bossAlive - 1);
  }
}

/* ---------- 主循环 ---------- */
let last = 0;
function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0);
  last = ts;
  if (G && G.mode === 'play') step(dt);
  if (G) render(ts / 1000);
  requestAnimationFrame(loop);
}

function step(dt) {
  const P = G.P;
  G.t += dt;

  /* ---- 热度：自然衰减 / 危机推进 ---- */
  if (G.crisis > 0) {
    G.crisis -= dt;
    if (G.crisis <= 0) {
      /* 撑过塌房：清屏 + 回血 + 立即升级 */
      G.crisisCount++;
      G.enemies.forEach(e => {
        G.kills++;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * 6.28, s = 60 + Math.random() * 180;
          G.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .5, c: '#f0d488', sz: 3 });
        }
        G.orbs.push({ x: e.x, y: e.y, v: e.xp });
      });
      G.enemies = [];
      G.heat = 0;
      G.lv++;
      G.xpMax = Math.round(10 + G.lv * 4 + Math.pow(G.lv, 1.25));
      P.hp = Math.min(P.hpMax, P.hp + P.hpMax * .3);
      P.invT = 1.5;
      G.dmgTxt.push({ x: P.x, y: P.y - 40, v: '挺过来了！', life: 1.6, color: '#7dd87d' });
      G.dmgTxt.push({ x: P.x, y: P.y - 62, v: '热度归零 +1 级', life: 1.6, color: '#f0d488' });
    }
  } else if (G.heat >= 100) {
    /* 必须先判满再衰减，否则永远差最后一帧够不到 100 */
    G.crisis = 8;
    G.dmgTxt.push({ x: P.x, y: P.y - 46, v: '⚠ 塌房危机！撑住 8 秒', life: 2, color: '#ff6b6b' });
  } else {
    G.heat = Math.max(0, G.heat - WIND[G.wind].decay * dt);
  }
  if (G.coolT > 0) G.coolT -= dt;

  /* ---- 舆论风向轮转 ---- */
  G.windT -= dt;
  if (G.windT <= 0) {
    const keys = ['calm', 'tail', 'head'];
    let n = keys[Math.floor(Math.random() * keys.length)];
    if (n === G.wind) n = keys[(keys.indexOf(n) + 1) % 3];
    G.wind = n;
    G.windT = 22 + Math.random() * 8;
    G.dmgTxt.push({ x: P.x, y: P.y - 70, v: WIND[n].ic + ' ' + WIND[n].name, life: 1.8, color: '#67e8f9' });
  }

  /* 移动 */
  let dx = IN.dx, dy = IN.dy;
  if (KEYS['w'] || KEYS['arrowup']) dy -= 1;
  if (KEYS['s'] || KEYS['arrowdown']) dy += 1;
  if (KEYS['a'] || KEYS['arrowleft']) dx -= 1;
  if (KEYS['d'] || KEYS['arrowright']) dx += 1;
  const mag = Math.hypot(dx, dy);
  const spd = P.spd * (1 + (G.sk.baozou || 0) * .04);
  if (mag > .05) {
    P.x += dx / mag * spd * dt;
    P.y += dy / mag * spd * dt;
    P.face = dx < 0 ? -1 : 1;
  }
  if (P.invT > 0) P.invT -= dt;

  /* 生成：热度越高刷得越猛，危机期加倍 */
  const danger = G.heat / 100;
  const crisisM = G.crisis > 0 ? 2.4 : 1;
  const rate = Math.min(4.2, .9 + G.t / 32) * (1 + danger * .8) * crisisM;
  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    G.spawnT = 1 / rate;
    if (G.enemies.length < 260) spawn();
  }
  G.bossT -= dt;
  if (G.bossT <= 0 && G.crisis <= 0) { G.bossT = 70; spawnBoss(); }

  /* 敌人 */
  G.enemies.forEach(e => {
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.slow > 0) e.slow -= dt;
    const ax = P.x - e.x, ay = P.y - e.y, d = Math.hypot(ax, ay) || 1;
    const sp = e.spd * (e.slow > 0 ? 1 - (.18 + (G.sk.jianzhu || 0) * .05) : 1)
      * (1 + (G.heat / 100) * .25) * (G.crisis > 0 ? 1.25 : 1);
    e.x += ax / d * sp * dt;
    e.y += ay / d * sp * dt;
    if (d < P.r + e.r) {
      if (P.invT <= 0) {
        let hd = e.dmg;
        /* 英雄减伤 / 转化 / 上限 */
        const H2 = G.hero, fid = G.fig.id;
        if (fid === 'yaoshuige' && G.sk.yaoshuige_kang) hd = Math.min(hd, P.hpMax * .12);
        if (fid === 'niuge' && G.sk.niuge_shui) hd *= .9;
        if (fid === 'chengge') hd *= .9;
        if (fid === 'laozhou' && G.sk.laozhou_di) { H2.debt = (H2.debt || 0) + hd * .4; hd *= .6; }
        if (fid === 'dingzhen' && G.sk.dingzhen_ni && (H2.niCD || 0) <= 0) { H2.niCD = 3; P.hp = Math.min(P.hpMax, P.hp + hd * .5); }
        if (fid === 'yaoshuige' && G.sk.yaoshuige_ku) { H2.fake = { x: P.x, y: P.y, t: 2 }; e.tgtFake = true; }
        H2.lastHit = G.t;
        H2.hitStack = (H2.hitStack || 0) + 1;
        P.hp -= hd;
        P.invT = .55;
        G.fx.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: .3, c: '#ff6b6b', sz: 22 });
        if (G.sk.hudun) dmgTo(e, hd * (.2 + G.sk.hudun * .15), '#ff9d4d');
        if (P.hp <= 0) return gameOver();
      }
    }
  });

  /* ================= 英雄普攻：按专属形态分派 ================= */
  const cdMul = (1 - (G.sk.c_zcool || 0) * 0 - (G.sk.c_cool || 0) * .08);
  heroWeapon(dt, cdMul);

  /* ---- 英雄专属被动（持续型） ---- */
  heroPassives(dt, cdMul);

  /* 子弹 */
  G.bullets = G.bullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of G.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
        dmgTo(e, b.dmg, b.color);
        return false;
      }
    }
    return b.life > 0;
  });

  /* 经验球 */
  /* 磁吸范围必须够大：远程击杀掉的经验否则永远捡不到，升级会停滞 */
  const pickR = 140 + (G.hero.pickR || 0) + (G.fig.id === 'diaoyu' && G.sk.diaoyu_yu ? 40 : 0);
  const orbMul = (G.fig.id === 'diaoyu' && G.sk.diaoyu_yu) ? 1.5 : 1;
  G.orbs = G.orbs.filter(o => {
    const d = Math.hypot(o.x - P.x, o.y - P.y);
    if (d < pickR + 260) { o.x += (P.x - o.x) / d * 430 * dt; o.y += (P.y - o.y) / d * 430 * dt; }
    if (d < P.r + 20) {
      G.xp += o.v * orbMul * WIND[G.wind].xpM;
      if (G.xp >= G.xpMax) { G.xp -= G.xpMax; G.lv++; G.xpMax = Math.round(10 + G.lv * 4 + Math.pow(G.lv, 1.25)); openUpgrade(); }
      return false;
    }
    return true;
  });

  /* ---- 延迟结算的爆炸（防止递归） ---- */
  if (G.boomQ && G.boomQ.length) {
    const q = G.boomQ;
    G.boomQ = [];
    q.forEach(b => {
      const list = G.enemies.filter(o => Math.hypot(o.x - b.x, o.y - b.y) < 62 + o.r);
      list.forEach(o => dmgTo(o, b.dmg, '#fca5a5'));
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.28, s = 40 + Math.random() * 120;
        G.fx.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35, c: '#fca5a5', sz: 3 });
      }
    });
  }

  /* ---- 冲击波扩散 ---- */
  if (G.waves && G.waves.length) {
    G.waves = G.waves.filter(w => {
      w.r += (w.max / .45) * dt;
      w.life -= dt;
      G.enemies.forEach(e => {
        if (w.hit.has(e) || e.hp <= 0) return;
        const d = Math.hypot(e.x - w.x, e.y - w.y);
        if (Math.abs(d - w.r) < 26 + e.r) {
          w.hit.add(e);
          dmgTo(e, w.dmg, '#fdba74');
          const a = Math.atan2(e.y - w.y, e.x - w.x);
          e.x += Math.cos(a) * 16; e.y += Math.sin(a) * 16;
        }
      });
      return w.life > 0 && w.r < w.max;
    });
  }

  /* ---- 投掷物飞行与爆炸 ---- */
  if (G.bombs && G.bombs.length) {
    G.bombs = G.bombs.filter(b => {
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.x = b.x + (b.tx - b.x) * Math.min(1, dt * 6);
      b.y = b.y + (b.ty - b.y) * Math.min(1, dt * 6);
      if (k >= 1) {
        G.enemies.forEach(e => {
          if (Math.hypot(e.x - b.tx, e.y - b.ty) < b.r + e.r) dmgTo(e, b.dmg, '#f0d488');
        });
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * 6.28, s = 60 + Math.random() * 160;
          G.fx.push({ x: b.tx, y: b.ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .4, c: '#fbbf24', sz: 3 });
        }
        G.boom = { x: b.tx, y: b.ty, r: b.r, t: .3 };
        return false;
      }
      return true;
    });
  }

  /* ---- 破防 / 连击计时器 ---- */
  G.enemies.forEach(e => {
    if (e.breakT > 0) e.breakT -= dt;
    if (e.chill > 0) e.chill -= dt;
  });

  if (G.slash && G.slash.length) G.slash = G.slash.filter(s => (s.life -= dt) > 0);
  if (G.chargeFx > 0) G.chargeFx -= dt;
  if (G.boom) { G.boom.t -= dt; if (G.boom.t <= 0) G.boom = null; }

  G.enemies = G.enemies.filter(e => e.hp > 0);
  G.fx = G.fx.filter(f => { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; return f.life > 0; });
  G.dmgTxt = G.dmgTxt.filter(d => { d.life -= dt; d.y -= 34 * dt; return d.life > 0; });
  if (G._bolt) G._bolt = G._bolt.filter(b => (b.t -= dt) > 0);

  if (G.t > G.best) { G.best = G.t; localStorage.setItem('sd-best', G.best.toFixed(1)); }
  syncHud();
}

/* =========================================================
   英雄被动：让每个人的"打法"不一样，而不是"数值"不一样
   ========================================================= */
function heroPassives(dt, cdMul) {
  const P = G.P, H = G.hero, S = G.sk, id = G.fig.id;
  const L = k => S[id + k] || 0;

  /* 通用：热度掌控提高增伤、但降衰减 */
  /* 通用：专注减冷却（已通过 cdMul 生效于普攻，这里补被动计时器） */

  /* ---------- 东北渔姐：破防增伤 / 被围加速 ---------- */
  if (id === 'yujie') {
    const brk = G.enemies.filter(e => e.breakT > 0).length;
    H.dmgMul = 1 + Math.min(.4, brk * .04 * (1 + L('_lve') * .5));
    const near = G.enemies.filter(e => Math.hypot(e.x - P.x, e.y - P.y) < 150).length;
    if (near >= 8) G.fireT = Math.min(G.fireT, .18);
  }

  /* ---------- 冬泳怪哥：冰域减速 + 残血翻倍 ---------- */
  if (id === 'guige') {
    const lowHp = P.hp / P.hpMax < .3;
    H.zoneBoost = lowHp ? 2 : 1;
    if (L('_xian') && P.hp <= 0) {
      /* 闲话终日有：免死一次 */
      S[id + '_xian'] = 0;
      P.hp = P.hpMax * .35;
      P.invT = 2;
      G.enemies.forEach(e => dmgTo(e, 200, '#67e8f9'));
      G.dmgTxt.push({ x: P.x, y: P.y - 50, v: '闲话终日有 · 免死', life: 1.8, color: '#67e8f9' });
    }
    if (L('_nian')) { H.healAcc = (H.healAcc || 0) + dt; if (H.healAcc > 20) { H.healAcc = 0; P.hpMax += 5; P.hp += 5; } }
  }

  /* ---------- 鲁南老舟：自动修复 / 伤害分期 ---------- */
  if (id === 'laozhou') {
    H.healAcc = (H.healAcc || 0) + dt;
    if (L('_xiu') && H.healAcc > 15) {
      H.healAcc = 0;
      P.hp = Math.min(P.hpMax, P.hp + P.hpMax * .12);
      G.dmgTxt.push({ x: P.x, y: P.y - 44, v: '修旧如旧 +12%', life: 1, color: '#7dd87d' });
    }
    /* 分期支付：每 0.3 秒还一点债 */
    if (H.debt > 0) { const pay = Math.min(H.debt, P.hpMax * .02 * dt * 10); H.debt -= pay; P.hp -= pay; }
  }

  /* ---------- 舟舟快剪：连击提转速 ---------- */
  if (id === 'zhouzhou') {
    H.comboT = Math.max(0, (H.comboT || 0) - dt);
    if (H.comboT <= 0) H.combo = Math.max(0, (H.combo || 0) - 1);
    if (H.combo > 0) G._fl = (G._fl || 0) + dt * .2 * Math.min(4, H.combo);
    if (L('_dian')) {
      H.stopT = (H.stopT || 0) + dt;
      if (H.stopT > 2) G.fireT = Math.min(G.fireT, 0);
    }
  }

  /* ---------- 暗夜侠牛哥：未受击暴击 ---------- */
  if (id === 'niuge') {
    const calm = G.t - (H.lastHit || 0);
    H.critReady = calm > 3;
    if (L('_neng')) H.dmgMul = 1 + (1 - P.hp / P.hpMax) * (.06 * L('_neng') * 1.7);
  }

  /* ---------- 钢琴架驶员：镜头感 ---------- */
  if (id === 'kewin') {
    const dense = G.enemies.length;
    if (dense > 12) G.fireT = Math.min(G.fireT, .3);
  }

  /* ---------- 拉夙：气场 / 余音 ---------- */
  if (id === 'lizu') {
    if (L('_qi')) { H.stopT = IN.active || Math.abs(IN.dx) + Math.abs(IN.dy) > 0 ? 0 : (H.stopT || 0) + dt; }
    if (L('_ge')) {
      H.singT = (H.singT || 30) - dt;
      if (H.singT <= 0) {
        H.singT = 30;
        G.enemies.forEach(e => { if (Math.hypot(e.x - P.x, e.y - P.y) < 420) { e.slow = Math.max(e.slow, 1.5); } });
        G.dmgTxt.push({ x: P.x, y: P.y - 60, v: '♪ 歌剧选段 · 全场眩晕', life: 1.8, color: '#c4b5fd' });
      }
    }
  }

  /* ---------- 瓦隆：黑影兵团 ---------- */
  if (id === 'wac') {
    H.summonT = (H.summonT || 0) - dt;
    if (H.summonT <= 0 && G.enemies.length) {
      H.summonT = 8 - L('_ying') * 1.2;
      for (let i = 0; i < 3; i++) {
        const tgt = G.enemies[Math.floor(Math.random() * G.enemies.length)];
        if (!tgt) continue;
        const a = Math.atan2(tgt.y - P.y, tgt.x - P.x);
        shoot(P.x, P.y, a, 30 * DM(), 700, '#4c1d95', 6);
      }
      G.dmgTxt.push({ x: P.x, y: P.y - 48, v: '黑影兵团', life: .9, color: '#a78bfa' });
    }
  }

  /* ---------- 大胃袋梁子：吃撑 + 只多不减 ---------- */
  if (id === 'liangzi') {
    if (L('_bao') && P.hp >= P.hpMax * .99) H.dmgMul = 1 + .25 * L('_bao');
  }

  /* ---------- 晓桦：一对一增伤 ---------- */
  if (id === 'xiaohua') {
    if (L('_dian')) H.dmgMul = 1 + .6;
  }

  /* ---------- 佰泽：搜 / 打 / 撤 ---------- */
  if (id === 'baize') {
    H.fireHold = (H.fireHold || 0) + dt;
    if (L('_da') && H.fireHold > 2) G.fireT = Math.min(G.fireT, .18);
    if (L('_sou') && G.kills % 5 === 0 && G.kills !== H.killMark) {
      H.killMark = G.kills; H.markT = 3;
    }
    if (H.markT > 0) H.markT -= dt;
  }

  /* ---------- 钓渔佬：渔获 ---------- */
  if (id === 'diaoyu') {
    if (L('_ma')) {
      H.leiT = (H.leiT || 20) - dt;
      if (H.leiT <= 0) {
        H.leiT = 20;
        const tgt = nearest();
        if (tgt) {
          G.enemies.forEach(e => { if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < 120) dmgTo(e, 90 * DM(), '#67e8f9'); });
          G.fx.push({ x: tgt.x, y: tgt.y, vx: 0, vy: 0, life: .4, c: '#67e8f9', sz: 60 });
          G.dmgTxt.push({ x: tgt.x, y: tgt.y - 30, v: '阿玛特拉斯！', life: 1, color: '#67e8f9' });
        }
      }
    }
  }

  /* ---------- 李率：整活形态切换 ---------- */
  if (id === 'liushuai') {
    H.formT = (H.formT || 0) - dt;
    if (H.formT <= 0) {
      H.formT = 6;
      const forms = ['spread', 'pierce', 'spin'];
      G.art = forms[Math.floor(Math.random() * forms.length)];
      G.dmgTxt.push({ x: P.x, y: P.y - 56, v: '整活 → ' + (ARCH[G.art] || {}).name, life: 1.2, color: '#fbbf24' });
    }
  }

  /* ---------- 鑫巴：家人们齐射 ---------- */
  if (id === 'xinba') {
    H.callT = (H.callT || 0) - dt;
    if (H.callT <= 0) {
      H.callT = 10;
      for (let i = 0; i < 18; i++) shoot(P.x, P.y, i / 18 * 6.28, 16 * DM(), 420, '#f472b6', 1);
      G.dmgTxt.push({ x: P.x, y: P.y - 50, v: '家人们！', life: 1, color: '#f472b6' });
    }
    if (L('_chen') && P.hp <= 0) {
      S[id + '_chen'] = 0;
      P.hp = P.hpMax * .4; P.invT = 2;
      G.dmgTxt.push({ x: P.x, y: P.y - 50, v: '臣退了', life: 1.6, color: '#f0d488' });
    }
  }

  /* ---------- 疯狂小扬哥：反向带货 ---------- */
  if (id === 'yangge') {
    if (L('_fan')) H.dmgMul = 1 + Math.min(.5, G.enemies.length * .02 * L('_fan'));
    H.shouT = (H.shouT || 90) - dt;
    if (H.shouT <= 0 && L('_shou')) { H.shouT = 90; P.hp = P.hpMax; }
  }

  /* ---------- 罗永皓：行业冥灯 / 背水一战 ---------- */
  if (id === 'luoyonghao') {
    if (L('_ming') && G.bossAlive > 0) G.enemies.forEach(e => e.dmg = (e.dmg || 1) * .9995);
    if (L('_bei')) { const low = 1 - P.hp / P.hpMax; G.fireT = Math.min(G.fireT, .4 * low); }
    if (H.debt > 0) { const pay = Math.min(H.debt, P.hpMax * .02 * dt * 10); H.debt -= pay; P.hp -= pay; }
  }

  /* ---------- 章同学：机位累积 + 静止加成 ---------- */
  if (id === 'zhangtongxue') {
    H.camT = (H.camT || 0) + dt;
    if ((H.stopT || 0) > 1.5 && L('_ding')) H.dmgMul = 1.8;
  }

  /* ---------- 孙啸川：背锅 ---------- */
  if (id === 'sunxiaochuan') {
    H.renStack = Math.min(15, H.hitStack || 0);
    if (L('_ren')) H.dmgMul = 1 + H.renStack * .05;
  }

  /* ---------- 丁珍：泥巴种荷花（伤害转治疗） ---- */
  if (id === 'dingzhen') {
    H.niCD = Math.max(0, (H.niCD || 0) - dt);
    if (L('_xiang')) H.dmgMul = IN.active ? 1 + .3 * L('_xiang') : 1;
    if (L('_hua')) {
      H.huaT = (H.huaT || 50) - dt;
      if (H.huaT <= 0) { H.huaT = 50; P.hp = Math.min(P.hpMax, P.hp + 12 * L('_hua')); }
    }
  }

  /* ---------- 汤药哥：单次伤害上限 ---- */
  if (id === 'yaoshuige') {
    if (L('_yao')) P.hp = Math.min(P.hpMax, P.hp + .8 * L('_yao') * dt);
  }

  /* ---------- giao 哥：社会摇 / 王者时刻 ---- */
  if (id === 'giaoge') {
    H.kingT = Math.max(0, (H.kingT || 0) - dt);
    H.wangT = (H.wangT || 60) - dt;
    if (H.wangT <= 0 && L('_wang')) {
      H.wangT = 60; H.kingT = 6;
      G.dmgTxt.push({ x: P.x, y: P.y - 56, v: '土味之王 · 王者时刻', life: 1.6, color: '#fbbf24' });
    }
    if (H.kingT > 0) G.fireT = Math.min(G.fireT, .18);
    if (L('_shen') && (Math.abs(IN.dx) + Math.abs(IN.dy)) > .3) G.fireT = Math.min(G.fireT, .1);
  }

  /* ---------- 麻宝国：接化发 / 不讲武德 ---- */
  if (id === 'mabaoguo') {
    if (L('_nei')) H.stopT = (Math.abs(IN.dx) + Math.abs(IN.dy)) > .3 ? 0 : (H.stopT || 0) + dt;
    if ((H.stopT || 0) > 1) G.fireT = Math.min(G.fireT, 0);
  }

  /* ---------- 手工梗：无用良品 ---- */
  if (id === 'shougonggeng') {
    H.wuT = (H.wuT || 30) - dt;
    if (H.wuT <= 0 && L('_wu')) {
      H.wuT = 30;
      const ups = ['hp', 'spd', 'dmg', 'art'];
      const pick = ups[Math.floor(Math.random() * ups.length)];
      if (pick === 'hp') { P.hpMax += 10; P.hp += 10; }
      if (pick === 'spd') P.spd *= 1.05;
      if (pick === 'dmg') H.dmgMul = (H.dmgMul || 1) + .06;
      if (pick === 'art') G.artLv++;
      G.dmgTxt.push({ x: P.x, y: P.y - 52, v: '无用良品 + ' + pick.toUpperCase(), life: 1.5, color: '#f0d488' });
    }
  }
}

/* =========================================================
   英雄普攻分派 —— 每种 art 是*完全不同的操作方式*
   ========================================================= */
function heroAtkBase() {
  /* 基础伤害随等级成长，叠加热度增伤 */
  return (10 + G.lv * 2.6) * DM();
}
function heroWeapon(dt, cdMul) {
  const P = G.P, H = G.hero, art = G.art, C = ARCH_CFG[art] || ARCH_CFG.gun;
  const lv = G.artLv;
  const dmgMul = 1 + (lv - 1) * .22;
  G.fireT -= dt;

  /* 部分形态是持续型，不走冷却 */
  if (art === 'beam') {
    heroBeam(dt, C, dmgMul * heroAtkBase());
    return;
  }
  if (art === 'spin') {
    heroSpin(dt, C, dmgMul * heroAtkBase());
    return;
  }
  if (art === 'zone') {
    heroZone(dt, C, dmgMul * heroAtkBase());
    return;
  }
  if (G.fireT > 0) return;
  const tgt = nearest();
  if (!tgt) return;

  let cd = C.cd * cdMul;
  if (art === 'melee') cd *= 1;
  G.fireT = cd;

  const ang = Math.atan2(tgt.y - P.y, tgt.x - P.x);
  const base = heroAtkBase() * dmgMul;

  if (art === 'gun') {
    /* 点射：孙啸川有"复读机"，giao 有节奏第 4 发翻倍 */
    let d = base * C.dmg / 12;
    let n = C.n || 1;
    if (G.fig.id === 'giaoge') {
      H.giaoN = (H.giaoN + 1) % 4;
      if (H.giaoN === 0) { d *= 2.2; G.dmgTxt.push({ x: P.x, y: P.y - 44, v: 'giao！', life: .7, color: '#fbbf24' }); }
    }
    for (let i = 0; i < n; i++) shoot(P.x, P.y, ang + (i - (n - 1) / 2) * .07, d, C.spd, C.color, 1);
  } else if (art === 'pierce') {
    /* 穿透：一条线上全打穿 */
    shoot(P.x, P.y, ang, base * C.dmg / 12, C.spd, C.color, C.pierce || 3);
    G.fx.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: .18, c: C.color, sz: 26 });
  } else if (art === 'spread') {
    /* 扇射：越近越痛 */
    const n = C.n + Math.floor((lv - 1) / 2);
    for (let i = 0; i < n; i++) {
      shoot(P.x, P.y, ang + (i - (n - 1) / 2) * C.arc / n, base * C.dmg / 12, C.spd, C.color, 1);
    }
  } else if (art === 'melee') {
    /* 近战：身前扇形横斩，命中判定即时 */
    const reach = C.r * (1 + (G.fig.id === 'sunxiaochuan' ? .4 : 0)) * (1 + (lv - 1) * .06);
    let hits = 0;
    G.enemies.forEach(e => {
      const dx2 = e.x - P.x, dy2 = e.y - P.y, d2 = Math.hypot(dx2, dy2);
      if (d2 > reach + e.r) return;
      const dot = (dx2 / (d2 || 1)) * Math.cos(ang) + (dy2 / (d2 || 1)) * Math.sin(ang);
      if (dot < Math.cos(C.arc)) return;
      hits++;
      dmgTo(e, base * C.dmg / 12, C.color);
      heroOnMeleeHit(e, ang, d2);
    });
    /* 斩击视觉 */
    G.slash = G.slash || [];
    G.slash.push({ x: P.x, y: P.y, a: ang, r: reach, life: .22 });
    if (hits) H.combo = (H.combo || 0) + 1; else H.combo = 0;
  } else if (art === 'orbit') {
    /* 浮游僚机：数量随等级、英雄定制 */
    const n = petCount();
    for (let i = 0; i < n; i++) {
      const a2 = (G._petAng = (G._petAng || 0) + 2.1) + i * 6.28 / n;
      const ox = P.x + Math.cos(a2) * 34, oy = P.y + Math.sin(a2) * 34;
      const tg = nearestTo(ox, oy);
      if (!tg) continue;
      const ang2 = Math.atan2(tg.y - oy, tg.x - ox);
      shoot(ox, oy, ang2, base * C.dmg / 12, C.spd, C.color, 1);
    }
  } else if (art === 'charge') {
    /* 蓄力贯穿：一发打穿全场，层数永久累积 */
    H.zhenStack = Math.min(30, (H.zhenStack || 0) + 1);
    const d = base * C.dmg / 12 * (1 + H.zhenStack * .06) * G.hero.dmgMul;
    shoot(P.x, P.y, ang, d, C.spd, C.color, 99);
    G.chargeFx = .25;
    G.dmgTxt.push({ x: P.x, y: P.y - 46, v: '真还传 ×' + H.zhenStack, life: .6, color: '#67e8f9' });
  } else if (art === 'wave') {
    /* 冲击波：向外扩散的环 */
    G.waves = G.waves || [];
    G.waves.push({ x: P.x, y: P.y, r: 20, max: C.r, dmg: base * C.dmg / 12, life: 1, hit: new Set() });
  } else if (art === 'bomb') {
    /* 投掷物：落点随机偏移，落地爆炸 */
    const tx = tgt.x + (Math.random() - .5) * 70, ty = tgt.y + (Math.random() - .5) * 70;
    G.bombs = G.bombs || [];
    G.bombs.push({ x: P.x, y: P.y, tx, ty, t: 0, dur: .55, dmg: base * C.dmg / 8, r: 76 });
  } else {
    shoot(P.x, P.y, ang, base, C.spd, C.color, 1);
  }
}

/* 近战命中后的英雄专属效果 */
function heroOnMeleeHit(e, ang, dist) {
  const P = G.P, H = G.hero;
  if (G.fig.id === 'niuge') {
    /* 螺纹钢：30% 硬直；满血 1.6 倍 */
    if (Math.random() < .3) e.slow = Math.max(e.slow, .8);
    if (e.hp >= e.hpMax * .98) dmgTo(e, 14 * DM(), '#fca5a5');
  }
  if (G.fig.id === 'yujie') {
    /* 每 4 次普攻踹击：击退 + 破防 */
    H.kickN = (H.kickN || 0) + 1;
    if (H.kickN % 4 === 0) {
      e.x += Math.cos(ang) * 70; e.y += Math.sin(ang) * 70;
      e.breakT = 3;
      G.enemies.forEach(o => {
        if (o !== e && Math.hypot(o.x - P.x, o.y - P.y) < 150) { o.x += (o.x - P.x) * .18; o.y += (o.y - P.y) * .18; o.breakT = 3; }
      });
      G.fx.push({ x: P.x + Math.cos(ang) * 60, y: P.y + Math.sin(ang) * 60, vx: 0, vy: 0, life: .3, c: '#f0d488', sz: 46 });
      G.dmgTxt.push({ x: P.x, y: P.y - 50, v: '踹开大门！', life: .9, color: '#f0d488' });
      H.kickN = 0;
    }
  }
  if (G.fig.id === 'sunxiaochuan') {
    /* 人人笑我：每被击中一次伤害 +5% */
    if (H.combo > 0 && H.combo % 5 === 0) shoot(e.x, e.y, ang, 8 * DM(), 420, '#fca5a5', 1);
  }
  if (G.fig.id === 'mabaoguo') {
    H.lianN = (H.lianN || 0) + 1;
    if (H.lianN % 5 === 0) {
      for (let i = 0; i < 5; i++) setTimeout(() => { if (G && G.mode === 'play' && e.hp > 0) dmgTo(e, 9 * DM(), '#fde68a'); }, i * 55);
      G.dmgTxt.push({ x: P.x, y: P.y - 48, v: '五连鞭！', life: .8, color: '#fde68a' });
    }
  }
}

/* 旋刃：贴身环绕切割 */
function heroSpin(dt, C, base) {
  const P = G.P;
  const n = 1 + Math.floor(G.artLv / 2);
  /* 旋转刃：半径随等级外扩，并额外补一圈"贴体格挡"判定，
     避免贴身敌人正好卡在刃与刃之间永远打不到 */
  const rad = C.r * .78 + G.artLv * 7;
  const gap = 6.28 / n;
  G._fl = (G._fl || 0) + dt * 3.6;
  const hitOnce = e => {
    if ((e._spinT || 0) < G.t - .14) {
      e._spinT = G.t;
      dmgTo(e, base * C.dmg / 12 * 1.15, C.color);
      heroOnMeleeHit(e, Math.atan2(e.y - P.y, e.x - P.x), rad);
      return 1;
    }
    return 0;
  };
  for (let i = 0; i < n; i++) {
    const a = G._fl + i * gap;
    const ox = P.x + Math.cos(a) * rad, oy = P.y + Math.sin(a) * rad;
    G.enemies.forEach(e => {
      if (Math.hypot(e.x - ox, e.y - oy) < e.r + 24) hitOnce(e);
    });
  }
  /* 贴身补刀：内圈 40 距离内的敌人也被割到 */
  const inner = 52 + G.artLv * 5;
  G.enemies.forEach(e => {
    if (Math.hypot(e.x - P.x, e.y - P.y) < inner + e.r) hitOnce(e);
  });
}

/* 持续光束 */
function heroBeam(dt, C, base) {
  const P = G.P;
  const tgt = nearest();
  G.beamAng = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (G.beamAng || 0);
  const a = G.beamAng;
  const len = C.range;
  const hw = C.r * .5;
  let hits = 0;
  G.enemies.forEach(e => {
    const dx2 = e.x - P.x, dy2 = e.y - P.y;
    const proj = dx2 * Math.cos(a) + dy2 * Math.sin(a);
    if (proj < 0 || proj > len) return;
    const perp = Math.abs(-dx2 * Math.sin(a) + dy2 * Math.cos(a));
    if (perp > e.r + hw) return;
    hits++;
    dmgTo(e, base * C.dmg * dt * 4, C.color);
  });
  G.beamHit = hits;
  G.beamLen = len;
}

/* 领域：以自身为中心的持续伤害 */
function heroZone(dt, C, base) {
  const P = G.P;
  const rad = C.r * (1 + (G.artLv - 1) * .12);
  G.zoneR = rad;
  G.enemies.forEach(e => {
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (d > rad + e.r) return;
    dmgTo(e, base * C.dmg * dt * .55, C.color);
    if (G.fig.id === 'guige') { e.slow = Math.max(e.slow, .4); e.chill = .5; }
    if (G.fig.id === 'yaoshuige') { e.dps = .97; }
  });
}

/* 僚机数量 */
function petCount() {
  const id = G.fig.id;
  if (id === 'zhangtongxue') {
    const camT = G.hero.camT || 0;
    return camT > 80 ? 7 : camT > 45 ? 4 : 2;
  }
  if (id === 'kewin') return 2 + Math.floor(G.lv / 12);
  if (id === 'yangge') return 2;
  return 1 + Math.floor(G.artLv / 2);
}
function nearestTo(x, y) {
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return bd < 600 ? best : null;
}

/* 热度越高，输出越高（风险回报） */
const DM = () => 1 + (G.heat / 100) * .38;

/* 主动降温：烧掉全部热度换清屏 + 回血 + 无敌 */
function coolDown() {
  if (!G || G.mode !== 'play' || G.coolT > 0 || G.heat < 12) return;
  const h = G.heat;
  G.heat = 0;
  G.coolT = 20;
  const P = G.P;
  P.invT = Math.max(P.invT, 1.5);
  P.hp = Math.min(P.hpMax, P.hp + h * .35);
  let n = 0;
  G.enemies.forEach(e => {
    if (Math.hypot(e.x - P.x, e.y - P.y) < 420) { dmgTo(e, 55 + h * 2.2, '#67e8f9'); n++; }
  });
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * 6.28;
    G.fx.push({ x: P.x + Math.cos(a) * 40, y: P.y + Math.sin(a) * 40, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: .55, c: '#67e8f9', sz: 4 });
  }
  G.dmgTxt.push({ x: P.x, y: P.y - 46, v: `降温！清空 ${n} 个`, life: 1.4, color: '#67e8f9' });
}

function nearest() {
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - G.P.x, e.y - G.P.y);
    if (d < bd) { bd = d; best = e; }
  }
  return bd < 620 ? best : null;
}
function shoot(x, y, ang, dmg, spd, color, pierce) {
  G.bullets.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg, color, life: 1.6, pierce });
}

/* ---------- 渲染 ---------- */
function render(t) {
  ctx.fillStyle = '#101828';
  ctx.fillRect(0, 0, W, H);
  if (!G || !G.fig) return;
  const P = G.P;
  ctx.save();
  ctx.translate(W / 2 - P.x, H / 2 - P.y);

  /* 地面网格 */
  const gs = 60;
  const x0 = Math.floor((P.x - W / 2) / gs) * gs, y0 = Math.floor((P.y - H / 2) / gs) * gs;
  ctx.strokeStyle = 'rgba(120,160,220,.09)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x < P.x + W / 2 + gs; x += gs) { ctx.moveTo(x, y0); ctx.lineTo(x, P.y + H / 2 + gs); }
  for (let y = y0; y < P.y + H / 2 + gs; y += gs) { ctx.moveTo(x0, y); ctx.lineTo(P.x + W / 2 + gs, y); }
  ctx.stroke();

  /* 玩家照明圈（让中心区域明亮可读） */
  const light = ctx.createRadialGradient(P.x, P.y, 30, P.x, P.y, 240);
  light.addColorStop(0, 'rgba(240,212,136,.10)');
  light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = light;
  ctx.fillRect(P.x - 260, P.y - 260, 520, 520);

  /* 领域型英雄：地面范围可视化 */
  if (G.art === 'zone' && G.zoneR) {
    const r = G.zoneR * (G.hero.zoneBoost || 1);
    const col = G.fig.id === 'guige' ? [103, 232, 249] : [16, 185, 129];
    const gz = ctx.createRadialGradient(P.x, P.y, r * .2, P.x, P.y, r);
    gz.addColorStop(0, `rgba(${col.join(',')},.16)`);
    gz.addColorStop(1, `rgba(${col.join(',')},.02)`);
    ctx.fillStyle = gz;
    ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 6.28); ctx.fill();
    ctx.strokeStyle = `rgba(${col.join(',')},.45)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 6.28); ctx.stroke();
    ctx.setLineDash([]);
    /* 冰域内部飘雪 */
    if (G.fig.id === 'guige') {
      for (let i = 0; i < 10; i++) {
        const a = (i * 2.4 + t * .6) % 6.28, rr = r * ((i * .13 + t * .12) % 1);
        ctx.fillStyle = 'rgba(186,230,253,.5)';
        ctx.fillRect(P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr, 2, 2);
      }
    }
  }

  /* 经验球 */
  G.orbs.forEach(o => {
    ctx.fillStyle = o.v > 5 ? '#f0d488' : '#22d3ee';
    ctx.fillRect(o.x - 3, o.y - 3, 6, 6);
  });

  /* 敌人 */
  G.enemies.forEach(e => {
    const x = e.x, y = e.y + Math.sin(t * 7 + e.wob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x, y + e.r * .85, e.r * .8, e.r * .3, 0, 0, 6.28); ctx.fill();
    if (e.kind === 'fan') {
      ctx.fillStyle = e.hitT > 0 ? '#fff' : '#7c3aed';
      ctx.beginPath(); ctx.arc(x, y, e.r, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 7); ctx.lineTo(x - 3, y - 3); ctx.moveTo(x + 8, y - 7); ctx.lineTo(x + 3, y - 3); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 4, y - 1, 2, 0, 6.28); ctx.arc(x + 4, y - 1, 2, 0, 6.28); ctx.fill();
    } else if (e.kind === 'mail') {
      ctx.fillStyle = e.hitT > 0 ? '#fff' : '#e8e4d8';
      ctx.fillRect(x - 14, y - 10, 28, 20);
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 14, y - 10); ctx.lineTo(x, y + 2); ctx.lineTo(x + 14, y - 10); ctx.stroke();
      ctx.fillStyle = '#c1272d'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', x + 10, y - 13);
    } else if (e.kind === 'bot') {
      ctx.fillStyle = e.hitT > 0 ? '#fff' : '#6b7280';
      ctx.fillRect(x - 17, y - 15, 34, 30);
      ctx.strokeStyle = '#374151'; ctx.strokeRect(x - 17, y - 15, 34, 30);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x, y - 2, 6, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.beginPath(); ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 24); ctx.stroke();
    } else {
      const g2 = ctx.createRadialGradient(x, y, 5, x, y, e.r);
      g2.addColorStop(0, '#ef4444'); g2.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(x, y, e.r, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 11, y - 6, 5, 0, 6.28); ctx.arc(x + 11, y - 6, 5, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(x - 11, y - 5, 2.4, 0, 6.28); ctx.arc(x + 11, y - 5, 2.4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BOSS', x, y - e.r - 8);
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(x - 34, y - e.r - 22, 68, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 34, y - e.r - 22, 68 * Math.max(0, e.hp / e.hpMax), 5);
    }
    if (e.slow > 0) {
      ctx.fillStyle = 'rgba(56,189,248,.25)';
      ctx.beginPath(); ctx.arc(x, y, e.r + 4, 0, 6.28); ctx.fill();
    }
    if (e.breakT > 0) {
      /* 破防：金色裂纹标记 */
      ctx.strokeStyle = '#f0d488'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - e.r - 3); ctx.lineTo(x - 1, y - e.r - 9);
      ctx.lineTo(x + 4, y - e.r - 4); ctx.lineTo(x + 8, y - e.r - 10);
      ctx.stroke();
    }
  });

  /* 闪电链 */
  if (G._bolt) G._bolt.forEach(b => {
    ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(b.a.x, b.a.y); ctx.stroke();
  });

  /* 飞轮 */
  if (G.sk.feilun) {
    const n = 1 + Math.floor(G.sk.feilun / 2), rad = 74;
    G._flPos = [];
    for (let i = 0; i < n; i++) {
      const a = (G._fl || 0) + i * 6.28 / n;
      const ox = P.x + Math.cos(a) * rad, oy = P.y + Math.sin(a) * rad;
      G._flPos.push([ox, oy]);
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(a * 3);
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(-11, -3, 22, 6);
      ctx.fillStyle = '#f0d488';
      ctx.fillRect(-11, -3, 22, 2);
      ctx.restore();
    }
  }

  /* ---- 近战斩击弧 ---- */
  if (G.slash) G.slash.forEach(s => {
    const k = 1 - s.life / .22;
    ctx.strokeStyle = `rgba(252,165,165,${(1 - k) * .95})`;
    ctx.lineWidth = 9 - k * 5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (.72 + k * .3), s.a - .9, s.a + .9);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * .55})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (.72 + k * .3), s.a - .9, s.a + .9);
    ctx.stroke();
  });

  /* ---- 冲击波环 ---- */
  if (G.waves) G.waves.forEach(w => {
    const a = Math.max(0, w.life);
    ctx.strokeStyle = `rgba(253,186,116,${a * .8})`;
    ctx.lineWidth = 8 * a + 2;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 6.28); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * .4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r * .93, 0, 6.28); ctx.stroke();
  });

  /* ---- 投掷物 & 爆炸 ---- */
  if (G.bombs) G.bombs.forEach(b => {
    const k = Math.min(1, b.t / b.dur);
    const hgt = Math.sin(k * Math.PI) * 46;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 9, 4, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#d4d4d8';
    ctx.fillRect(b.x - 7, b.y - 9 - hgt, 14, 14);
    ctx.strokeStyle = '#71717a'; ctx.lineWidth = 1;
    ctx.strokeRect(b.x - 7, b.y - 9 - hgt, 14, 14);
  });
  if (G.boom) {
    const k = 1 - G.boom.t / .3;
    ctx.strokeStyle = `rgba(251,191,36,${(1 - k) * .9})`;
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(G.boom.x, G.boom.y, G.boom.r * k, 0, 6.28); ctx.stroke();
    ctx.fillStyle = `rgba(251,191,36,${(1 - k) * .22})`;
    ctx.beginPath(); ctx.arc(G.boom.x, G.boom.y, G.boom.r * k, 0, 6.28); ctx.fill();
  }

  /* ---- 持续光束 ---- */
  if (G.art === 'beam' && G.mode === 'play') {
    const a = G.beamAng || 0, len = G.beamLen || 340;
    const gr = ctx.createLinearGradient(P.x, P.y, P.x + Math.cos(a) * len, P.y + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(244,114,182,.85)');
    gr.addColorStop(1, 'rgba(244,114,182,0)');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 9 + Math.sin(t * 30) * 2;
    ctx.beginPath(); ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x + Math.cos(a) * len, P.y + Math.sin(a) * len); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x + Math.cos(a) * len, P.y + Math.sin(a) * len); ctx.stroke();
    ctx.fillStyle = 'rgba(244,114,182,.6)';
    for (let i = 0; i < 4; i++) {
      const rr = (t * 260 + i * 70) % len;
      ctx.beginPath(); ctx.arc(P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr, 4, 0, 6.28); ctx.fill();
    }
  }

  /* ---- 蓄力贯穿的枪口闪光 ---- */
  if (G.chargeFx > 0) {
    ctx.fillStyle = `rgba(103,232,249,${G.chargeFx * 3})`;
    ctx.beginPath(); ctx.arc(P.x, P.y, 26, 0, 6.28); ctx.fill();
  }

  /* 玩家 */
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(P.x, P.y + 20, 18, 6, 0, 0, 6.28); ctx.fill();
  /* 光圈：随热度由金转红 */
  const hz = G.heat / 100;
  ctx.strokeStyle = G.crisis > 0
    ? `rgba(239,68,68,${.6 + Math.sin(t * 12) * .3})`
    : `rgba(${240 + hz * 15},${212 - hz * 120},${136 - hz * 90},.55)`;
  ctx.lineWidth = 2 + hz * 2;
  ctx.beginPath(); ctx.arc(P.x, P.y + 2, 30 + Math.sin(t * 3) * 2, 0, 6.28); ctx.stroke();
  const bob = Math.sin(t * 5) * 2;
  ctx.save();
  ctx.translate(P.x, P.y + bob);
  if (P.invT > 0) ctx.globalAlpha = .45 + Math.sin(t * 40) * .3;
  ctx.drawImage(FACES[G.fig.id], -30, -34, 60, 60);
  ctx.restore();
  ctx.globalAlpha = 1;

  /* 子弹 */
  G.bullets.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 6.28); ctx.fill();
    ctx.globalAlpha = .35;
    ctx.beginPath(); ctx.arc(b.x - b.vx * .012, b.y - b.vy * .012, 6.5, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  });

  /* 粒子 / 伤害数字 */
  G.fx.forEach(f => {
    ctx.globalAlpha = Math.min(1, f.life * 2.2);
    ctx.fillStyle = f.c;
    ctx.fillRect(f.x - f.sz / 2, f.y - f.sz / 2, f.sz, f.sz);
  });
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  G.dmgTxt.forEach(d => {
    ctx.globalAlpha = Math.min(1, d.life * 1.8);
    ctx.fillStyle = d.color;
    ctx.fillText(d.v, d.x, d.y);
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  /* 顶部警示条 */
  ctx.textAlign = 'center';
  if (G.bossAlive > 0) {
    ctx.fillStyle = 'rgba(239,68,68,.85)';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('⚠ 舆论海啸出现', W / 2, 22);
  }
  /* 危机期：屏幕红色边框脉动 */
  if (G.crisis > 0) {
    const a = .25 + Math.sin(t * 9) * .15;
    ctx.strokeStyle = `rgba(239,68,68,${a})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.fillStyle = 'rgba(239,68,68,.9)';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('塌 房 危 机', W / 2, 52);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`撑住 ${G.crisis.toFixed(1)} 秒 —— 撑过去全场清空并升 1 级`, W / 2, 72);
  } else if (G.heat > 80) {
    ctx.fillStyle = `rgba(245,158,11,${.55 + Math.sin(t * 8) * .3})`;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('热度逼近临界 · 按「降温」泄压', W / 2, 52);
  }
}

/* ---------- HUD ---------- */
function syncHud() {
  const P = G.P;
  document.getElementById('hp').style.width = Math.max(0, P.hp / P.hpMax * 100) + '%';
  document.getElementById('xp').style.width = Math.min(100, G.xp / G.xpMax * 100) + '%';
  document.getElementById('pLv').textContent = 'Lv' + G.lv;
  /* 热度条 */
  const hw = document.getElementById('heatWrap'), hb = document.getElementById('heat');
  hb.style.width = G.heat + '%';
  document.getElementById('heatTx').textContent =
    G.crisis > 0 ? `⚠ 塌房危机 ${G.crisis.toFixed(1)}s` : `热度 ${Math.round(G.heat)} / 100`;
  hw.classList.toggle('warn', G.heat > 75 || G.crisis > 0);
  /* 风向 */
  const w = WIND[G.wind];
  document.getElementById('wind').innerHTML = `舆论风向 <b>${w.ic} ${w.name}</b> · ${w.desc}`;
  /* 降温按钮 */
  const cb = document.getElementById('cool');
  const ready = G.coolT <= 0 && G.heat >= 12;
  cb.disabled = !ready;
  cb.classList.toggle('ready', ready);
  document.getElementById('coolTx').textContent = G.coolT > 0 ? Math.ceil(G.coolT) + 's' : (G.heat < 12 ? '热度不足' : '就绪');
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60);
  document.getElementById('tm').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  document.getElementById('kk').textContent = G.kills;
}

function gameOver() {
  G.mode = 'over';
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60);
  const rec = G.t >= G.best && G.t > 1;
  document.getElementById('endT').textContent = rec ? '新 纪 录 ！' : '被热度吞没';
  document.getElementById('endI').innerHTML =
    `${G.fig.name} 坚持了 <b style="color:var(--gold2)">${m} 分 ${s} 秒</b>　·　Lv${G.lv}　·　击杀 <b style="color:var(--gold2)">${G.kills}</b><br>`
    + `历史最佳 ${fmt(G.best)}　·　获得技能 ${Object.keys(G.sk).length} 项`;
  document.getElementById('ovEnd').classList.remove('hide');
}
const fmt = v => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');

/* ---------- 事件绑定 ---------- */
const appEl = document.getElementById('app');
appEl.addEventListener('pointerdown', ev => {
  tapfx(ev);
  /* 点按钮 / HUD 时不要启动摇杆 */
  if (ev.target.closest('#cool') || ev.target.closest('#hud') || ev.target.closest('#skills') || ev.target.closest('.ov')) return;
  if (G && G.mode === 'play') stickStart(ev.clientX, ev.clientY);
});
appEl.addEventListener('pointermove', ev => { if (stBase) stickMove(ev.clientX, ev.clientY); });
appEl.addEventListener('pointerup', stickEnd);
appEl.addEventListener('pointercancel', stickEnd);
addEventListener('pointerup', stickEnd);
function tapfx(ev) {
  const d = document.createElement('div');
  d.className = 'tapfx';
  d.style.left = ev.clientX + 'px';
  d.style.top = ev.clientY + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 480);
}

document.getElementById('cool').onclick = coolDown;
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); coolDown(); } });
document.getElementById('btnGo').onclick = startGame;
/* 兜底：click 未触发时 pointerdown 直接触发（避免极端环境下点不动） */
document.getElementById('btnGo').addEventListener('pointerdown', e => { e.preventDefault(); if (!(typeof G !== 'undefined' && G)) startGame(); });
document.getElementById('btnAgain').onclick = () => { document.getElementById('ovEnd').classList.add('hide'); shufflePicks(); document.getElementById('ovPick').classList.remove('hide'); G.mode = 'pick'; };
document.getElementById('btnShuffle').onclick = shufflePicks;

/* ---------- 等比缩放适配任意窗口 ---------- */
function fit() {
  const s = Math.min(innerWidth / 480, innerHeight / 840);
  const appEl2 = document.getElementById('app');
  appEl2.style.transform = s < 1 ? `scale(${s})` : '';
  appEl2.style.margin = s < 1 ? `${(840 * s - 840) / 2}px ${(480 * s - 480) / 2}px` : '';
}
addEventListener('resize', fit);
fit();

/* ---------- 启动 ---------- */
shufflePicks();
requestAnimationFrame(loop);
