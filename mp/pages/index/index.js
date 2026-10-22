/* pages/index/index.js —— 唯一页面：全屏 canvas，所有 UI 自绘 */
const UI = require('../../core/ui.js');
const ST = require('../../core/store.js');
const App = require('../../core/app.js');
const Scene = require('../../core/scene.js');

Page({
  data: {},
  canvas: null, ctx: null, vw: 0, vh: 0, scale: 1,
  last: 0, rafId: 0, killed: false,

  onReady() {
    ST.load();
    /* 离线收益：进来先结算一次，不弹提示 */
    App.idleTick(true);
    const S = ST.state();
    if (S.free10) {
      S.free10 = false; ST.save();
      setTimeout(() => {
        const r = ST.doRecruit(10, true);
        App.A.recRes = r.got;
        App.A.newList = r.got.filter(g => g.type === 'new');
        if (App.A.newList.length) App.A.ov = 'new';
        App.toast('新档赠礼：免费十连已到账');
      }, 500);
    }
    this.initCanvas();
  },
  onUnload() { this.killed = true; if (this.rafId) { try { if (this.canvas && this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(this.rafId); } catch (e) { } } },
  onHide() { this.last = 0; },

  winInfo() {
    try {
      if (typeof wx !== 'undefined') {
        if (wx.getWindowInfo) return wx.getWindowInfo();
        return wx.getSystemInfoSync();
      }
    } catch (e) { }
    return { pixelRatio: 2, windowWidth: 375, windowHeight: 812 };
  },

  initCanvas() {
    const self = this;
    wx.createSelectorQuery().select('#cv').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        /* 兜底：极少数机型拿不到 node，提示后走 */
        wx.showToast && wx.showToast({ title: '画布初始化失败，请重进', icon: 'none' });
        return;
      }
      const info = res[0];
      const canvas = info.node;
      const win = self.winInfo();
      const dpr = win.pixelRatio || 2;
      canvas.width = Math.round(info.width * dpr);
      canvas.height = Math.round(info.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      self.canvas = canvas; self.ctx = ctx;
      self.vw = info.width; self.vh = info.height;
      self.scale = Math.min(info.width / UI.VW, info.height / UI.VH);
      UI.setCtx(ctx); UI.setScale(self.scale);
      self.startLoop();
    });
  },

  startLoop() {
    const self = this;
    const step = function () {
      if (self.killed) return;
      self.draw();
      if (self.canvas && self.canvas.requestAnimationFrame) {
        self.rafId = self.canvas.requestAnimationFrame(step);
      } else {
        self.rafId = setTimeout(step, 16);
      }
    };
    step();
  },

  draw() {
    if (!this.ctx) return;
    const now = Date.now();
    const dt = this.last ? Math.min(0.12, (now - this.last) / 1000) : 0.016;
    this.last = now;
    App.frame(dt);
    const ctx = this.ctx, s = this.scale;
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.save();
    ctx.translate((this.vw - UI.VW * s) / 2, (this.vh - UI.VH * s) / 2);
    ctx.scale(s, s);
    try { Scene.render(App.A, App); } catch (e) {
      if (typeof console !== 'undefined') console.error('render error', e);
    }
    ctx.restore();
  },

  /* ---------- 触摸：把屏幕坐标换算回 480x880 逻辑坐标 ---------- */
  logic(p) {
    return {
      x: (p.x - (this.vw - UI.VW * this.scale) / 2) / this.scale,
      y: (p.y - (this.vh - UI.VH * this.scale) / 2) / this.scale,
    };
  },
  onTouchStart(e) {
    const t = e.touches[0];
    this._sx = t.x; this._sy = t.y; this._moved = false;
  },
  onTouchMove(e) {
    const t = e.touches[0];
    if (Math.abs(t.y - this._sy) > 4) this._moved = true;
    if (this._moved) App.drag(t.y - this._sy);
    this._sy = t.y;
  },
  onTouchEnd(e) {
    if (this._moved) return;
    const p = this.logic(e.changedTouches[0]);
    if (p.x < 0 || p.x > UI.VW || p.y < 0 || p.y > UI.VH) return;
    try { App.tap(p.x, p.y); } catch (err) {
      if (typeof console !== 'undefined') console.error('tap error', err);
    }
  },
});
