/* =========================================================
   赛博人物志 · Toy SDK 桥（最小实现）
   ---------------------------------------------------------
   只在 Toy 容器内生效；普通网页 / 本地双击时整层自动降级为 no-op，
   不会抛错、不阻塞任何玩法。

   ⚠ 未验证：Toy SDK 文档需要「有 Toy 权限的账号登录」才能打开
   （https://www.bilibili.com/toy/publish/sdk ）。因此下面的方法名用
   「候选列表 + 运行时探测」的方式拿，不写死单一名字：
   拿到权限后请对着正式文档核对一遍方法名与参数，再回来收窄候选表。
   ========================================================= */
window.ToyBridge = (function () {
  const STATE = {
    checked: false,
    ok: false,
    user: null,       // { nickname, avatar }
    action: null,     // { liked, coined, faved }
    cloud: null,      // 最近一次云存档
    note: '',         // 诊断用：桥为什么没生效
  };

  function toy() {
    return (typeof window !== 'undefined' && window.toy) ? window.toy : null;
  }

  /* 容器内才为 true；本地/普通域名下恒 false */
  function available() {
    const t = toy();
    if (!t) { STATE.note = '没有 window.toy（不在 Toy 容器里）'; return false; }
    try {
      return (typeof t.available === 'function') ? !!t.available() : true;
    } catch (e) {
      STATE.note = 'available() 抛错：' + e.message;
      return false;
    }
  }

  /* 在候选名里挑第一个真实存在的方法 */
  function method(names) {
    const t = toy();
    if (!t) return null;
    for (let i = 0; i < names.length; i++) {
      if (typeof t[names[i]] === 'function') return t[names[i]].bind(t);
    }
    return null;
  }

  function call(fn, arg) {
    if (!fn) return Promise.resolve(null);
    try {
      const r = fn(arg);
      return (r && typeof r.then === 'function') ? r : Promise.resolve(r);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* ---------- 用户信息 ---------- */
  function profile() {
    const fn = method(['getUserProfile', 'get_user_profile', 'getUserInfo', 'get_user_info']);
    return call(fn).then(u => {
      if (!u) return null;
      STATE.user = {
        nickname: u.nickname || u.name || u.uname || '',
        avatar: u.avatar || u.face || u.avatarUrl || '',
      };
      return STATE.user;
    });
  }

  /* ---------- 三连状态（点赞 / 投币 / 收藏） ---------- */
  function videoAction() {
    const fn = method([
      'getUserVideoAction', 'get_user_video_action', 'toy_getuservideoaction',
      'getVideoAction', 'getUserAction'
    ]);
    return call(fn).then(a => {
      if (!a) return null;
      STATE.action = {
        liked: !!(a.liked !== undefined ? a.liked : a.like),
        coined: !!(a.coined !== undefined ? a.coined : a.coin),
        faved: !!(a.faved !== undefined ? a.faved : a.fav || a.favorite),
      };
      return STATE.action;
    });
  }

  /* ---------- 云存档（按结算/关键节点落盘，不轮询） ---------- */
  /* 各家实现的返回形状不一样：可能是字符串、可能是 {key: json}、可能是数组。
     统一归一化成对象，归一化失败就当没有云存档。 */
  function normalize(r, key) {
    if (!r) return null;
    if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return null; } }
    let v = (key && r[key] !== undefined) ? r[key] : r;
    if (Array.isArray(v)) v = v[0];
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } }
    return (v && typeof v === 'object') ? v : null;
  }

  function loadCloud(key) {
    const fn = method(['getCloudStorage', 'get_cloud_storage']);
    if (!fn) return Promise.resolve(null);
    /* 先按字符串 key 取，拿不到再按数组取一遍（两种签名都有人这么实现） */
    return call(fn, key).then(r => r || call(fn, [key])).then(r => {
      const v = normalize(r, key);
      STATE.cloud = v;
      return v;
    });
  }

  function saveCloud(obj, key) {
    const fn = method(['setCloudStorage', 'set_cloud_storage']);
    if (!fn) return Promise.resolve(false);
    const payload = {};
    payload[key || 'save'] = JSON.stringify(obj);
    return call(fn, payload).then(() => true).catch(() => false);
  }

  /* ---------- 分享图 ---------- */
  function shareImage(dataUrl, text) {
    const fn = method(['shareImage', 'share_image', 'share', 'showSharePanel']);
    if (!fn) return Promise.resolve(false);
    return call(fn, { image: dataUrl, text: text || '赛博人物志' }).then(() => true);
  }

  /* 容器里没有分享能力时的兜底：直接在页面里下载 PNG */
  function downloadImage(dataUrl, name) {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = name || 'cyber-pets.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) { return false; }
  }

  /* 启动时探测一次，结果缓存在 STATE 上，供 UI 决定显示什么 */
  function boot() {
    STATE.checked = true;
    STATE.ok = available();
    if (!STATE.ok) return Promise.resolve(STATE);
    return Promise.all([profile(), videoAction()]).then(() => STATE);
  }

  return {
    available, boot, profile, videoAction, loadCloud, saveCloud,
    shareImage, downloadImage, state: () => STATE,
  };
})();
