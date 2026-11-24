/* =========================================================
   赛博人物志 · 像素肖像共享模块（群像馆 / 塔防 / 割草 / 江湖 共用）
   依赖：CLASSES（hall-data.js）、PX（pixel.js）

   v2：立绘本体交给 pixel.js 的参数化引擎（体型×发型×道具×附加件×表情），
   这里只把 FIGURES 的字段翻译过去，保持对外 API 不变：
     drawFigure(ctx, figure, size, { still, t })
   ========================================================= */
function px(ctx, x, y, w, h, color, gs) {
  ctx.fillStyle = color;
  ctx.fillRect(x * gs, y * gs, w * gs + 0.5, h * gs + 0.5);
}

function drawFigure(ctx, s, size, opt) {
  opt = opt || {};
  const cls = (typeof CLASSES !== 'undefined' && CLASSES[s.class]) || { color: '#d4b062' };
  PX.draw(ctx, s, size, {
    t: opt.t || 0,
    still: !!opt.still,
    glow: cls.color,
    bg: opt.bg,
  });

  /* 封印角色：整张压暗一层（原来是红色覆层，改成降饱和的灰罩更好读） */
  if (s.nc) {
    ctx.fillStyle = 'rgba(10,8,14,.26)';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(193,39,45,.14)';
    ctx.fillRect(0, 0, size, size);
  }
}

function hexA(hex, a) { return PX.hexA(hex, a); }
