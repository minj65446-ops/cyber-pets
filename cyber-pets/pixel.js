/* =========================================================
   赛博人物志 · 像素立绘引擎（v2）
   ---------------------------------------------------------
   旧版问题：所有人共用同一副身体（头 14×10、身 16×12、手臂 2×7），
   只在 switch 里加几笔小配件，53 人里有 18 人连配件都没有 → 撞脸。
   本版改成「参数化立绘」：体型 × 发型 × 手持道具 × 附加件 × 表情，
   五个维度组合，53 人各不相同；再补 1px 剪影描边 + 3 帧待机动画。

   坐标系统：48×48 网格（gs = size/48），脚底落在 y=41。
   ========================================================= */
(function (global) {
  'use strict';

  const G = 48;                 // 逻辑网格
  const CX = 24;                // 中线
  const FLOOR = 41;             // 脚底
  const OUTLINE = '#12100f';    // 剪影描边色

  /* ---------------- 体型 ---------------- */
  const BUILD = {
    slim:  { sh: 11, th: 12, hw: 12, hh: 12, leg: 3, arm: 2 },  // 瘦
    normal:{ sh: 13, th: 12, hw: 13, hh: 12, leg: 3, arm: 2 },  // 标准
    stout: { sh: 16, th: 12, hw: 14, hh: 12, leg: 2, arm: 3 },  // 壮/胖
    tall:  { sh: 12, th: 15, hw: 12, hh: 12, leg: 4, arm: 2 },  // 高
    small: { sh: 10, th: 10, hw: 14, hh: 13, leg: 2, arm: 2 },  // 矮（大头 Q 版）
    huge:  { sh: 20, th: 13, hw: 13, hh: 11, leg: 2, arm: 4 },  // 巨
  };

  /* ---------------- 手持道具（相对手部锚点） ----------------
     每项是 [x, y, w, h, colorKey]，colorKey: k=深色 m=金属 w=木 p=纸 a=强调 s=皮肤 r=红 c=青 */
  const PROPS = {
    none: [],
    cleaver:  [[-1, -5, 1, 4, 'm'], [0, -6, 3, 5, 'm'], [0, -7, 3, 1, 'k']],
    wrench:   [[0, -5, 2, 6, 'm'], [-1, -6, 4, 2, 'm'], [0, -5, 1, 5, 'm']],
    scissors: [[0, -5, 1, 5, 'm'], [2, -4, 1, 4, 'm'], [3, -1, 1, 3, 'm'], [1, -3, 1, 1, 'k']],
    dumbbell: [[0, -5, 4, 1, 'm'], [-1, -6, 1, 3, 'k'], [4, -6, 1, 3, 'k']],
    sack:     [[0, -7, 5, 7, 'w'], [1, -8, 3, 1, 'w'], [2, -4, 1, 1, 'k']],
    keyboard: [[-1, -4, 6, 4, 'p'], [0, -3, 4, 1, 'k'], [-1, -1, 6, 1, 'm']],
    mic:      [[0, -6, 2, 3, 'k'], [0, -3, 1, 3, 'm'], [0, -7, 2, 1, 'm']],
    pot:      [[-2, -5, 5, 5, 'k'], [-2, -6, 5, 1, 'm'], [3, -4, 2, 1, 'm'], [-3, -4, 1, 1, 'm']],
    fishrod:  [[0, -10, 1, 12, 'w'], [1, -10, 4, 1, 'w'], [4, -9, 1, 3, 'c']],
    bow:      [[0, -9, 1, 12, 'w'], [1, -9, 1, 3, 'w'], [1, 0, 1, 3, 'w'], [2, -9, 1, 1, 'p']],
    spear:    [[0, -12, 1, 14, 'w'], [0, -13, 1, 2, 'm'], [-1, -11, 3, 1, 'r']],
    pan:      [[0, -4, 6, 1, 'k'], [1, -3, 4, 4, 'k'], [5, -3, 2, 1, 'w']],
    fist:     [[0, -5, 3, 3, 's'], [0, -4, 3, 1, 'k']],
    hammer:   [[0, -4, 1, 6, 'w'], [-1, -6, 4, 3, 'm']],
    book:     [[0, -5, 5, 6, 'p'], [1, -4, 1, 4, 'k'], [3, -4, 1, 4, 'k']],
    basket:   [[-1, -4, 6, 5, 'w'], [-1, -5, 6, 1, 'w'], [1, -6, 1, 1, 'a'], [3, -6, 1, 1, 'a']],
    lipstick: [[0, -5, 2, 5, 'r'], [0, -6, 2, 1, 'm']],
    pointer:  [[0, -7, 1, 8, 'w'], [0, -8, 1, 1, 'r']],
    controller:[[0, -4, 6, 3, 'k'], [1, -4, 2, 1, 'r'], [4, -4, 2, 1, 'c']],
    tablet:   [[0, -6, 5, 7, 'k'], [1, -5, 3, 5, 'c']],
    popcorn:  [[0, -5, 4, 5, 'p'], [0, -6, 4, 1, 'p'], [1, -4, 1, 1, 'a'], [2, -3, 1, 1, 'a']],
    camera:   [[0, -6, 6, 5, 'k'], [1, -7, 3, 1, 'k'], [2, -5, 2, 3, 'c']],
    ledger:   [[0, -5, 5, 6, 'p'], [1, -4, 3, 1, 'k'], [1, -2, 3, 1, 'k']],
    fridge:   [[0, -8, 5, 9, 'p'], [0, -5, 5, 1, 'k'], [3, -7, 1, 2, 'm']],
    megaphone:[[0, -7, 2, 3, 'k'], [1, -6, 3, 5, 'r'], [4, -5, 1, 3, 'r']],
    guitar:   [[-2, -4, 4, 5, 'w'], [-1, -3, 2, 1, 'k'], [2, -8, 1, 5, 'k'], [1, -8, 3, 1, 'k']],
    watch:    [[0, -4, 3, 3, 'm'], [1, -3, 1, 1, 'c']],
    mask:     [[0, -5, 5, 4, 'p'], [1, -4, 3, 1, 'k']],
    ring:     [[0, -4, 3, 2, 'a']],
    phone:    [[0, -6, 4, 7, 'k'], [1, -5, 2, 4, 'c']],
    ladle:    [[0, -5, 1, 7, 'm'], [0, -6, 3, 2, 'm']],
    beads:    [[0, -4, 1, 5, 'w'], [1, -5, 1, 1, 'a'], [2, -4, 1, 1, 'a'], [1, -3, 1, 1, 'a'], [2, -3, 1, 1, 'a']],
    flag:     [[0, -9, 1, 10, 'w'], [1, -9, 4, 3, 'r']],
    clipboard:[[0, -6, 5, 7, 'p'], [1, -7, 3, 1, 'k'], [1, -4, 3, 1, 'k']],
  };

  /* ---------------- 发型（含帽子） ---------------- */
  /* 每项返回一组 [x,y,w,h,colorKey] 相对头部左上角 */
  function hairRects(style, hw, hh) {
    const L = -1, T = -3, W = hw + 2;
    switch (style) {
      case 'buzz':    return [[0, -2, hw, 2, 'h']];
      case 'flat':    return [[L, T, W, 3, 'h']];
      case 'bowl':    return [[L, T - 1, W, 4, 'h'], [L, 1, 1, 2, 'h'], [hw, 1, 1, 2, 'h']];
      case 'long':    return [[L, T - 1, W, 4, 'h'], [L, 1, 2, hh - 1, 'h'], [hw, 1, 2, hh - 1, 'h']];
      case 'ponytail':return [[L, T, W, 3, 'h'], [hw + 1, -1, 2, 5, 'h'], [hw + 2, 3, 1, 2, 'h']];
      case 'bun':     return [[L, T, W, 3, 'h'], [hw - 3, T - 3, 4, 3, 'h']];
      case 'bob':     return [[L, T - 1, W, 4, 'h'], [L, 2, 2, 5, 'h'], [hw, 2, 2, 5, 'h']];
      case 'spiky':   return [[L, T, W, 2, 'h'], [1, T - 2, 2, 2, 'h'], [5, T - 2, 2, 2, 'h'], [9, T - 1, 2, 2, 'h']];
      case 'perm':    return [[L, T - 1, W, 4, 'h'], [L - 1, 0, 1, 3, 'h'], [hw + 1, 0, 1, 3, 'h']];
      case 'bald':    return [[1, -1, hw - 2, 1, 'h']];
      case 'recede':  return [[L, T + 1, 3, 2, 'h'], [hw - 1, T + 1, 3, 2, 'h'], [2, -1, hw - 4, 1, 'h']];
      case 'thick':   return [[L - 1, T - 1, W + 2, 4, 'h'], [L, 1, 1, 3, 'h'], [hw, 1, 1, 3, 'h']];
      case 'white':   return [[L, T, W, 3, 'g'], [L, 2, 2, 4, 'g'], [hw, 2, 2, 4, 'g']];
      case 'slick':   return [[L, T, W, 3, 'h'], [L + 1, T - 1, 3, 1, 'h']];
      case 'cap':     return [[L, T - 1, W, 3, 'a'], [L - 2, 0, W + 4, 1, 'a']];
      case 'helmet':  return [[L - 1, T - 2, W + 2, 4, 'a'], [L - 2, 1, W + 4, 1, 'k']];
      case 'straw':   return [[L - 2, T, W + 4, 2, 'w'], [L, T - 3, W, 3, 'w']];
      case 'beanie':  return [[L, T - 2, W, 4, 'a'], [L, 1, W, 1, 'h']];
      case 'headband':return [[0, -2, hw, 2, 'a'], [-1, -1, 1, 1, 'a'], [hw, -1, 1, 1, 'a']];
      case 'hood':    return [[L - 1, T - 2, W + 2, 4, 'a'], [L - 1, 1, 2, hh, 'a'], [hw, 1, 2, hh, 'a']];
      case 'chef':    return [[2, -8, hw - 3, 5, 'p'], [L, T, W, 3, 'p']];
      default:        return [[L, T, W, 3, 'h']];
    }
  }

  /* ---------------- 附加件 ---------------- */
  const EXTRA = {
    none: [],
    glasses:  (hw) => [[1, 3, 3, 2, 'm'], [hw - 4, 3, 3, 2, 'm'], [4, 4, hw - 8, 1, 'm']],
    sunglasses: (hw) => [[1, 2, hw - 2, 2, 'k'], [4, 2, hw - 8, 1, 'm']],
    beard:    (hw) => [[2, 5, hw - 4, 2, 'h']],
    mustache: (hw) => [[3, 4, hw - 6, 1, 'h']],
    apron:    (hw) => [[2, 0, hw - 4, 7, 'p']],
    scarf:    (hw) => [[0, -1, hw, 2, 'r'], [hw - 2, 1, 2, 4, 'r']],
    tie:      (hw) => [[hw / 2 - 1, 0, 2, 6, 'a'], [hw / 2 - 2, -1, 4, 1, 'a']],
    headset:  (hw) => [[-1, 1, 1, 4, 'k'], [hw, 1, 1, 4, 'k'], [-1, 0, hw + 2, 1, 'k']],
    suit:     (hw) => [[0, 0, hw, 1, 'k'], [hw / 2 - 1, 0, 2, 5, 'p']],
    robe:     (hw) => [[0, 2, hw, 1, 'a'], [0, 6, hw, 1, 'a']],
    headphones: (hw) => [[-1, 2, 1, 3, 'k'], [hw, 2, 1, 3, 'k']],
    bandage:  (hw) => [[hw - 3, 3, 3, 1, 'p']],
  };

  /* ---------------- 表情 ---------------- */
  // 返回 [眼型, 嘴型]
  const EXPR = {
    neutral: [2, 1],
    smile:   [2, 2],
    grin:    [1, 3],
    shout:   [1, 4],
    frown:   [2, 5],
    cool:    [3, 1],
    wink:    [4, 2],
    closed:  [5, 2],
    cry:     [5, 6],
  };

  /* ---------------- 逐角色参数表 ----------------
     build | hair | prop | extra | expr
     53 位各不相同（脚本里有唯一性断言） */
  const SPEC = {
    /* —— 养成馆 8 人（hall-data 同 id） —— */
    yujie:      'stout|headband|cleaver|apron|grin',
    guige:      'normal|bald|beads|scarf|smile',
    laozhou:    'small|bald|wrench|glasses|neutral',
    zhouzhou:   'slim|bob|scissors|apron|cool',
    niuge:      'tall|spiky|dumbbell|headband|shout',
    nongcung:   'huge|flat|sack|none|neutral',
    kewin:      'slim|perm|keyboard|headphones|wink',
    lizu:       'tall|bowl|mic|suit|closed',
    /* —— 群像馆其余 —— */
    wac:        'slim|bowl|mic|tie|smile',
    liangzi:    'huge|flat|pot|none|smile',
    nayina:     'slim|long|mic|mask|closed',
    sichuanfenda:'normal|flat|none|sunglasses|neutral',
    xiaohua:    'slim|bun|scissors|apron|smile',
    baize:      'normal|helmet|clipboard|headset|neutral',
    diaoyu:     'normal|cap|fishrod|none|closed',
    liushuai:   'normal|buzz|flag|none|frown',
    shenge:     'stout|bowl|ladle|none|grin',
    atiqiao:    'slim|long|none|scarf|closed',
    xinba:      'normal|slick|phone|tie|shout',
    yangge:     'slim|flat|bow|cool|grin',
    weiya:      'slim|long|ring|tie|smile',
    luoyonghao: 'normal|recede|mic|suit|neutral',
    zhangtongxue:'slim|flat|phone|none|neutral',
    guolaoshi:  'slim|spiky|none|none|shout',
    sunxiaochuan:'normal|buzz|pan|none|frown',
    dingzhen:   'normal|thick|spear|robe|smile',
    yaoshuige:  'slim|perm|none|scarf|cry',
    giaoge:     'slim|buzz|none|none|shout',
    mabaoguo:   'small|white|whip|robe|neutral',
    tieshankao: 'stout|flat|fist|scarf|frown',
    shougonggeng:'normal|flat|hammer|apron|neutral',
    dongyuhui:  'slim|flat|book|glasses|smile',
    liziqi:     'slim|bun|basket|apron|smile',
    papijiang:  'small|bob|none|headset|wink',
    lijiaqi:    'slim|bob|lipstick|none|smile',
    luoxiang:   'normal|flat|pointer|glasses|neutral',
    zhangdaxian:'slim|cap|controller|cool|grin',
    xuxubaobao: 'slim|long|tablet|headset|neutral',
    yuehankehan:'normal|flat|ledger|glasses|neutral',
    dusheying:  'slim|flat|popcorn|none|cool',
    maixiaodeng:'normal|cap|camera|none|smile',
    taozijie:   'stout|bun|ladle|apron|grin',
    dayuange:   'normal|flat|ledger|none|smile',
    tianlaolao: 'small|white|fridge|apron|smile',
    yuedongkang:'normal|bowl|megaphone|none|shout',
    xuhuasheng: 'normal|helmet|hammer|none|neutral',
    kabitan:    'small|flat|none|none|wink',
    jushouxiansheng:'tall|flat|none|scarf|neutral',
    pameila:    'slim|ponytail|watch|headset|neutral',
    chengshian: 'normal|hood|mask|cool|neutral',
    chaoyuanzhang:'slim|cap|megaphone|none|shout',
    guoyoucai:  'normal|flat|guitar|none|smile',
    jingchuanliyu:'slim|ponytail|none|scarf|wink',
    /* —— 养成馆里 data.js 的 8 人若有额外 id，会走 fallback —— */
  };

  /* 兜底：按生态位给一个合理默认，保证新增角色不会撞脸 */
  const CLASS_DEFAULT = {
    hard:   'stout|flat|fist|none|frown',
    snipe:  'slim|cap|bow|none|closed',
    rush:   'slim|spiky|spear|none|shout',
    lead:   'normal|straw|sack|none|smile',
    stunt:  'normal|flat|wrench|apron|neutral',
    stab:   'slim|hood|scissors|none|cool',
    frenzy: 'stout|spiky|pan|none|grin',
    witness:'tall|bald|beads|robe|neutral',
  };

  function parseSpec(str) {
    const a = String(str || '').split('|');
    return {
      build: BUILD[a[0]] ? a[0] : 'normal',
      hair: a[1] || 'flat',
      prop: a[2] || 'none',
      extra: a[3] || 'none',
      expr: a[4] || 'neutral',
    };
  }

  function specFor(fig) {
    let raw = SPEC[fig.id];
    if (!raw) {
      /* 未登记的新角色：用生态位默认 + id 哈希错开发型，避免直接撞脸 */
      raw = CLASS_DEFAULT[fig.class] || 'normal|flat|none|none|neutral';
      const parts = raw.split('|');
      const hairs = ['flat', 'bowl', 'buzz', 'perm', 'bob', 'slim'];
      let h = 0;
      for (let i = 0; i < fig.id.length; i++) h = (h * 31 + fig.id.charCodeAt(i)) >>> 0;
      parts[1] = hairs[h % hairs.length];
      raw = parts.join('|');
    }
    return parseSpec(raw);
  }

  /* ---------------- 绘制 ---------------- */
  function draw(ctx, fig, size, opt) {
    opt = opt || {};
    const sp = specFor(fig);
    const bd = BUILD[sp.build] || BUILD.normal;
    const P = fig.palette || { bg: '#e6e2d8', hair: '#2a2a2a', cloth: '#334155', acc: '#d4b062', skin: '#e0b48c' };
    const gs = size / G;

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    /* 背景：生态位光晕（保留原有观感，深色底） */
    const clsColor = opt.glow || '#d4b062';
    if (opt.bg !== false) {
      const g = ctx.createRadialGradient(size / 2, size * 0.28, 2, size / 2, size * 0.5, size * 0.8);
      g.addColorStop(0, hexA(clsColor, 0.40));
      g.addColorStop(0.55, hexA(clsColor, 0.12));
      g.addColorStop(1, 'rgba(8,7,12,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }

    /* 3 帧待机：0=平, 1=下沉 1 格, 2=平（眨眼） */
    const still = !!opt.still;
    const frame = still ? 0 : Math.floor((opt.t || 0) / 420) % 3;
    const bob = still ? 0 : (frame === 1 ? 1 : 0);
    const blink = !still && frame === 2;

    /* 地面 + 落地投影（把人钉在地上，不然像悬空） */
    rect(ctx, 0, 42, 44, 1, hexA(clsColor, 0.22), gs);
    rect(ctx, 6, 43, 32, 1, hexA(clsColor, 0.10), gs);
    rect(ctx, CX - (bd.sh >> 1) - 2, 40, bd.sh + 4, 2, 'rgba(0,0,0,.45)', gs);
    rect(ctx, CX - (bd.sh >> 1), 41, bd.sh + 1, 1, 'rgba(0,0,0,.6)', gs);

    /* 两层绘制：先剪影描边（四向偏移），再正常填色 */
    const paint = (mode, dx, dy) => {
      const C = (c) => (mode === 'line' ? OUTLINE : c);
      drawBody(ctx, sp, P, bd, bob, frame, blink, gs, C, dx, dy, opt);
    };
    if (!opt.noOutline) {
      paint('line', -1, 0); paint('line', 1, 0);
      paint('line', 0, -1); paint('line', 0, 1);
    }
    paint('fill', 0, 0);
  }

  function drawBody(ctx, sp, P, bd, bob, frame, blink, gs, C, dx, dy, opt) {
    const R = (x, y, w, h, c) => rect(ctx, x + dx, y + dy, w, h, C(c), gs);

    const shoulder = bd.sh;
    const torsoW = shoulder;
    const torsoTop = FLOOR - bd.leg - bd.th;          // 躯干顶端
    const headH = bd.hh;
    const headW = bd.hw;
    const headTop = torsoTop - headH + 1;             // 脖子上方
    const headX = CX - Math.round(headW / 2);
    const torsoX = CX - Math.round(torsoW / 2);

    /* 腿 */
    R(torsoX + 2, FLOOR - bd.leg, 4, bd.leg, P.cloth);
    R(torsoX + torsoW - 6, FLOOR - bd.leg, 4, bd.leg, P.cloth);
    /* 鞋 */
    R(torsoX + 2, FLOOR, 4, 1, C('#1b1b20'));
    R(torsoX + torsoW - 6, FLOOR, 4, 1, C('#1b1b20'));

    /* 躯干 */
    R(torsoX, torsoTop, torsoW, bd.th, P.cloth);
    R(torsoX, torsoTop, torsoW, 1, hexA('#ffffff', 0.16));       // 肩线高光
    R(torsoX + Math.round(torsoW / 2) - 1, torsoTop + 1, 2, bd.th - 2, hexA('#000000', 0.16)); // 中缝

    /* 手臂：待机第 1 帧微下垂 */
    const armDrop = frame === 1 ? 1 : 0;
    R(torsoX - bd.arm, torsoTop + 1 + armDrop, bd.arm, bd.th - 2, P.cloth);
    R(torsoX - bd.arm, torsoTop + bd.th - 2 + armDrop, bd.arm, 2, P.skin);   // 左手
    R(torsoX + torsoW, torsoTop + 1 + armDrop, bd.arm, bd.th - 2, P.cloth);
    R(torsoX + torsoW, torsoTop + bd.th - 2 + armDrop, bd.arm, 2, P.skin);   // 右手

    /* 领口 / 附加件（胸前层） */
    const ex = EXTRA[sp.extra];
    if (ex && ex.length) {
      ex(headW).forEach(([x, y, w, h, k]) => {
        R(headX + x, torsoTop + y, w, h, colorOf(k, P));
      });
    }

    /* 头 */
    R(headX, headTop, headW, headH, P.skin);
    R(headX, headTop, headW, 1, hexA('#000000', 0.10));
    /* 耳朵 */
    R(headX - 1, headTop + 5, 1, 3, P.skin);
    R(headX + headW, headTop + 5, 1, 3, P.skin);

    /* 眼睛 */
    const [eye, mouth] = EXPR[sp.expr] || EXPR.neutral;
    const eyeY = headTop + 5;
    const eyeLX = headX + 3;
    const eyeRX = headX + headW - 4;
    drawEye(R, eye, eyeLX, eyeY, blink && (sp.expr !== 'cool'));
    drawEye(R, eye, eyeRX, eyeY, blink && (sp.expr !== 'cool'));
    /* 嘴 */
    drawMouth(R, mouth, headX + Math.round(headW / 2), headTop + 8);

    /* 头发 / 帽子（覆盖头部） */
    hairRects(sp.hair, headW, headH).forEach(([x, y, w, h, k]) => {
      const col = k === 'h' ? P.hair : colorOf(k, P);
      R(headX + x, headTop + y, w, h, col);
      if (k === 'h') {
        /* 毛尖起伏：中间比两侧高 1 格，避免一条直板 */
        R(headX + x + Math.round(w / 2) - 2, headTop + y - 1, 4, 1, col);
        /* 两段高光，而不是一整条 */
        R(headX + x + 1, headTop + y, 2, 1, hexA('#ffffff', 0.34));
        R(headX + x + w - 4, headTop + y, 2, 1, hexA('#ffffff', 0.22));
      }
    });

    /* 手持道具：握在右手上，先画握持的手，再画道具（待机第 3 帧轻抬） */
    const prop = PROPS[sp.prop] || PROPS.none;
    if (prop.length) {
      const sway = frame === 2 ? -1 : 0;
      const hx = torsoX + torsoW - 1;
      const hy = torsoTop + bd.th - 3 + sway;
      R(hx - 1, hy, 3, 3, P.skin);
      /* 投影：斜下 1 格柔和深色，既不吞本体又能和衣服分开 */
      prop.forEach(([x, y, w, h]) => { R(hx + x, hy + y + 1, w, h, 'rgba(6,5,10,.55)'); });
      prop.forEach(([x, y, w, h, k]) => {
        R(hx + x, hy + y, w, h, colorOf(k, P));
      });
    }
  }

  function colorOf(k, P) {
    switch (k) {
      case 'k': return '#1b1b20';
      case 'm': return '#c9d1d9';
      case 'w': return '#8b5e34';
      case 'p': return '#e8dfcc';
      case 'a': return P.acc;
      case 's': return P.skin;
      case 'r': return '#c0392b';
      case 'c': return '#9fd8e8';
      case 'g': return hexA('#e8e3d7', 0.95);
      case 'h': return P.hair;
      default:  return P.acc;
    }
  }

  function drawEye(R, type, x, y, blink) {
    if (blink) { R(x, y + 1, 2, 1, '#2a2a2a'); return; }
    switch (type) {
      case 1: R(x, y, 3, 2, '#ffffff'); R(x + 1, y, 1, 2, '#1b1b20'); break; // 大眼
      case 2: R(x, y + 1, 2, 2, '#241d1a'); R(x, y + 1, 1, 1, '#ffffff'); break; // 普通
      case 3: R(x, y + 1, 3, 1, '#1b1b20'); break; // 眯眼
      case 4: R(x, y + 1, 2, 1, '#241d1a'); R(x + 2, y + 1, 1, 1, '#ffffff'); break; // 眨眼
      case 5: R(x, y + 2, 2, 1, '#241d1a'); break; // 闭眼
      default: R(x, y + 1, 2, 2, '#241d1a');
    }
  }

  function drawMouth(R, type, cx, y) {
    switch (type) {
      case 1: R(cx - 1, y, 2, 1, hexA('#5b3a2a', 0.9)); break;                 // 平
      case 2: R(cx - 2, y, 4, 1, hexA('#8b4a3a', 0.95)); R(cx - 3, y - 1, 1, 1, hexA('#8b4a3a', .6)); R(cx + 2, y - 1, 1, 1, hexA('#8b4a3a', .6)); break; // 微笑
      case 3: R(cx - 2, y, 5, 2, '#7a3a34'); R(cx - 1, y, 3, 1, '#ffffff'); break; // 露牙笑
      case 4: R(cx - 2, y, 4, 3, '#4a2a24'); R(cx - 1, y + 1, 2, 1, '#c0392b'); break; // 张 嘴喊
      case 5: R(cx - 2, y + 1, 4, 1, hexA('#5b3a2a', 0.9)); R(cx - 3, y, 1, 1, hexA('#5b3a2a', .6)); R(cx + 2, y, 1, 1, hexA('#5b3a2a', .6)); break; // 撇嘴
      case 6: R(cx - 2, y, 4, 2, '#6b3a3a'); R(cx - 3, y + 1, 1, 3, '#7ab8e8'); R(cx + 2, y + 1, 1, 3, '#7ab8e8'); break; // 哭
      default: R(cx - 1, y, 2, 1, '#5b3a2a');
    }
  }

  function rect(ctx, x, y, w, h, color, gs) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    /* +0.5 抵消小数缩放产生的缝 */
    ctx.fillRect(x * gs, y * gs, w * gs + 0.5, h * gs + 0.5);
  }

  function hexA(hex, a) {
    if (!hex) return 'rgba(212,176,98,' + a + ')';
    if (hex.charAt(0) !== '#') return hex;
    const h = hex.length === 4
      ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      : hex;
    const n = parseInt(h.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* 3 帧循环的公共节拍器：只重绘订阅者，5fps 够看且不烧 CPU */
  const ticker = {
    subs: [],
    t0: 0,
    add(fn) { this.subs.push(fn); },
    start() {
      if (this.t0) return;
      this.t0 = Date.now();
      const step = () => {
        const t = Date.now() - this.t0;
        for (let i = 0; i < this.subs.length; i++) {
          try { this.subs[i](t); } catch (e) { }
        }
        setTimeout(step, 200);
      };
      setTimeout(step, 200);
    },
  };

  global.PX = { draw, specFor, parseSpec, SPEC, BUILD, PROPS, hairRects, hexA, ticker, G };
})(window);
