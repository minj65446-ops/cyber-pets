/* =========================================================
   core/face.js —— 侠客头像离屏缓存
   小程序用 wx.createOffscreenCanvas；Node 测试环境退化为空，渲染层需容错
   ========================================================= */
const { drawFigure } = require('../portrait.js');

const cache = {};

function make(size) {
  try {
    if (typeof wx !== 'undefined' && wx.createOffscreenCanvas) {
      return wx.createOffscreenCanvas({ type: '2d', width: size, height: size });
    }
  } catch (e) { }
  return null;
}

/* 返回可直接 drawImage 的离屏 canvas；取不到就返回 null，调用方画占位块 */
function get(id, FIG_MAP, size) {
  const s = size || 64;
  const key = id + '@' + s;
  if (cache[key] !== undefined) return cache[key];
  const f = FIG_MAP[id];
  let cv = null;
  if (f) {
    cv = make(s);
    if (cv) {
      try { drawFigure(cv.getContext('2d'), f, s, { still: true }); }
      catch (e) { cv = null; }
    }
  }
  cache[key] = cv;
  return cv;
}

module.exports = { get };
