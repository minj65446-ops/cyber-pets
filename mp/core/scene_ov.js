/* =========================================================
   core/scene_ov.js —— 遮罩层：战斗 / 结算 / 详情 / 新获得
   单独成文件，避免与 scene.js 互相 require
   ========================================================= */
const UI = require('./ui.js');
const ST = require('./store.js');
const BT = require('./battle.js');
const Face = require('./face.js');
const { VW, VH, C } = UI;

function avatar(id, x, y, size) {
  const ctx = UI.rawCtx();
  if (!ctx) return;
  const cv = Face.get(id, ST.FIG_MAP, 64);
  if (cv) { try { ctx.drawImage(cv, x, y, size, size); return; } catch (e) { } }
  UI.rr(x, y, size, size, 6, '#241f30', C.line, 1);
  UI.text('侠', x + size / 2, y + size / 2, size * .42, C.dim, 'center', '800');
}
function scrim(fn) {
  const c = UI.rawCtx();
  if (c) { c.fillStyle = 'rgba(6,5,10,.86)'; c.fillRect(0, 0, VW, VH); }
  if (fn) UI.zone(0, 0, VW, VH, fn, 'scrim');
}

/* ---------------- 战斗 ---------------- */
function unitBox(u, x, y, w, h, mine) {
  const ctx = UI.rawCtx();
  const dead = u.dead;
  const bg = dead ? '#141119' : (mine ? '#1c1826' : '#241a1e');
  const bd = dead ? '#1f1b28' : (mine ? C.line : '#3a2630');
  UI.rr(x, y, w, h, 8, bg, bd, 1);
  if (ctx) ctx.globalAlpha = dead ? .35 : 1;
  avatar(u.id, x + 6, y + 6, 42);
  UI.text(dead ? u.name : u.name, x + 54, y + 16, 11, dead ? C.dim : C.light, 'left', '700');
  UI.text(mine ? ST.SCHOOL[u.school].full : ST.SCHOOL[u.school].full, x + 54, y + 32, 9.5, ST.SCHOOL[u.school].col, 'left', '600');
  /* 血条 */
  UI.bar(x + 6, y + h - 18, w - 12, 7, u.hp, u.hpMax, dead ? '#3a3345' : (mine ? C.green : C.red));
  UI.text(Math.max(0, u.hp) + '/' + u.hpMax, x + w - 8, y + h - 30, 9, C.ink2, 'right', '400');
  if (ctx) ctx.globalAlpha = 1;
  /* 状态标记 */
  let bx = x + 6;
  const marks = [];
  if (u.buf.dot > 0) marks.push(['血', C.red]);
  if (u.buf.stun > 0) marks.push(['眩', C.purple]);
  if (u.buf.slow > 0) marks.push(['滞', C.blue]);
  if (u.buf.atkUp > 0) marks.push(['攻', C.gold2]);
  if (u.buf.defUp > 0) marks.push(['御', C.green]);
  marks.forEach(m => { UI.tag(bx, y + h - 34, m[0], m[1], 8.5); bx += 17; });
  /* 怒气 */
  if (mine) UI.bar(x + 6, y + h - 8, w - 12, 4, u.rage || 0, 100, u.rage >= 100 ? C.gold : '#6b5a2e');
}

function drawBattle(A, App) {
  const b = BT.battleState();
  if (!b) { A.ov = null; return; }
  const S = ST.state();
  scrim(null);   /* 吞掉穿透点击 */
  const c = UI.rawCtx();
  if (c) {
    const g = c.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#1b1730'); g.addColorStop(1, '#0d0b16');
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  }
  UI.zone(0, 0, VW, VH, null, 'block');
  const info = ST.stageInfo(b.n);
  UI.text(info.name, 14, 22, 14, C.light, 'left', '800');
  UI.text('我方 ' + b.heroes.length + ' 人 · 战力 ' + ST.fmt(ST.teamPower()) + '　敌 ' + b.foes.length + ' 人 · 回合 ' + b.turn,
    14, 44, 10.5, C.ink2, 'left', '400');
  UI.text(b.phase === 'run' ? '交战中…' : '战斗结束', VW - 14, 22, 11.5, b.phase === 'run' ? C.gold2 : C.green, 'right', '700');

  const gw = 148, gh = 78;
  const gx = [12, 166, 320];
  /* 敌方：从上往下排 */
  b.foes.forEach((u, i) => {
    const x = gx[i % 3], y = 110 + Math.floor(i / 3) * (gh + 8);
    unitBox(u, x, y, gw, gh, false);
  });
  UI.text('— 分 庭 抗 礼 —', VW / 2, 300, 11, C.dim, 'center', '600');
  /* 我方：前排在上 */
  b.heroes.forEach((u, i) => {
    const x = gx[i % 3], y = 330 + Math.floor(i / 3) * (gh + 8);
    unitBox(u, x, y, gw, gh, true);
  });
  /* 战斗日志 */
  UI.panel(12, 520, VW - 24, 190, '战 报');
  const logs = b.log.slice(-6);
  logs.forEach((t, i) => {
    const col = t.indexOf('★') === 0 ? C.gold : (t.indexOf('力竭') >= 0 ? C.red : C.ink2);
    UI.text(t, 22, 548 + i * 26, 10.5, col, 'left', '400');
  });

  /* 底部按钮 */
  if (b.phase === 'run') {
    UI.button(12, 730, 140, 46, '加速 ×' + (S.speed || 2), {
      fill: C.panel2, stroke: C.line, size: 12,
      onTap: () => { S.speed = S.speed === 2 ? 4 : S.speed === 4 ? 8 : 2; ST.save(); },
    });
    UI.button(VW - 152, 730, 140, 46, '撤 退', {
      fill: C.panel2, stroke: '#9c3350', color: '#ffd7df', size: 12,
      onTap: () => { BT.quit(); A.ov = null; A.result = null; A.page = 'stage'; },
    });
  }
  if (A.result) drawResult(A, App);
}

function drawResult(A, App) {
  const r = A.result;
  const S = ST.state();
  const w = 380, h = 300, x = (VW - w) / 2, y = 250;
  UI.rr(x, y, w, h, 12, '#17131f', C.gold, 1.6);
  UI.text(r.win ? '大 获 全 胜' : '力 有 未 逮', VW / 2, y + 46, 22, r.win ? C.light : C.red, 'center', '800');
  UI.text(r.win
    ? '第 ' + r.stage + ' 阵告破 · 存活 ' + r.aliveHero + '/' + r.heroTotal + ' 人 · ' + r.turns + ' 回合'
    : '第 ' + r.stage + ' 阵失利 · 建议提升侠客等级或调整阵容',
    VW / 2, y + 82, 11.5, C.ink2, 'center', '400');
  if (r.gain) {
    UI.text('银两 +' + ST.fmt(r.gain.gold) + '　修为 +' + ST.fmt(r.gain.exp) + (r.gain.tic ? '　招募帖 +' + r.gain.tic : ''),
      VW / 2, y + 118, 12.5, C.gold2, 'center', '700');
  }
  UI.text('可在「侠客」页消耗资源修炼与突破', VW / 2, y + 146, 10, C.dim, 'center', '400');
  UI.button(x + 40, y + 190, w - 80, 50, r.win ? '继续挑战' : '返回整备', {
    fill: '#3a2a12', stroke: C.gold, color: C.light, size: 14,
    onTap: () => {
      A.ov = null; A.result = null; BT.clearBattle();
      A.page = r.win ? 'stage' : 'hero'; A.scroll = 0;
    },
  });
}

/* ---------------- 侠客详情 ---------------- */
function drawDetail(A, App) {
  const id = A.curId;
  if (!id) { A.ov = 'detail'; return; }
  const f = ST.FIG_MAP[id];
  const own = !!ST.state().heroes[id];
  const h = ST.state().heroes[id] || { lv: 1, star: 0 };
  scrim(() => { A.ov = null; });
  const w = 420, hh = 620, x = (VW - w) / 2, y = 130;
  UI.rr(x, y, w, hh, 12, '#17131f', C.line, 1.2);
  avatar(id, x + 24, y + 20, 88);
  UI.text(f.name, x + 126, y + 34, 17, C.light, 'left', '800');
  UI.text(f.class && ST.CLASS2SCHOOL[f.class] ? ST.SCHOOL[ST.schoolOf(id)].full + ' · ' + ST.CLASS2SCHOOL[f.class] : '', x + 126, y + 58, 11, ST.SCHOOL[ST.schoolOf(id)].col, 'left', '700');
  UI.tag(x + 126, y + 74, f.tier, { R: '#8b93a8', SR: '#5fa8e0', SSR: '#e0b64a', UR: '#c07ae8' }[f.tier] || C.ink2, 10);
  UI.text(own ? 'Lv' + h.lv + '　' + '★'.repeat(h.star) + (h.star ? '' : '（未突破）') : '尚未招募', x + 190, y + 82, 11, C.gold2, 'left', '700');
  UI.line(x + 20, y + 118, x + w - 20, y + 118, C.line);

  if (!own) {
    UI.text(f.title || '', x + 24, y + 145, 12, C.ink2, 'left', '600');
    UI.text('在「招募」页发帖结识这位侠客。', x + 24, y + 175, 11.5, C.ink2, 'left', '400');
    UI.button(x + 90, y + hh - 74, w - 180, 46, '关 闭', { fill: C.panel2, stroke: C.line, size: 13, onTap: () => { A.ov = null; } });
    return;
  }
  const s = ST.heroStat(id);
  const rows = [
    ['气血', String(s.hpMax)], ['攻击', String(s.atk)], ['防御', String(s.def)],
    ['速度', String(s.spd)], ['暴击', Math.round(s.crit * 100) + '%'], ['治疗', String(s.heal)],
    ['战力', ST.fmt(ST.power(id))],
  ];
  rows.forEach((r, i) => {
    const cx = x + 24 + (i % 3) * 128, cy = y + 148 + Math.floor(i / 3) * 46;
    UI.text(r[0], cx, cy, 10.5, C.ink2, 'left', '400');
    UI.text(r[1], cx + 92, cy, 13, C.light, 'right', '700');
  });
  UI.line(x + 20, y + 280, x + w - 20, y + 280, C.line);
  UI.text('成名作', x + 24, y + 306, 12, C.gold2, 'left', '800');
  UI.text('「' + (f.np && f.np.name ? f.np.name : '—') + '」', x + 24, y + 330, 12.5, C.light, 'left', '700');
  const eff = (f.np && f.np.effect) ? f.np.effect : '';
  UI.text(eff.slice(0, 34), x + 24, y + 352, 10.5, C.ink2, 'left', '400');
  UI.text(eff.slice(34, 72), x + 24, y + 370, 10.5, C.ink2, 'left', '400');
  UI.text('台词', x + 24, y + 402, 12, C.gold2, 'left', '800');
  UI.text('「' + (f.quote || '—') + '」', x + 24, y + 424, 11, C.ink2, 'left', '400');

  /* 操作 */
  const tc = ST.trainCost(id), bc = ST.breakCost(id);
  const on = ST.state().team.indexOf(id) >= 0;
  UI.button(x + 24, y + hh - 156, w - 48, 46, '修炼 → Lv' + (h.lv + 1) + '（' + ST.fmt(tc.gold) + ' 银两 / ' + ST.fmt(tc.exp) + ' 修为）',
    { fill: '#221d2e', stroke: C.gold, size: 12, onTap: () => App.train(id) });
  UI.button(x + 24, y + hh - 104, w - 48, 46, '突破 → ★' + (h.star + 1) + '（' + ST.fmt(bc.gold) + ' 银两 / ' + ST.fmt(bc.exp) + ' 修为）',
    { fill: '#221d2e', stroke: C.purple, color: '#d9cdff', size: 12, onTap: () => App.breakUp(id) });
  UI.button(x + 24, y + hh - 52, w / 2 - 32, 42, on ? '卸 下' : '上 阵',
    { fill: C.panel2, stroke: on ? '#9c3350' : C.green, color: on ? '#ffd7df' : '#bdf0d4', size: 12, onTap: () => { App.toggleSlot(ST.state().team.indexOf(null) >= 0 ? ST.state().team.indexOf(null) : (ST.state().team.indexOf(id) >= 0 ? ST.state().team.indexOf(id) : 0), id); App.toast(on ? '已卸下 ' + f.name : '已上阵 ' + f.name); } });
  UI.button(x + w / 2 + 8, y + hh - 52, w / 2 - 32, 42, '关 闭',
    { fill: C.panel2, stroke: C.line, size: 12, onTap: () => { A.ov = null; } });
}

/* ---------------- 新获得 ---------------- */
function drawNew(A, App) {
  const list = A.newList || [];
  scrim(() => { A.ov = null; });
  const w = 400, hh = 430, x = (VW - w) / 2, y = 210;
  UI.rr(x, y, w, hh, 12, '#17131f', C.gold, 1.6);
  UI.text('结 识 新 侠 客', VW / 2, y + 44, 19, C.light, 'center', '800');
  UI.text('共 ' + list.length + ' 位加入你的阵容', VW / 2, y + 74, 11, C.ink2, 'center', '400');
  list.slice(0, 6).forEach((g, i) => {
    const cx = x + 22 + (i % 3) * 122, cy = y + 100 + Math.floor(i / 3) * 132;
    UI.rr(cx, cy, 112, 122, 8, C.panel2, C.line, 1);
    avatar(g.f.id, cx + 24, cy + 10, 64);
    UI.text(g.f.name, cx + 56, cy + 90, 11, C.light, 'center', '700');
    UI.tag(cx + 72, cy + 8, g.f.tier, { R: '#8b93a8', SR: '#5fa8e0', SSR: '#e0b64a', UR: '#c07ae8' }[g.f.tier] || C.ink2, 9.5);
  });
  UI.button(x + 70, y + hh - 66, w - 140, 46, '知 道 了', {
    fill: '#3a2a12', stroke: C.gold, color: C.light, size: 14, onTap: () => { A.ov = null; },
  });
}

module.exports = { drawBattle, drawDetail, drawNew };
