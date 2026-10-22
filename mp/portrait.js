/* ---- 小程序模块：原 portrait.js 依赖全局 CLASSES，这里改为显式引入 ---- */
const CLASSES = require('./data.js').CLASSES;

/* =========================================================
   赛博人物志 · 像素肖像共享模块（群像馆 / 塔防共用）
   依赖：CLASSES（hall-data.js）
   ========================================================= */
function px(ctx, x, y, w, h, color, gs) {
  ctx.fillStyle = color;
  ctx.fillRect(x * gs, y * gs, w * gs, h * gs);
}

function drawFigure(ctx, s, size, opt = {}) {
  const gs = size / 44;
  const P = s.palette || { bg: '#e6e2d8', hair: '#2a2a2a', cloth: '#334155', acc: '#d4b062', skin: '#e0b48c' };
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // 背景：生态位光晕
  const cls = CLASSES[s.class] || { color: '#d4b062' };
  const g = ctx.createRadialGradient(size / 2, size * 0.3, 2, size / 2, size * 0.5, size * 0.75);
  g.addColorStop(0, hexA(cls.color, 0.42));
  g.addColorStop(0.55, hexA(cls.color, 0.12));
  g.addColorStop(1, 'rgba(8,7,12,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // 地面斜线
  px(ctx, 0, 36, 44, 1, hexA(cls.color, 0.3), gs);
  px(ctx, 4, 39, 36, 1, hexA(cls.color, 0.12), gs);

  const breathe = opt.still ? 0 : 0;
  const oy = breathe;

  // 身体
  px(ctx, 14, 24 + oy, 16, 12, P.cloth, gs);
  px(ctx, 14, 24 + oy, 16, 1, hexA('#ffffff', 0.18), gs);
  // 衣领 / 装饰
  px(ctx, 19, 24 + oy, 6, 3, P.acc, gs);
  px(ctx, 20, 25 + oy, 4, 1, hexA('#000000', 0.25), gs);
  // 腿
  px(ctx, 16, 36 + oy, 4, 2, P.cloth, gs);
  px(ctx, 24, 36 + oy, 4, 2, P.cloth, gs);
  // 手臂
  px(ctx, 12, 26 + oy, 2, 7, P.skin, gs);
  px(ctx, 30, 26 + oy, 2, 7, P.skin, gs);

  // 头
  px(ctx, 15, 14 + oy, 14, 10, P.skin, gs);
  px(ctx, 15, 14 + oy, 14, 1, hexA('#000', 0.08), gs);
  // 头发
  px(ctx, 13, 12 + oy, 18, 4, P.hair, gs);
  px(ctx, 12, 14 + oy, 2, 5, P.hair, gs);
  px(ctx, 30, 14 + oy, 2, 5, P.hair, gs);
  // 眼睛
  px(ctx, 17, 18 + oy, 2, 2, P.hair, gs);
  px(ctx, 25, 18 + oy, 2, 2, P.hair, gs);
  px(ctx, 17, 18 + oy, 1, 1, '#ffffff', gs);
  px(ctx, 25, 18 + oy, 1, 1, '#ffffff', gs);
  // 嘴
  px(ctx, 19, 22 + oy, 6, 1, hexA(P.hair, 0.55), gs);

  // ---- 个体特征 ----
  switch (s.id) {
    case 'yujie':
      px(ctx, 12, 13 + oy, 20, 1, P.acc, gs);       // 头巾
      px(ctx, 24, 22 + oy, 2, 2, P.acc, gs);
      px(ctx, 14, 24 + oy, 16, 1, P.acc, gs);
      px(ctx, 16, 12 + oy, 12, 1, hexA(P.acc, 0.9), gs);
      break;
    case 'guige':
      px(ctx, 15, 15 + oy, 14, 1, hexA('#fff', 0.5), gs); // 发带
      px(ctx, 17, 18 + oy, 2, 1, '#111', gs);
      px(ctx, 25, 18 + oy, 2, 1, '#111', gs);
      px(ctx, 18, 21 + oy, 8, 1, '#5b3a2a', gs);     // 笑
      px(ctx, 12, 12 + oy, 1, 3, hexA('#cfe8dc', 0.8), gs); // 冰气
      px(ctx, 32, 11 + oy, 1, 2, hexA('#cfe8dc', 0.6), gs);
      break;
    case 'laozhou':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 11, 17 + oy, 4, 1, '#888', gs);        // 眼镜
      px(ctx, 29, 17 + oy, 4, 1, '#888', gs);
      px(ctx, 17, 18 + oy, 2, 1, '#333', gs);
      px(ctx, 25, 18 + oy, 2, 1, '#333', gs);
      px(ctx, 14, 24 + oy, 16, 1, '#9aa0a6', gs);    // 围裙
      px(ctx, 8, 28 + oy, 4, 1, '#9aa0a6', gs);      // 扳手
      px(ctx, 9, 28 + oy, 1, 4, '#9aa0a6', gs);
      break;
    case 'zhouzhou':
      px(ctx, 12, 11 + oy, 20, 1, P.acc, gs);        // 刘海
      px(ctx, 11, 14 + oy, 2, 7, P.hair, gs);
      px(ctx, 31, 14 + oy, 2, 7, P.hair, gs);
      px(ctx, 18, 24 + oy, 8, 1, P.acc, gs);
      px(ctx, 33, 26 + oy, 4, 1, '#d6dbe2', gs);     // 剪刀
      px(ctx, 35, 26 + oy, 1, 3, '#d6dbe2', gs);
      px(ctx, 36, 27 + oy, 1, 3, '#d6dbe2', gs);
      break;
    case 'niuge':
      px(ctx, 12, 13 + oy, 20, 2, P.acc, gs);        // 蝙蝠头带
      px(ctx, 13, 10 + oy, 3, 4, P.acc, gs);
      px(ctx, 28, 10 + oy, 3, 4, P.acc, gs);
      px(ctx, 16, 18 + oy, 4, 1, '#fff', gs);        // 眼白
      px(ctx, 24, 18 + oy, 4, 1, '#fff', gs);
      px(ctx, 17, 18 + oy, 1, 2, '#111', gs);
      px(ctx, 25, 18 + oy, 1, 2, '#111', gs);
      px(ctx, 11, 26 + oy, 1, 3, P.skin, gs);        // 粗臂
      px(ctx, 32, 26 + oy, 1, 3, P.skin, gs);
      break;
    case 'nongcung':
      px(ctx, 15, 12 + oy, 14, 3, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 3, P.acc, gs);
      px(ctx, 16, 22 + oy, 8, 1, '#7a5a45', gs);
      break;
    case 'kewin':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 32, 18 + oy, 2, 3, hexA(P.acc, 0.9), gs); // 甩头动感
      px(ctx, 34, 16 + oy, 1, 2, hexA(P.acc, 0.5), gs);
      px(ctx, 9, 28 + oy, 6, 4, '#f8fafc', gs);      // 键盘
      px(ctx, 10, 29 + oy, 1, 1, '#111', gs);
      px(ctx, 12, 29 + oy, 1, 1, '#111', gs);
      break;
    case 'lizu':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 2, '#0b1220', gs);    // 西装
      px(ctx, 20, 24 + oy, 4, 4, '#ffffff', gs);     // 衬衫
      px(ctx, 16, 22 + oy, 10, 1, '#5b3a2a', gs);
      break;
    case 'wac':
      px(ctx, 13, 12 + oy, 18, 4, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 1, '#a3e635', gs);    // 绿西装亮边
      px(ctx, 12, 11 + oy, 20, 1, '#a3e635', gs);
      px(ctx, 24, 22 + oy, 2, 1, P.hair, gs);
      break;
    case 'liangzi':
      px(ctx, 11, 24 + oy, 22, 13, P.cloth, gs);     // 巨大躯干
      px(ctx, 12, 25 + oy, 20, 1, hexA('#fff', 0.2), gs);
      px(ctx, 15, 13 + oy, 14, 3, P.hair, gs);
      px(ctx, 19, 22 + oy, 6, 1, '#7a5a45', gs);
      px(ctx, 16, 11 + oy, 12, 1, P.acc, gs);
      break;
    case 'nayina':
      px(ctx, 12, 10 + oy, 20, 5, P.hair, gs);       // 长发
      px(ctx, 11, 13 + oy, 2, 10, P.hair, gs);
      px(ctx, 31, 13 + oy, 2, 10, P.hair, gs);
      px(ctx, 18, 22 + oy, 6, 1, P.acc, gs);         // 口红
      px(ctx, 33, 25 + oy, 2, 1, '#f9a8d4', gs);     // 麦克风
      break;
    case 'sichuanfenda':
      px(ctx, 14, 17 + oy, 17, 2, '#0b1220', gs);    // 墨镜
      px(ctx, 15, 17 + oy, 5, 2, '#1a1a1a', gs);
      px(ctx, 24, 17 + oy, 5, 2, '#1a1a1a', gs);
      px(ctx, 19, 22 + oy, 8, 1, '#3a2a20', gs);     // 胡须
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      break;
    case 'xiaohua':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 12, 14 + oy, 1, 8, P.hair, gs);
      px(ctx, 18, 22 + oy, 8, 1, '#b0705c', gs);     // 笑
      px(ctx, 9, 27 + oy, 3, 1, '#d6dbe2', gs);      // 剪刀
      px(ctx, 10, 27 + oy, 1, 3, '#d6dbe2', gs);
      break;
    case 'baize':
      px(ctx, 13, 12 + oy, 18, 2, P.hair, gs);       // 帽子
      px(ctx, 12, 14 + oy, 20, 1, P.acc, gs);
      px(ctx, 12, 11 + oy, 7, 2, P.hair, gs);        // 帽檐
      px(ctx, 16, 18 + oy, 3, 1, P.acc, gs);         // HUD
      px(ctx, 24, 18 + oy, 3, 1, P.acc, gs);
      break;
    case 'diaoyu':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 12, 13 + oy, 2, 3, P.accent || '#f59e0b', gs);
      px(ctx, 34, 18 + oy, 1, 14, '#8b5e34', gs);    // 鱼竿
      px(ctx, 35, 18 + oy, 4, 1, '#8b5e34', gs);
      px(ctx, 38, 19 + oy, 1, 4, hexA('#7dd3fc', 0.9), gs);
      break;
    case 'liushuai':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 1, P.acc, gs);
      break;
    case 'shenge':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);
      px(ctx, 11, 26 + oy, 2, 6, P.skin, gs);        // 单臂
      px(ctx, 31, 26 + oy, 2, 6, hexA(P.skin, 0.35), gs);
      px(ctx, 16, 22 + oy, 10, 1, '#4a3a2a', gs);
      break;
    case 'atiqiao':
      px(ctx, 12, 11 + oy, 20, 6, P.hair, gs);       // 长发
      px(ctx, 11, 15 + oy, 2, 9, P.hair, gs);
      px(ctx, 31, 15 + oy, 2, 9, P.hair, gs);
      break;
    case 'xinba':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);       // 后梳
      px(ctx, 20, 22 + oy, 4, 1, '#5b3a2a', gs);     // 胡
      px(ctx, 14, 24 + oy, 16, 1, P.acc, gs);        // 领带
      px(ctx, 21, 25 + oy, 2, 8, P.acc, gs);
      px(ctx, 9, 11 + oy, 1, 2, hexA('#ef4444', 0.8), gs); // 热度粒子
      px(ctx, 34, 14 + oy, 1, 2, hexA('#ef4444', 0.6), gs);
      break;
    case 'yangge':
      px(ctx, 12, 11 + oy, 20, 3, P.hair, gs);       // 短发
      px(ctx, 17, 18 + oy, 3, 1, hexA('#fff', 0.85), gs); // 笑眼
      px(ctx, 24, 18 + oy, 3, 1, hexA('#fff', 0.85), gs);
      px(ctx, 19, 22 + oy, 6, 1, hexA('#7a4a3a', 0.9), gs);
      px(ctx, 32, 25 + oy, 2, 4, hexA(P.acc, 0.75), gs);  // 弓臂
      px(ctx, 31, 24 + oy, 4, 1, hexA(P.acc, 0.75), gs);
      px(ctx, 11, 26 + oy, 1, 3, P.skin, gs);        // 比出「兄弟」手势
      break;
    case 'weiya':
      px(ctx, 12, 10 + oy, 20, 5, P.hair, gs);       // 长发
      px(ctx, 11, 13 + oy, 2, 11, P.hair, gs);
      px(ctx, 31, 13 + oy, 2, 11, P.hair, gs);
      px(ctx, 18, 22 + oy, 6, 1, P.acc, gs);         // 口红
      px(ctx, 14, 24 + oy, 16, 2, hexA(P.acc, 0.8), gs);
      px(ctx, 33, 17 + oy, 3, 1, '#38bdf8', gs);     // 数据链
      px(ctx, 35, 19 + oy, 1, 3, hexA('#38bdf8', 0.7), gs);
      break;
    case 'luoyonghao':
      px(ctx, 13, 11 + oy, 18, 4, P.hair, gs);       // 微秃发际
      px(ctx, 12, 12 + oy, 2, 2, P.hair, gs);
      px(ctx, 30, 12 + oy, 2, 2, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 1, '#0b1220', gs);    // 深色外套
      px(ctx, 19, 22 + oy, 6, 1, '#7a5a45', gs);
      px(ctx, 33, 24 + oy, 2, 1, hexA('#93c5fd', 0.9), gs); // 麦克风
      px(ctx, 34, 22 + oy, 1, 3, hexA('#93c5fd', 0.6), gs);
      break;
    case 'zhangtongxue':
      px(ctx, 13, 12 + oy, 18, 3, P.hair, gs);       // 平头
      px(ctx, 15, 14 + oy, 14, 1, hexA('#000', 0.12), gs);
      px(ctx, 14, 24 + oy, 16, 6, P.cloth, gs);      // 旧棉袄
      px(ctx, 14, 28 + oy, 16, 1, hexA('#fff', 0.12), gs);
      px(ctx, 17, 22 + oy, 2, 1, P.hair, gs);        // 胡茬
      px(ctx, 25, 22 + oy, 2, 1, P.hair, gs);
      px(ctx, 8, 30 + oy, 4, 1, hexA('#d97706', 0.85), gs); // 手机支架
      px(ctx, 9, 28 + oy, 2, 3, hexA('#d97706', 0.85), gs);
      break;
    case 'guolaoshi':
      px(ctx, 12, 12 + oy, 20, 4, P.hair, gs);       // 乱发
      px(ctx, 11, 15 + oy, 2, 6, P.hair, gs);
      px(ctx, 31, 15 + oy, 2, 6, P.hair, gs);
      px(ctx, 16, 18 + oy, 2, 2, '#fff', gs);        // 夸张大眼
      px(ctx, 26, 18 + oy, 2, 2, '#fff', gs);
      px(ctx, 17, 19 + oy, 1, 1, '#111', gs);
      px(ctx, 27, 19 + oy, 1, 1, '#111', gs);
      px(ctx, 18, 22 + oy, 8, 2, '#c026d3', gs);     // 张嘴
      px(ctx, 34, 26 + oy, 1, 5, hexA(P.acc, 0.8), gs); // 声波
      px(ctx, 36, 25 + oy, 1, 7, hexA(P.acc, 0.5), gs);
      break;
    case 'sunxiaochuan':
      px(ctx, 13, 11 + oy, 18, 4, P.hair, gs);       // 寸头
      px(ctx, 16, 18 + oy, 4, 1, P.hair, gs);        // 半睁眼（司马脸）
      px(ctx, 24, 18 + oy, 4, 1, P.hair, gs);
      px(ctx, 19, 22 + oy, 6, 1, hexA('#6b4a3a', 0.8), gs);
      px(ctx, 14, 24 + oy, 16, 1, P.acc, gs);        // 外套拉链
      px(ctx, 35, 12 + oy, 2, 10, hexA('#9ca3af', 0.55), gs); // 甩过来的锅
      px(ctx, 33, 13 + oy, 5, 1, hexA('#9ca3af', 0.55), gs);
      break;
    case 'dingzhen':
      px(ctx, 12, 11 + oy, 20, 5, P.hair, gs);       // 厚发
      px(ctx, 11, 14 + oy, 2, 6, P.hair, gs);
      px(ctx, 31, 14 + oy, 2, 6, P.hair, gs);
      px(ctx, 17, 18 + oy, 2, 2, P.hair, gs);        // 亮眼
      px(ctx, 25, 18 + oy, 2, 2, P.hair, gs);
      px(ctx, 18, 22 + oy, 8, 1, hexA('#fff', 0.7), gs); // 白牙笑
      px(ctx, 14, 24 + oy, 16, 4, P.cloth, gs);      // 藏袍
      px(ctx, 15, 24 + oy, 3, 1, P.acc, gs);
      px(ctx, 33, 26 + oy, 1, 8, hexA(P.acc, 0.85), gs); // 长枪
      px(ctx, 32, 25 + oy, 3, 1, '#e5e7eb', gs);
      break;
    case 'yaoshuige':
      px(ctx, 13, 11 + oy, 18, 4, P.hair, gs);
      px(ctx, 16, 18 + oy, 3, 2, '#fff', gs);        // 瞪眼
      px(ctx, 25, 18 + oy, 3, 2, '#fff', gs);
      px(ctx, 17, 18 + oy, 1, 2, '#111', gs);
      px(ctx, 26, 18 + oy, 1, 2, '#111', gs);
      px(ctx, 19, 22 + oy, 6, 2, '#7a3a3a', gs);     // 假哭张嘴
      px(ctx, 14, 24 + oy, 16, 1, P.acc, gs);
      px(ctx, 13, 26 + oy, 1, 3, hexA('#60a5fa', 0.8), gs); // 眼泪
      px(ctx, 30, 26 + oy, 1, 3, hexA('#60a5fa', 0.8), gs);
      break;
    case 'giaoge':
      px(ctx, 13, 11 + oy, 18, 3, P.hair, gs);       // 短寸
      px(ctx, 12, 25 + oy, 1, 4, hexA(P.skin, 0.9), gs); // 挥臂
      px(ctx, 33, 25 + oy, 5, 1, hexA(P.skin, 0.9), gs);
      px(ctx, 18, 22 + oy, 8, 2, '#4a2a20', gs);     // 大张的嘴
      px(ctx, 34, 12 + oy, 1, 2, hexA(P.acc, 0.8), gs); // 音节粒子
      px(ctx, 36, 15 + oy, 1, 2, hexA(P.acc, 0.55), gs);
      break;
    case 'mabaoguo':
      px(ctx, 13, 12 + oy, 18, 3, '#d9d4c8', gs);    // 白发
      px(ctx, 12, 14 + oy, 2, 5, '#d9d4c8', gs);
      px(ctx, 30, 14 + oy, 2, 5, '#d9d4c8', gs);
      px(ctx, 14, 25 + oy, 16, 9, '#f5f5f0', gs);    // 白色练功服
      px(ctx, 18, 26 + oy, 8, 1, hexA(P.acc, 0.7), gs);
      px(ctx, 17, 22 + oy, 2, 1, '#c9c4b8', gs);     // 胡须
      px(ctx, 25, 22 + oy, 2, 1, '#c9c4b8', gs);
      px(ctx, 33, 14 + oy, 6, 1, hexA('#a3e635', 0.85), gs); // 鞭影
      px(ctx, 33, 17 + oy, 6, 1, hexA('#a3e635', 0.55), gs);
      px(ctx, 33, 20 + oy, 6, 1, hexA('#a3e635', 0.35), gs);
      break;
    case 'tieshankao':
      px(ctx, 13, 11 + oy, 18, 4, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 4, '#1e3a8a', gs);    // 旧夹克
      px(ctx, 14, 24 + oy, 16, 1, P.acc, gs);
      px(ctx, 18, 22 + oy, 8, 1, '#3a2a20', gs);
      px(ctx, 9, 26 + oy, 3, 3, P.skin, gs);         // 两拳
      px(ctx, 32, 26 + oy, 3, 3, P.skin, gs);
      break;
    case 'shougonggeng':
      px(ctx, 13, 11 + oy, 18, 4, P.hair, gs);       // 短发
      px(ctx, 12, 13 + oy, 2, 3, P.hair, gs);
      px(ctx, 30, 13 + oy, 2, 3, P.hair, gs);
      px(ctx, 14, 24 + oy, 16, 3, P.cloth, gs);      // 工装
      px(ctx, 18, 24 + oy, 8, 1, hexA('#a1a1aa', 0.7), gs);
      px(ctx, 17, 22 + oy, 2, 1, P.hair, gs);        // 胡渣
      px(ctx, 25, 22 + oy, 2, 1, P.hair, gs);
      px(ctx, 8, 28 + oy, 5, 1, '#9ca3af', gs);      // 扳手
      px(ctx, 9, 28 + oy, 1, 4, '#9ca3af', gs);
      px(ctx, 33, 16 + oy, 3, 1, hexA('#f59e0b', 0.9), gs); // 焊花
      px(ctx, 36, 18 + oy, 1, 1, hexA('#f59e0b', 0.6), gs);
      break;
  }

  // 封印覆层
  if (s.nc) {
    ctx.fillStyle = 'rgba(193,39,45,.16)';
    ctx.fillRect(0, 0, size, size);
  }
}

function hexA(hex, a) {
  if (!hex) return `rgba(212,176,98,${a})`;
  if (hex.startsWith('#')) {
    const h = hex.length === 4
      ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      : hex;
    const n = parseInt(h.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  return hex;
}

module.exports = { drawFigure, px, hexA };
