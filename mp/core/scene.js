/* =========================================================
   core/scene.js —— 五个主页面渲染（全部 Canvas 自绘）
   ========================================================= */
const UI = require('./ui.js');
const ST = require('./store.js');
const Face = require('./face.js');
const OV = require('./scene_ov.js');
const { VW, VH, C } = UI;

const TIER_COL = { R: '#8b93a8', SR: '#5fa8e0', SSR: '#e0b64a', UR: '#c07ae8' };
const TOPH = 88, TABH = 58;
const CX = 12, CW = VW - 24;        // 内容区左右边距与宽度
const CY = TOPH + 8, CH = VH - TABH - CY - 4;

/* 画头像：优先用离屏缓存，取不到就画占位块（Node 测试环境） */
function avatar(id, x, y, size) {
  const ctx = UI.rawCtx();
  if (!ctx) return;
  const cv = Face.get(id, ST.FIG_MAP, 64);
  if (cv) {
    try { ctx.drawImage(cv, x, y, size, size); return; } catch (e) { }
  }
  UI.rr(x, y, size, size, 6, '#241f30', C.line, 1);
  UI.text('侠', x + size / 2, y + size / 2, size * .42, C.dim, 'center', '800');
}
function tierTag(x, y, tier) {
  const col = TIER_COL[tier] || C.ink2;
  UI.rr(x, y, 30, 15, 3, col + '2e', col, 1);
  UI.text(tier, x + 15, y + 8, 9.5, col, 'center', '800');
}

/* ---------------- 底部导航 ---------------- */
function drawTabs(A, tabs) {
  const y = VH - TABH;
  const c = UI.rawCtx();
  if (c) {
    const g = c.createLinearGradient(0, y, 0, VH);
    g.addColorStop(0, '#17131f'); g.addColorStop(1, '#0d0b16');
    c.fillStyle = g; c.fillRect(0, y, VW, TABH);
  }
  UI.line(0, y, VW, y, C.line);
  const w = VW / tabs.length;
  tabs.forEach((t, i) => {
    const on = A.page === t.k;
    const x = i * w;
    if (on) { UI.rr(x + 10, y + 4, w - 20, TABH - 12, 8, '#241f30', C.gold, 1); }
    UI.text(t.n, x + w / 2, y + TABH / 2, 13, on ? C.light : C.dim, 'center', on ? '800' : '600');
    UI.zone(x, y, w, TABH, () => require('./app.js').go(t.k), 'tab:' + t.k);
  });
}

/* ---------------- 江湖 ---------------- */
function drawHome(A, App) {
  const S = ST.state();
  /* 挂机插画 */
  UI.panel(CX, CY, CW, 152, '江 湖 夜 行');
  const c = UI.rawCtx();
  if (c) {
    const x0 = CX + 1, y0 = CY + 30, w0 = CW - 2, h0 = 120;
    c.save(); c.beginPath(); c.rect(x0, y0, w0, h0); c.clip();
    const g = c.createLinearGradient(0, y0, 0, y0 + h0);
    g.addColorStop(0, '#2b2144'); g.addColorStop(1, '#131020');
    c.fillStyle = g; c.fillRect(x0, y0, w0, h0);
    /* 远山 */
    c.fillStyle = 'rgba(212,176,98,.10)';
    c.beginPath(); c.moveTo(x0, y0 + h0);
    for (let i = 0; i <= 6; i++) {
      const px = x0 + (w0 * i) / 6, py = y0 + h0 - 30 - (i % 2 ? 26 : 8);
      c.lineTo(px, py);
    }
    c.lineTo(x0 + w0, y0 + h0); c.closePath(); c.fill();
    /* 灯笼 */
    [0.22, 0.5, 0.78].forEach((k, i) => {
      const lx = x0 + w0 * k, ly = y0 + 24 + (i % 2) * 14;
      c.fillStyle = 'rgba(226,120,90,' + (0.5 - i * 0.08) + ')';
      c.beginPath(); c.ellipse(lx, ly, 9, 11, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(240,212,136,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(lx, ly - 11); c.lineTo(lx, y0 + 6); c.stroke();
    });
    c.restore();
  }
  UI.text('离线收益随时结算 · 在线即自动积累', CX + 12, CY + 60, 11, C.ink2, 'left', '400');
  UI.text('当前第 ' + S.stage + ' 阵　最高第 ' + S.maxStage + ' 阵　战力 ' + ST.fmt(ST.teamPower()),
    CX + 12, CY + 82, 11.5, C.gold2, 'left', '700');

  /* 主按钮 */
  const by = CY + 164;
  UI.button(CX, by, 222, 52, '挑 战 关 卡', { fill: '#4a1f28', stroke: '#9c3350', color: '#ffd7df', size: 15, onTap: () => App.fight(S.stage) });
  UI.button(CX + 234, by, 222, 52, '收 取 挂 机', { fill: '#16304a', stroke: '#4a7fd4', color: '#cfe3ff', size: 15, onTap: () => { const r = App.idleTick(false); if (!r) require('./app.js').toast('刚刚结算过，稍等再来'); } });

  /* 状态卡 */
  const y2 = by + 66;
  UI.panel(CX, y2, CW, 132, '江 湖 状 态');
  const rows = [
    ['站在阵中', ST.owned().length + ' / ' + ST.FIG_ALL.length + ' 位'],
    ['阵容战力', ST.fmt(ST.teamPower())],
    ['闯关战绩', S.wins + ' 胜 / ' + S.fights + ' 战'],
    ['招募帖', String(S.tic) + ' 张'],
  ];
  rows.forEach((r, i) => {
    const yy = y2 + 46 + i * 22;
    UI.text(r[0], CX + 14, yy, 11.5, C.ink2, 'left', '400');
    UI.text(r[1], CX + CW - 14, yy, 11.5, C.light, 'right', '700');
  });

  /* 玩法说明 */
  const y3 = y2 + 144;
  UI.panel(CX, y3, CW, VH - TABH - y3 - 8, '玩 法 提 要');
  const tips = [
    '布阵：前排扛伤、后排输出，同流派 2/3/4 人触发共鸣加成。',
    '战斗：自动回合出手，怒气满放成名作，界面底部可加速。',
    '养成：银两与修为用于修炼升级、突破升星。',
    '推图：卡住就挂着，回来再练两级基本就能过。',
    '招募：招募帖十连必有 SR 及以上。',
  ];
  tips.forEach((t, i) => {
    UI.text('·', CX + 14, y3 + 48 + i * 22, 12, C.gold, 'left', '800');
    UI.text(t, CX + 26, y3 + 48 + i * 22, 11, C.ink2, 'left', '400');
  });
}

/* ---------------- 侠客谱 ---------------- */
function drawHero(A, App) {
  const S = ST.state();
  const list = A.heroFilter === 'own' ? ST.owned() : ST.FIG_ALL;
  /* 筛选 */
  ['own', 'all'].forEach((k, i) => {
    const on = A.heroFilter === k;
    UI.button(CX + i * 108, CY, 100, 30, k === 'own' ? '已招募' : '全图鉴', {
      fill: on ? '#2b2438' : C.panel2, stroke: on ? C.gold : C.line, color: on ? C.light : C.ink2, size: 11.5,
      onTap: () => { A.heroFilter = k; A.scroll = 0; },
    });
  });
  UI.text('共 ' + list.length + ' 位', CX + CW, CY + 15, 11, C.ink2, 'right', '600');

  const gy = CY + 42, gh = VH - TABH - gy - 6;
  const colW = 148, rowH = 176, gapX = 12;
  UI.clipRect(CX, gy, CW, gh);
  UI.zone(CX, gy, CW, gh, null, 'scrollheroes');
  list.forEach((f, i) => {
    const cx = CX + (i % 3) * (colW + gapX);
    const cy = gy + Math.floor(i / 3) * rowH - A.scroll;
    if (cy + rowH < gy - 10 || cy > gy + gh + 10) return;
    const own = !!S.heroes[f.id];
    const h = S.heroes[f.id] || { lv: 1, star: 0 };
    UI.rr(cx, cy, colW, rowH - 12, 9, own ? C.panel2 : '#121019', own ? C.line : '#211d2c', 1);
    avatar(f.id, cx + (colW - 72) / 2, cy + 10, 72);
    if (!own) { UI.rr(cx, cy, colW, rowH - 12, 9, 'rgba(8,7,12,.55)'); }
    tierTag(cx + 6, cy + 6, f.tier);
    UI.text(f.name, cx + colW / 2, cy + 94, 12.5, own ? C.light : C.dim, 'center', '800');
    if (own) {
      const sc = ST.SCHOOL[ST.schoolOf(f.id)];
      UI.text(sc.short + ' · Lv' + h.lv + ' ' + '★'.repeat(h.star), cx + colW / 2, cy + 114, 10.5, sc.col, 'center', '700');
      UI.text('战力 ' + ST.fmt(ST.power(f.id)), cx + colW / 2, cy + 132, 10, C.ink2, 'center', '400');
    } else {
      UI.text('未招募', cx + colW / 2, cy + 114, 10.5, C.dim, 'center', '400');
    }
    const onTeam = S.team.indexOf(f.id) >= 0;
    if (onTeam) UI.text('阵', cx + colW - 12, cy + 12, 10, C.green, 'center', '800');
    UI.zone(cx, cy, colW, rowH - 12, () => {
      A.curId = f.id; A.ov = 'detail';
    }, 'hero:' + f.id);
  });
  UI.unclip();
}

/* ---------------- 布阵 ---------------- */
function drawTeam(A, App) {
  const S = ST.state();
  UI.text('点已上阵的侠客可卸下，点下方候选可补进空位', CX, CY, 10.5, C.ink2, 'left', '400');
  UI.button(CX + CW - 96, CY - 8, 96, 28, '自动布阵', {
    fill: '#2b2438', stroke: C.gold, size: 11, onTap: () => App.autoFill(),
  });
  const roles = ['前排 · 扛伤', '前排 · 扛伤', '前排 · 扛伤', '后排 · 输出', '后排 · 输出', '后排 · 输出'];
  const gw = 148, gh = 96, gx = [CX, CX + 160, CX + 320];
  const gy0 = CY + 34, gy1 = CY + 142;
  S.team.forEach((id, i) => {
    const x = gx[i % 3], y = i < 3 ? gy0 : gy1;
    UI.rr(x, y, gw, gh, 9, id ? '#221d2e' : '#141119', id ? C.line : '#241f30', 1);
    UI.text(roles[i], x + 8, y + 12, 9.5, C.dim, 'left', '400');
    if (id) {
      avatar(id, x + 10, y + 22, 56);
      const sc = ST.SCHOOL[ST.schoolOf(id)];
      UI.text(ST.FIG_MAP[id].name, x + 72, y + 34, 11.5, C.light, 'left', '700');
      UI.text(sc.full, x + 72, y + 52, 10, sc.col, 'left', '700');
      UI.text('Lv' + S.heroes[id].lv, x + 72, y + 70, 10, C.ink2, 'left', '400');
      const st = ST.heroStat(id);
      UI.text('攻 ' + st.atk + ' 血 ' + st.hpMax, x + 10, y + gh - 8, 9.5, C.ink2, 'left', '400');
    } else {
      UI.text('空 位', x + gw / 2, y + gh / 2 + 6, 12, C.dim, 'center', '700');
    }
    UI.zone(x, y, gw, gh, () => {
      if (id) App.toggleSlot(i, id); else require('./app.js').toast('从下方候选里点一位上阵');
    }, 'slot:' + i);
  });
  const r = ST.resonance();
  UI.text(r.parts.length ? '流派共鸣：威力 +' + Math.round(r.add * 100) + '%' : '流派共鸣：凑同流派 2 人以上触发加成',
    CX, CY + 250, 11, r.parts.length ? C.green : C.ink2, 'left', '700');

  /* 候选 */
  const ly = CY + 268, lh = VH - TABH - ly - 6;
  UI.panel(CX, ly, CW, lh, '候 选 侠 客（' + ST.owned().length + '）');
  UI.clipRect(CX, ly + 30, CW, lh - 32);
  const cw = 148, chh = 150;
  ST.owned().forEach((f, i) => {
    const x = CX + (i % 3) * (cw + 12);
    const y = ly + 34 + Math.floor(i / 3) * chh - A.scroll;
    if (y + chh < ly + 20 || y > ly + lh) return;
    const on = S.team.indexOf(f.id) >= 0;
    UI.rr(x, y, cw, chh - 12, 8, on ? '#232d38' : C.panel2, on ? C.green : C.line, on ? 1.4 : 1);
    avatar(f.id, x + (cw - 64) / 2, y + 8, 64);
    UI.text(f.name, x + cw / 2, y + 86, 11.5, on ? C.green : C.light, 'center', '700');
    UI.text('战力 ' + ST.fmt(ST.power(f.id)), x + cw / 2, y + 104, 10, C.ink2, 'center', '400');
    UI.zone(x, y, cw, chh - 12, () => {
      if (on) { S.team[S.team.indexOf(f.id)] = null; ST.save(); require('./app.js').toast('已卸下 ' + f.name); return; }
      const empty = S.team.indexOf(null);
      if (empty < 0) { require('./app.js').toast('阵容已满，先卸下一位'); return; }
      S.team[empty] = f.id; ST.save();
    }, 'bench:' + f.id);
  });
  UI.unclip();
}

/* ---------------- 闯关 ---------------- */
function drawStage(A, App) {
  const S = ST.state();
  const from = Math.max(1, S.stage - 2);
  UI.text('当前第 ' + S.stage + ' 阵　最高第 ' + S.maxStage + ' 阵', CX, CY + 8, 11.5, C.gold2, 'left', '700');
  UI.text('阵容战力 ' + ST.fmt(ST.teamPower()) + '　每 5 阵必得招募帖', CX + CW, CY + 8, 10.5, C.ink2, 'right', '400');
  const y0 = CY + 26;
  for (let k = 0; k < 11; k++) {
    const n = from + k;
    const info = ST.stageInfo(n);
    const locked = n > S.maxStage;
    const y = y0 + k * 60;
    UI.rr(CX, y, CW, 52, 8, n === S.stage ? '#2b2438' : C.panel, locked ? '#1a1723' : (n < S.stage ? '#1b2a22' : C.line), 1);
    UI.text(String(n), CX + 18, y + 26, 15, locked ? C.dim : (n === S.stage ? C.light : C.ink2), 'center', '800');
    UI.text(info.name, CX + 40, y + 17, 11.5, locked ? C.dim : C.ink, 'left', '700');
    UI.text('敌 ' + info.cnt + ' 人　建议战力 ' + ST.fmt(info.power), CX + 40, y + 36, 10, C.ink2, 'left', '400');
    UI.button(CX + CW - 76, y + 11, 64, 30, locked ? '未解锁' : (n < S.stage ? '重打' : '挑战'), {
      disabled: locked, fill: n === S.stage ? '#4a1f28' : C.panel2, stroke: n === S.stage ? '#9c3350' : C.gold,
      size: 11, onTap: () => { S.stage = n; ST.save(); App.fight(n); },
    });
  }
}

/* ---------------- 招募 ---------------- */
function drawRecruit(A, App) {
  const S = ST.state();
  UI.button(CX, CY, CW, 56, '广 发 十 帖（必出 SR 及以上）', {
    fill: '#3a2a12', stroke: C.gold, color: C.light, size: 14, onTap: () => App.recruit(10),
  });
  UI.button(CX, CY + 66, CW / 2 - 6, 44, '单 抽 一 帖', { fill: C.panel2, stroke: C.line, size: 12, onTap: () => App.recruit(1) });
  UI.button(CX + CW / 2 + 6, CY + 66, CW / 2 - 6, 44, '查看图鉴', { fill: C.panel2, stroke: C.line, size: 12, onTap: () => require('./app.js').go('hero') });
  UI.text('当前招募帖：' + S.tic + ' 张', CX, CY + 126, 11.5, C.gold2, 'left', '700');

  const ry = CY + 146;
  UI.panel(CX, ry, CW, VH - TABH - ry - 6, '最 近 收 获');
  if (!A.recRes || !A.recRes.length) {
    UI.text('还没有招募记录，点上面的按钮试试手气。', CX + CW / 2, ry + 70, 11.5, C.ink2, 'center', '400');
  } else {
    A.recRes.forEach((g, i) => {
      const x = CX + 10 + (i % 5) * 88, y = ry + 40 + Math.floor(i / 5) * 104;
      if (y + 90 > VH - TABH) return;
      avatar(g.f.id, x, y, 64);
      if (g.type === 'new') { UI.rr(x - 2, y - 2, 68, 68, 6, null, C.gold, 1.4); }
      tierTag(x + 38, y + 50, g.f.tier);
      UI.text(g.f.name, x + 32, y + 82, 10.5, g.type === 'new' ? C.light : C.ink2, 'center', '700');
    });
  }
}

/* ---------------- 主渲染入口 ---------------- */
function render(A, App) {
  UI.clearHits();
  /* 战斗中不画底部 Tab：App.go() 会拦掉切页，画出来就是「点了没反应」的死按钮 */
  if (A.ov === 'battle') { OV.drawBattle(A, App); return; }
  UI.bg(App.tabTitle(), App.tabSub());
  if (A.page === 'home') drawHome(A, App);
  else if (A.page === 'hero') drawHero(A, App);
  else if (A.page === 'team') drawTeam(A, App);
  else if (A.page === 'stage') drawStage(A, App);
  else if (A.page === 'recruit') drawRecruit(A, App);
  drawTabs(A, App.TABS);
  if (A.ov === 'detail') OV.drawDetail(A, App);
  if (A.ov === 'new') OV.drawNew(A, App);
  drawToast(A);
}

function drawToast(A) {
  if (A.toastT <= 0 || !A.toastTxt) return;
  const c = UI.rawCtx();
  const w = UI.widthOf(A.toastTxt, 12.5, '600') + 34;
  const x = (VW - w) / 2, y = VH * 0.42;
  const alpha = Math.min(1, A.toastT / 0.4);
  if (c) { c.save(); c.globalAlpha = alpha; }
  UI.rr(x, y, w, 38, 8, 'rgba(8,7,12,.92)', C.gold, 1);
  UI.text(A.toastTxt, VW / 2, y + 19, 12.5, C.light, 'center', '600');
  if (c) c.restore();
}

module.exports = { render, avatar, tierTag, TIER_COL };
