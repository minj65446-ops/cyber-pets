/* =========================================================
   core/ui.js —— Canvas 自绘 UI 框架（替代 DOM）
   逻辑分辨率固定 480 x 880，由 index.js 统一缩放自适应屏幕
   命中区随每帧绘制重建；触摸时从后往前找（后画的在上层）
   ========================================================= */
const VW = 480, VH = 880;

const C = {
  gold: '#b98c2f', gold2: '#d4b060', light: '#f0d488',
  ink: '#e8e4da', ink2: '#9c9384', dim: '#6b6675',
  panel: '#15131c', panel2: '#1d1a26', line: '#2c2738',
  red: '#d1495b', green: '#3f9e6b', blue: '#4a7fd4', purple: '#8b6fd4',
  bg0: '#151226', bg1: '#0b0a12',
};

let ctx = null, hits = [], sc = 1;

function setCtx(c) { ctx = c; }
function setScale(s) { sc = s; }

/* ---------- 基础图元 ---------- */
function rr(x, y, w, h, r, fill, stroke, lw) {
  if (!ctx) return;
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad); ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad); ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

function font(size, weight) {
  const w = weight || '400';
  return w + ' ' + size + 'px -apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",Helvetica,sans-serif';
}

function text(str, x, y, size, color, align, weight) {
  if (!ctx || str === undefined || str === null) return;
  ctx.font = font(size, weight);
  ctx.fillStyle = color || C.ink;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(str), x, y);
}

function widthOf(str, size, weight) {
  if (!ctx) return 0;
  ctx.font = font(size, weight);
  return ctx.measureText(String(str)).width;
}

function line(x1, y1, x2, y2, color, lw) {
  if (!ctx) return;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color || C.line; ctx.lineWidth = lw || 1; ctx.stroke();
}

function clipText(str, size, maxW) {
  if (!ctx) return String(str);
  const s = String(str);
  ctx.font = font(size, '400');
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
  return out + '…';
}

/* ---------- 命中区 ---------- */
function clearHits() { hits = []; }
function zone(x, y, w, h, fn, tag) {
  hits.push({ x, y, w, h, fn, tag: tag || '' });
  return hits[hits.length - 1];
}
function pick(px, py) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const r = hits[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
  }
  return null;
}
function zoneCount() { return hits.length; }

/* ---------- 组合控件 ---------- */
/* 按钮：gradient 为主色调，disabled 变灰且不注册命中 */
function button(x, y, w, h, label, opt) {
  const o = opt || {};
  const dis = !!o.disabled;
  const fill = dis ? '#23202c' : (o.fill || C.panel2);
  const strokeC = dis ? '#2a2634' : (o.stroke || C.gold);
  rr(x, y, w, h, o.r === undefined ? 8 : o.r, fill, strokeC, dis ? 1 : 1.4);
  if (o.top) { /* 顶部高光 */ }
  const col = dis ? C.dim : (o.color || C.light);
  text(o.center === false ? label : clipText(label, o.size || 13, w - 14),
    o.center === false ? x + 12 : x + w / 2, y + h / 2, o.size || 13, col, o.center === false ? 'left' : 'center', o.weight || '700');
  if (!dis && o.onTap) zone(x, y, w, h, o.onTap, 'btn:' + label);
}

function tag(x, y, label, color, size) {
  const s = size || 9;
  const w = widthOf(label, s, '800') + 10;
  rr(x, y, w, 13, 3, color + '33', color, 1);
  text(label, x + w / 2, y + 7, s, color, 'center', '800');
  return w;
}

function bar(x, y, w, h, v, max, color, bg) {
  rr(x, y, w, h, h / 2, bg || '#241f30');
  const p = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
  if (p > 0) rr(x, y, Math.max(h, w * p), h, h / 2, color);
}

function panel(x, y, w, h, title) {
  rr(x, y, w, h, 10, C.panel, C.line, 1);
  if (title) {
    text(title, x + 12, y + 16, 11.5, C.gold2, 'left', '800');
    line(x + 10, y + 28, x + w - 10, y + 28, C.line);
  }
}

/* 背景：竖向渐变 + 顶部标题条 */
function bg(title, sub) {
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, C.bg0); g.addColorStop(1, C.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  if (title) {
    const h = ctx.createLinearGradient(0, 0, 0, 92);
    h.addColorStop(0, '#221d31'); h.addColorStop(1, '#17131f');
    ctx.fillStyle = h; ctx.fillRect(0, 0, VW, 92);
    line(0, 92, VW, 92, C.line);
    text(title, 14, 34, 17, C.light, 'left', '800');
    if (sub) text(sub, 14, 58, 10.5, C.ink2, 'left', '400');
  }
}

function rawCtx() { return ctx; }
function clipRect(x, y, w, h) { if (!ctx) return; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
function unclip() { if (!ctx) return; ctx.restore(); }

module.exports = {
  VW, VH, C, setCtx, setScale, rr, text, font, widthOf, line, clipText,
  clearHits, zone, pick, zoneCount, button, tag, bar, panel, bg,
  rawCtx, clipRect, unclip,
};
