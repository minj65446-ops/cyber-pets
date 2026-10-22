/* =========================================================
   赛博守卫战 · 塔防逻辑层
   依赖：hall-data.js（FIGURES/CLASSES）、portrait.js（drawFigure）
   ========================================================= */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');

/* ---------- 地图常量 ---------- */
const COLS = 9, ROWS = 5, CELL = 84, X0 = 64, Y0 = 25;
const cellX = c => X0 + c * CELL;
const cellY = r => Y0 + r * CELL;
const rowCY = r => cellY(r) + CELL / 2;

/* ---------- 数值表 ---------- */
const TIER_COST = { R: 50, SR: 90, SSR: 130, UR: 170 };
const ROLE = {
  lead:   { atk: 0,    cd: 2.5, range: 0,   label: '产热' },
  hard:   { atk: .55,  cd: .9,  range: 2,   label: '近战' },
  rush:   { atk: 1.0,  cd: 1.1, range: 3,   label: '突进' },
  snipe:  { atk: .85,  cd: 1.6, range: 99,  label: '全行' },
  stab:   { atk: 1.35, cd: 2.2, range: 99,  label: '爆点' },
  stunt:  { atk: .4,   cd: 3.2, range: 99,  label: '减速' },
  frenzy: { atk: .5,   cd: .55, range: 1.6, label: '狂乱' },
  witness:{ atk: 0,    cd: 4,   range: 0,   label: '光环' },
};
const ENEMY = {
  fan:   { name: '黑粉',   hp: W => 55 + W * 26,  spd: 20,  dmg: 1, bounty: 4 },
  mail:  { name: '举报信', hp: W => 130 + W * 55, spd: 13,  dmg: 2, bounty: 10 },
  bot:   { name: '风控机', hp: W => 280 + W * 110, spd: 8.5, dmg: 3, bounty: 18 },
  boss:  { name: '舆论海啸', hp: W => 800 + W * 240, spd: 5, dmg: 5, bounty: 80, boss: true },
};

/* ---------- 状态 ---------- */
let G = null;
function newGame() {
  return {
    mode: 'ready',            // ready | play | pause | over
    t: 0, heat: 200, life: 10, wave: 0,
    towers: [], enemies: [], shots: [], parts: [], floats: [],
    spawnQ: [], spawnT: 0, waveGap: 3, betweenWaves: true,
    hand: [], sel: -1, hover: -1,
    best: +(localStorage.getItem('td-best') || 0),
  };
}
G = newGame();

/* ---------- 头像预渲染 ---------- */
const FACES = {};
FIGURES.filter(s => !s.nc).forEach(s => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  drawFigure(c.getContext('2d'), s, 64, { still: true });
  FACES[s.id] = c;
});
const POOL = FIGURES.filter(s => !s.nc);

/* ---------- 卡槽 ---------- */
function drawCard(exclude) {
  const pool = POOL.filter(s => !exclude.some(h => h && h.id === s.id));
  const s = pool[Math.floor(Math.random() * pool.length)];
  return { id: s.id, cd: 0 };
}
/* 全量重建：只在开局调用一次，之后一律走 updateHandUI（避免重建导致点击落空） */
function renderHand() {
  const wrap = document.getElementById('hand');
  wrap.innerHTML = '';
  G.hand.forEach((h, i) => {
    const s = FIGURES.find(x => x.id === h.id);
    const cost = TIER_COST[s.tier] || 100;
    h.cost = cost;
    const cls = CLASSES[s.class];
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<span class="tier" style="color:${cls.color}">${s.tier}</span>`
      + `<div class="cost">🔥${cost}</div>`
      + `<div class="nm">${s.name}</div>`
      + `<div class="cls" style="color:${cls.color}">${cls.icon} ${cls.name}·${ROLE[s.class].label}</div>`
      + `<div class="cd" style="display:none"></div>`;
    d.insertBefore(faceNode(s.id), d.children[1]);
    d.onclick = () => {
      if (G.mode !== 'play' || h.cd > 0) return;
      G.sel = G.sel === i ? -1 : i;      // 钱不够也允许选中，放置时再提示
      updateHandUI();
    };
    h.el = d;
    wrap.appendChild(d);
  });
  updateHandUI();
}
/* 轻量刷新：只改样式 / 倒计时，不动 DOM 结构 */
function updateHandUI() {
  G.hand.forEach((h, i) => {
    if (!h.el) return;
    h.el.classList.toggle('sel', G.sel === i);
    h.el.classList.toggle('poor', G.heat < h.cost);
    const cd = h.el.querySelector('.cd');
    if (h.cd > 0) { cd.style.display = 'flex'; cd.textContent = Math.ceil(h.cd); }
    else cd.style.display = 'none';
  });
}
function faceNode(id) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  c.getContext('2d').drawImage(FACES[id], 0, 0);
  return c;
}

/* ---------- 放置 / 升级 ---------- */
function place(fig, col, row) {
  const s = FIGURES.find(x => x.id === fig.id);
  const hpMax = s.stats.耐 * 4;
  G.towers.push({
    fig: s, col, row, lv: 1, hp: hpMax, hpMax,
    tAtk: 0, x: cellX(col) + CELL / 2, y: rowCY(row),
  });
  G.heat -= TIER_COST[s.tier];
  fig.cd = 10;
  G.sel = -1;
  puff(G.towers[G.towers.length - 1].x, G.towers[G.towers.length - 1].y, CLASSES[s.class].color, 10);
}
function upCost(t) { return 50 + t.lv * 40; }
function upgrade(t) {
  const c = upCost(t);
  if (G.heat < c || t.lv >= 3) return;
  G.heat -= c;
  t.lv++;
  t.hpMax = Math.round(t.hpMax * 1.4);
  t.hp = t.hpMax;
  float(t.x, t.y - 26, 'LV' + t.lv, '#f0d488');
  puff(t.x, t.y, '#f0d488', 14);
}
const dmgMul = t => 1 + (t.lv - 1) * .5;
const heatMul = t => 1 + (t.lv - 1) * .35;

/* ---------- 敌人 ---------- */
function buildWave(w) {
  const q = [];
  const n = 5 + Math.floor(w * 1.8);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (w % 4 === 0 && i === n - 1) q.push('boss');
    else if (w >= 3 && r < .14) q.push('bot');
    else if (r < .45) q.push('mail');
    else q.push('fan');
  }
  return q;
}
function nextWave() {
  G.wave++;
  G.spawnQ = buildWave(G.wave);
  G.spawnT = 0;
  G.betweenWaves = false;
  float(cv.width / 2, 90, '第 ' + G.wave + ' 波 · ' + (G.wave % 4 === 0 ? '舆论海啸来袭！' : '热度风暴'), '#f0d488');
}
function spawn(kind) {
  const cfg = ENEMY[kind];
  const row = Math.floor(Math.random() * ROWS);
  G.enemies.push({
    kind, row, cfg, x: cv.width + 20,
    hp: cfg.hp(G.wave), hpMax: cfg.hp(G.wave),
    slow: 0, atkT: 0, wob: Math.random() * 6.28,
  });
}

/* ---------- 特效 ---------- */
function puff(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = 30 + Math.random() * 90;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: .5 + Math.random() * .3, color, size: 2 + Math.random() * 3 });
  }
}
function float(x, y, txt, color) { G.floats.push({ x, y, txt, color, life: 1.2 }); }

/* ---------- 主循环 ---------- */
let last = 0, paused = false;
function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0);
  last = ts;
  if (G.mode === 'play' && !paused) step(dt);
  render(ts / 1000);
  requestAnimationFrame(loop);
}

function step(dt) {
  G.t += dt;
  G.heat = Math.min(999, G.heat + 6 * dt);

  /* 卡槽冷却 */
  let handDirty = false;
  G.hand.forEach(h => { if (h.cd > 0) { h.cd -= dt; handDirty = true; } });
  if (handDirty) updateHandUI();

  /* 波次推进 */
  if (G.betweenWaves) {
    G.waveGap -= dt;
    if (G.waveGap <= 0) { nextWave(); G.waveGap = 5; }
  } else {
    G.spawnT -= dt;
    if (G.spawnQ.length && G.spawnT <= 0) {
      spawn(G.spawnQ.shift());
      G.spawnT = 1.4;
    }
    if (!G.spawnQ.length && !G.enemies.length) {
      G.betweenWaves = true;
      const bonus = 40 + G.wave * 10;
      G.heat = Math.min(999, G.heat + bonus);
      float(cv.width / 2, 120, '波次奖励 🔥+' + bonus, '#7dd87d');
      if (G.wave > G.best) { G.best = G.wave; localStorage.setItem('td-best', G.best); }
    }
  }

  /* 塔 */
  G.towers.forEach(t => {
    t.tAtk -= dt;
    const R = ROLE[t.fig.class];
    if (t.fig.class === 'lead') {
      if (t.tAtk <= 0) {
        t.tAtk = R.cd;
        const gain = Math.round(22 * heatMul(t));
        G.heat = Math.min(999, G.heat + gain);
        float(t.x, t.y - 30, '🔥+' + gain, '#ff9d4d');
      }
      return;
    }
    if (t.fig.class === 'witness') {
      if (t.tAtk <= 0) {
        t.tAtk = R.cd;
        const gain = Math.round(10 * heatMul(t));
        G.heat = Math.min(999, G.heat + gain);
        G.towers.forEach(o => { o.hp = Math.min(o.hpMax, o.hp + o.hpMax * .1); });
        float(t.x, t.y - 30, '✚ 全体回血', '#7dd87d');
      }
      return;
    }
    if (t.tAtk > 0) return;
    const atk = (t.fig.stats.力 + t.fig.stats.宝) / 2 * R.atk * dmgMul(t);
    const cxL = cellX(0);

    if (t.fig.class === 'frenzy') {
      const rad = R.range * CELL / 2 + 20;
      let hit = false;
      G.enemies.forEach(e => {
        if (Math.hypot(e.x - t.x, rowCY(e.row) - t.y) < rad) { hurt(e, atk); hit = true; }
      });
      if (hit) { t.tAtk = R.cd; t.hp -= t.hpMax * .008; }
      return;
    }
    if (t.fig.class === 'stunt') {
      const rowY = rowCY(t.row);
      const target = G.enemies.filter(e => e.row === t.row && e.x > t.x);
      const near = G.enemies.filter(e => Math.hypot(e.x - t.x, rowCY(e.row) - t.y) < CELL * 1.6);
      if (near.length) {
        t.tAtk = R.cd;
        near.forEach(e => { e.slow = 2; hurt(e, atk); });
        puff(t.x, t.y, '#38bdf8', 8);
      }
      return;
    }
    /* 同行目标 */
    const inRow = G.enemies.filter(e => e.row === t.row && e.x > t.x - 10 && e.x < cv.width);
    if (!inRow.length) return;
    if (t.fig.class === 'hard' || t.fig.class === 'rush') {
      const reach = t.x + R.range * CELL / 2 + 26;
      const tgt = inRow.filter(e => e.x <= reach).sort((a, b) => a.x - b.x)[0];
      if (tgt) {
        t.tAtk = R.cd;
        hurt(tgt, atk);
        puff((t.x + tgt.x) / 2, t.y, CLASSES[t.fig.class].color, 5);
      }
      return;
    }
    if (t.fig.class === 'snipe') {
      t.tAtk = R.cd;
      const tgt = inRow.sort((a, b) => b.x - a.x)[0];
      G.shots.push({ x: t.x, y: t.y - 10, tgt, dmg: atk, color: '#f0d488', spd: 520 });
      return;
    }
    if (t.fig.class === 'stab') {
      t.tAtk = R.cd;
      const tgt = inRow.sort((a, b) => b.hp - a.hp)[0];
      G.shots.push({ x: t.x, y: t.y - 6, tgt, dmg: atk, color: '#c1272d', spd: 700 });
    }
  });
  G.towers = G.towers.filter(t => t.hp > 0);
  if (G.towers.length && G.towers.some(t => t.hp <= 0)) puff(0, 0, '#555', 0);

  /* 敌人 */
  G.enemies.forEach(e => {
    const spd = e.cfg.spd * (e.slow > 0 ? .55 : 1) * (e.kind === 'boss' ? 1 : 1);
    if (e.slow > 0) e.slow -= dt;
    /* 前方有塔则停下攻击 */
    const block = G.towers.find(t => t.row === e.row && Math.abs(t.x - e.x) < 34 && t.x <= e.x);
    if (block) {
      e.atkT += dt;
      if (e.atkT >= 1) {
        e.atkT = 0;
        block.hp -= e.cfg.dmg * 6;
        puff(block.x, block.y, '#ff6b6b', 6);
        if (block.hp <= 0) { puff(block.x, block.y, '#888', 16); float(block.x, block.y - 20, block.fig.name + ' 下播了', '#999'); }
      }
    } else {
      e.atkT = 0;
      e.x -= spd * dt;
    }
    if (e.x < X0 + 8) {
      e.hp = -1;
      G.life -= e.cfg.dmg;
      float(X0 + 40, rowCY(e.row), '-' + e.cfg.dmg + ' ❤', '#ff6b6b');
      puff(X0 + 20, rowCY(e.row), '#c1272d', 14);
    }
  });
  /* 击杀奖励 */
  G.enemies = G.enemies.filter(e => {
    if (e.hp <= 0 && e.x > X0) {
      G.heat = Math.min(999, G.heat + e.cfg.bounty);
      puff(e.x, rowCY(e.row), e.kind === 'boss' ? '#c1272d' : '#7c3aed', e.kind === 'boss' ? 24 : 8);
      return false;
    }
    return e.hp > 0;
  });

  /* 弹丸 */
  G.shots = G.shots.filter(s => {
    if (!s.tgt || s.tgt.hp <= 0) return false;
    const ty = rowCY(s.tgt.row);
    const dx = s.tgt.x - s.x, dy = ty - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 16) { hurt(s.tgt, s.dmg); puff(s.tgt.x, ty, s.color, 4); return false; }
    s.x += dx / d * s.spd * dt;
    s.y += dy / d * s.spd * dt;
    return true;
  });

  /* 粒子 / 浮字 */
  G.parts = G.parts.filter(p => {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
    return p.life > 0;
  });
  G.floats = G.floats.filter(f => { f.life -= dt; f.y -= 26 * dt; return f.life > 0; });

  if (G.life <= 0) gameOver();
}

function hurt(e, dmg) {
  e.hp -= dmg;
  if (e.hp <= 0 && e.cfg) {
    /* boss 死亡全场清杂 */
    if (e.kind === 'boss') {
      G.enemies.forEach(o => { if (o !== e && o.hp > 0) o.hp -= 120; });
      float(e.x, rowCY(e.row) - 30, '海啸退去！', '#f0d488');
    }
  }
}

function gameOver() {
  G.mode = 'over';
  document.getElementById('maskOver').classList.remove('hide');
  document.getElementById('overTitle').textContent = G.wave > G.best ? '新纪录！' : '防线失守';
  document.getElementById('overInfo').innerHTML =
    `坚守到 <b style="color:var(--gold2)">第 ${G.wave} 波</b>　·　历史纪录 <b style="color:var(--gold2)">${G.best} 波</b><br>` +
    `场上还有 ${G.towers.length} 位在册者，他们守到了最后。`;
  syncHud();
}

/* ---------- 渲染 ---------- */
function render(t) {
  const W = cv.width, H = cv.height;
  /* 背景 */
  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#173225' : '#1a3a2a';
    ctx.fillRect(cellX(c), cellY(r), CELL, CELL);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.035)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(cellX(c), Y0); ctx.lineTo(cellX(c), Y0 + ROWS * CELL); ctx.stroke(); }
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(X0, cellY(r)); ctx.lineTo(X0 + COLS * CELL, cellY(r)); ctx.stroke(); }

  /* 防线 */
  const grd = ctx.createLinearGradient(0, 0, X0, 0);
  grd.addColorStop(0, '#3d1220'); grd.addColorStop(1, '#1c0c14');
  ctx.fillStyle = grd;
  ctx.fillRect(0, Y0, X0, ROWS * CELL);
  ctx.fillStyle = 'rgba(240,212,136,.9)';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(X0 / 2, Y0 + ROWS * CELL / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('人 设 防 线', 0, 4);
  ctx.restore();
  /* 防线耐久条 */
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  ctx.fillRect(4, Y0, 4, ROWS * CELL);
  ctx.fillStyle = G.life > 3 ? '#7dd87d' : '#ff6b6b';
  ctx.fillRect(4, Y0 + ROWS * CELL * (1 - G.life / 10), 4, ROWS * CELL * G.life / 10);

  /* 放置预览 */
  if (G.sel >= 0 && G.hover >= 0 && G.mode === 'play') {
    const h = G.hand[G.sel], col = G.hover % COLS, row = Math.floor(G.hover / COLS);
    if (h && !G.towers.some(x => x.col === col && x.row === row)) {
      ctx.globalAlpha = .5;
      ctx.drawImage(FACES[h.id], cellX(col) + 10, cellY(row) + 10, 64, 64);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#f0d488';
      ctx.strokeRect(cellX(col) + 2, cellY(row) + 2, CELL - 4, CELL - 4);
    }
  }

  /* 塔 */
  G.towers.forEach((tw, i) => {
    const bob = Math.sin(t * 2.4 + i * 1.7) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(tw.x, cellY(tw.row) + CELL - 12, 24, 8, 0, 0, 6.28);
    ctx.fill();
    ctx.drawImage(FACES[tw.fig.id], tw.x - 34, tw.y - 44 + bob, 68, 68);
    /* 等级星 */
    ctx.fillStyle = '#f0d488';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('★'.repeat(tw.lv), tw.x - 30, tw.y - 48 + bob);
    /* 血条 */
    if (tw.hp < tw.hpMax) {
      const w = 52;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(tw.x - w / 2, tw.y + 30, w, 5);
      ctx.fillStyle = tw.hp / tw.hpMax > .35 ? '#7dd87d' : '#ff6b6b';
      ctx.fillRect(tw.x - w / 2, tw.y + 30, w * Math.max(0, tw.hp / tw.hpMax), 5);
    }
  });

  /* 敌人 */
  G.enemies.forEach((e, i) => {
    const y = rowCY(e.row), wob = Math.sin(t * 6 + e.wob) * 2;
    const x = e.x, boss = e.kind === 'boss';
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + (boss ? 24 : 17), boss ? 26 : 15, boss ? 8 : 5, 0, 0, 6.28);
    ctx.fill();
    const yy = y + wob;
    if (e.kind === 'fan') {
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath(); ctx.arc(x, yy, 15, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, yy - 7); ctx.lineTo(x - 3, yy - 4); ctx.moveTo(x + 9, yy - 7); ctx.lineTo(x + 3, yy - 4); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 5, yy - 1, 2.4, 0, 6.28); ctx.arc(x + 5, yy - 1, 2.4, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, yy + 5, 4, .3, 2.84); ctx.stroke();
    } else if (e.kind === 'mail') {
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(x - 13, yy - 9, 26, 18);
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 13, yy - 9); ctx.lineTo(x, yy + 2); ctx.lineTo(x + 13, yy - 9); ctx.stroke();
      ctx.fillStyle = '#c1272d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', x + 9, yy - 12);
    } else if (e.kind === 'bot') {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(x - 14, yy - 13, 28, 26);
      ctx.strokeStyle = '#374151'; ctx.strokeRect(x - 14, yy - 13, 28, 26);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(x, yy - 2, 5, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.beginPath(); ctx.moveTo(x, yy - 13); ctx.lineTo(x, yy - 20); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, yy - 21, 2, 0, 6.28); ctx.stroke();
    } else {
      const grd = ctx.createRadialGradient(x, yy, 4, x, yy, 30);
      grd.addColorStop(0, '#ef4444'); grd.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, yy, 28, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 9, yy - 5, 4, 0, 6.28); ctx.arc(x + 9, yy - 5, 4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(x - 9, yy - 4, 2, 0, 6.28); ctx.arc(x + 9, yy - 4, 2, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, yy + 7, 8, .4, 2.74); ctx.stroke();
      ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BOSS', x, yy - 34);
    }
    /* 血条 */
    const bw = boss ? 56 : 30;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x - bw / 2, yy - (boss ? 40 : 26), bw, 4);
    ctx.fillStyle = boss ? '#ef4444' : '#f59e0b';
    ctx.fillRect(x - bw / 2, yy - (boss ? 40 : 26), bw * Math.max(0, e.hp / e.hpMax), 4);
    if (e.slow > 0) {
      ctx.fillStyle = 'rgba(56,189,248,.28)';
      ctx.beginPath(); ctx.arc(x, yy, boss ? 30 : 18, 0, 6.28); ctx.fill();
    }
  });

  /* 弹丸 */
  G.shots.forEach(s => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + (s.tgt.x > s.x ? -10 : 10), s.y); ctx.stroke();
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, 3.4, 0, 6.28); ctx.fill();
  });

  /* 粒子 / 浮字 */
  G.parts.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  G.floats.forEach(f => {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, f.x, f.y);
  });
  ctx.globalAlpha = 1;

  /* 波间提示 */
  if (G.mode === 'play' && G.betweenWaves && G.wave > 0) {
    ctx.fillStyle = 'rgba(240,212,136,.75)';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('下一波 ' + Math.ceil(G.waveGap) + 's', W / 2, 22);
  }
  syncHud();
}

/* ---------- HUD ---------- */
let hudT = 0;
function syncHud() {
  document.getElementById('uiHeat').textContent = Math.floor(G.heat);
  document.getElementById('uiWave').textContent = G.wave || 1;
  document.getElementById('uiLife').textContent = Math.max(0, G.life);
  document.getElementById('uiBest').textContent = G.best || '—';
  /* 轻量刷新卡槽样式（不重建 DOM，点击不会落空） */
  hudT++;
  if (hudT % 10 === 0) updateHandUI();
}

/* ---------- 输入 ---------- */
/* canvas 用 object-fit:contain 缩放，需按实际绘制区域换算（有黑边） */
function toCanvasXY(ev) {
  const rect = cv.getBoundingClientRect();
  const scale = Math.min(rect.width / cv.width, rect.height / cv.height);
  const dw = cv.width * scale, dh = cv.height * scale;
  const ox = rect.left + (rect.width - dw) / 2;
  const oy = rect.top + (rect.height - dh) / 2;
  return {
    x: (ev.clientX - ox) / scale,
    y: (ev.clientY - oy) / scale,
    inside: ev.clientX >= ox && ev.clientX <= ox + dw && ev.clientY >= oy && ev.clientY <= oy + dh,
  };
}
function pickCell(ev) {
  const p = toCanvasXY(ev);
  if (!p.inside) return -1;
  const c = Math.floor((p.x - X0) / CELL), r = Math.floor((p.y - Y0) / CELL);
  return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? r * COLS + c : -1;
}
cv.addEventListener('mousemove', ev => { G.hover = pickCell(ev); });
cv.addEventListener('mouseleave', () => { G.hover = -1; });
cv.addEventListener('click', ev => {
  G.hover = pickCell(ev);          /* 点击时重算，避免 hover 未更新导致落空 */
  if (G.mode !== 'play' || G.hover < 0) return;
  const col = G.hover % COLS, row = Math.floor(G.hover / COLS);
  const t = G.towers.find(x => x.col === col && x.row === row);
  if (t) {
    const c = upCost(t);
    if (t.lv >= 3) float(t.x, t.y - 26, '已满级 ★3', '#999');
    else if (G.heat < c) float(t.x, t.y - 26, '热度不足 🔥' + c, '#ff6b6b');
    else upgrade(t);
    return;
  }
  if (G.sel < 0) return;
  const h = G.hand[G.sel];
  const s = FIGURES.find(x => x.id === h.id);
  if (G.heat < (TIER_COST[s.tier] || 100)) {
    float(cellX(col) + CELL / 2, cellY(row) + 30, '热度不足 🔥' + (TIER_COST[s.tier] || 100), '#ff6b6b');
    return;
  }
  place(h, col, row);
  updateHandUI();
});
/* 触摸：直接按触点拾格（避免 300ms 延迟与 click 双触发） */
cv.addEventListener('touchstart', ev => {
  if (!ev.touches.length) return;
  const t = ev.touches[0];
  G.hover = pickCell({ clientX: t.clientX, clientY: t.clientY });
  if (G.hover >= 0) ev.preventDefault();
}, { passive: false });

/* ---------- 按钮 ---------- */
function startGame() {
  G = newGame();
  G.mode = 'play';
  G.hand = Array.from({ length: 6 }, () => drawCard(G.hand));
  renderHand();
  document.getElementById('maskStart').classList.add('hide');
  document.getElementById('maskOver').classList.add('hide');
  document.getElementById('btnPause').disabled = false;
  document.getElementById('btnPause').textContent = '暂停';
  paused = false;
}
document.getElementById('btnStart').onclick = startGame;
document.getElementById('btnAgain').onclick = startGame;
document.getElementById('btnRestart').onclick = startGame;
document.getElementById('btnPause').onclick = function () {
  paused = !paused;
  this.textContent = paused ? '继续' : '暂停';
};

/* ---------- 启动 ---------- */
/* 点击反馈圈：任何按下都有金圈——有圈=页面收到了；没圈=看的是缓存旧页，强刷即可 */
document.addEventListener('pointerdown', ev => {
  const d = document.createElement('div');
  d.className = 'tapfx';
  d.style.left = ev.clientX + 'px';
  d.style.top = ev.clientY + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 480);
});
const verTag = document.getElementById('verTag');
if (verTag) verTag.textContent = 'v2.1 · 点击生效';
G.hand = Array.from({ length: 6 }, () => drawCard(G.hand));
renderHand();
requestAnimationFrame(loop);
