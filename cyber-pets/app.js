/* =========================================================
   赛博人物志 · 养成馆 逻辑层
   纯前端，无依赖。状态存 localStorage。
   ========================================================= */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/* 存档键带命名空间前缀：Toy 里页面跑在 bilibili.com 域下，
   裸键名会和别的 Toy 撞车，也会被用户清缓存时一起清掉。 */
const SAVE_KEY = 'cyberpets:save:v1';
const LEGACY_KEY = 'cyber-pets-v1';     // 老版本键名，只读一次做迁移

/* ---------------- 状态 ---------------- */
const defaultState = () => ({
  current: 'yujie',
  day: 1,
  level: 1,
  exp: 0,
  mood: 80,
  stats: {},          // per-pet own stats
  seen: [],           // 对话历史
  wins: 0,
  losses: 0,
  /* ---- 12 周赛季 ---- */
  seasonNo: 1,
  fans: 0,            // 当前赛季粉丝
  signed: [],         // 本赛季已签约角色 id
  slots: [null, null, null],   // 3 个流量位
  weekFans: 0,        // 本周新增粉丝
  weekDone: 0,        // 已结算到第几周
  weekLog: [],        // 每周战绩
  hall: [],           // 历史赛季清算记录
  savedAt: 0,         // 最后写入时间，云存档合并用
});
function initStats(o) {
  PETS.forEach(p => {
    o.stats[p.id] = Object.assign({}, p.stats, o.stats[p.id] || {});
  });
  return o;
}

let S = initStats(load());

function load() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const old = localStorage.getItem(LEGACY_KEY);
      if (old) {
        raw = old;
        try { localStorage.setItem(SAVE_KEY, old); localStorage.removeItem(LEGACY_KEY); } catch (e) {}
      }
    }
    if (raw) {
      const o = JSON.parse(raw);
      o.stats = o.stats || {};
      return o;
    }
  } catch (e) {}
  return defaultState();
}
function save() {
  S.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  pushCloud();
}

/* ---------------- Toy SDK 桥（只在 Toy 容器内生效） ---------------- */
let _cloudT = null;
/* 云存档不逐次写：攒 2.5 秒写一次，避免把每次点击都打到云存储上（Toy 侧有限流） */
function pushCloud() {
  if (!window.ToyBridge || !ToyBridge.state().ok) return;
  clearTimeout(_cloudT);
  _cloudT = setTimeout(() => { ToyBridge.saveCloud(S, SAVE_KEY); }, 2500);
}

function toyBoot() {
  if (!window.ToyBridge) return;
  ToyBridge.boot().then(st => {
    if (!st || !st.ok) return;
    const bar = $('#toyBar');
    if (bar) bar.classList.remove('hide');
    if ($('#toyWho')) $('#toyWho').textContent = (st.user && st.user.nickname) || 'Toy 已连接';
    if ($('#toyTri') && st.action) {
      const a = st.action;
      $('#toyTri').textContent = '点赞' + (a.liked ? '✓' : '—') + ' 投币' + (a.coined ? '✓' : '—') + ' 收藏' + (a.faved ? '✓' : '—');
    }
    return ToyBridge.loadCloud(SAVE_KEY).then(cloud => {
      if (cloud && cloud.savedAt && cloud.savedAt > (S.savedAt || 0)) {
        S = initStats(Object.assign(defaultState(), cloud));
        save();
        renderPicker(); renderStats(); renderDetail(); renderItems(); renderSeason();
        say('云存档比本地新，已同步。');
      }
    });
  }).catch(() => {});
}

/* 分享图：程序化头像 + 本赛季战绩，Toy 里走 SDK，普通网页里退回下载 */
function shareCard() {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 800;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 600, 800);
  g.fillStyle = '#16352f'; g.fillRect(0, 0, 600, 132);
  g.fillStyle = '#c3e88d'; g.font = 'bold 42px "PingFang SC","Microsoft YaHei",sans-serif';
  g.fillText('赛博人物志', 40, 72);
  g.fillStyle = '#8fb866'; g.font = '15px ui-monospace,monospace';
  g.fillText('CYBER PERSONA · 掌机养成', 40, 104);

  const bx = 40, by = 166, bw = 520, bh = 372;
  g.fillStyle = '#fffdf8'; g.fillRect(bx, by, bw, bh);
  g.strokeStyle = '#e2dccf'; g.strokeRect(bx + .5, by + .5, bw - 1, bh - 1);
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 300;
  drawPet(tmp.getContext('2d'), cur(), 300, S.mood, 0);
  g.drawImage(tmp, bx + (bw - 300) / 2, by + 24);
  g.textAlign = 'center';
  g.fillStyle = '#1a1a1a'; g.font = 'bold 30px "PingFang SC",sans-serif';
  g.fillText(cur().name, 300, by + 372 - 40);
  g.fillStyle = '#5b5852'; g.font = '15px ui-monospace,monospace';
  g.fillText(cur().alias + ' · ' + cur().tier, 300, by + 372 - 16);
  g.textAlign = 'left';

  const rows = [
    ['赛季', 'S' + S.seasonNo + ' · 第 ' + weekOf() + '/12 周'],
    ['粉丝', S.fans + ' / ' + SEASON.fanGoal],
    ['签约', S.signed.length + ' / ' + SEASON.signGoal],
    ['等级', 'LV.' + S.level],
  ];
  rows.forEach((r, i) => {
    const y = 600 + i * 42;
    g.fillStyle = '#8d887d'; g.font = '14px ui-monospace,monospace'; g.fillText(r[0], 44, y);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 21px ui-monospace,monospace'; g.fillText(r[1], 150, y);
  });
  g.fillStyle = '#9b968b'; g.font = '12px sans-serif';
  g.fillText('角色均为虚构 · 非商业用途', 44, 776);

  const url = c.toDataURL('image/png');
  const toyOn = window.ToyBridge && ToyBridge.state().ok;
  if (toyOn) {
    ToyBridge.shareImage(url, '赛博人物志 · ' + cur().name).then(ok => {
      if (!ok) ToyBridge.downloadImage(url, 'cyber-pets.png');
      say(ok ? '分享图已拉起 Toy 分享面板。' : '分享面板没响应，已改为导出图片。');
    });
  } else {
    if (window.ToyBridge) ToyBridge.downloadImage(url, 'cyber-pets.png');
    say('已生成分享图（浏览器里直接下载 PNG）。');
  }
}

/* 老存档没有赛季字段，补默认值（不重置任何已有进度） */
(function migrateSeason() {
  const d = defaultState();
  ['seasonNo', 'fans', 'signed', 'slots', 'weekFans', 'weekDone', 'weekLog', 'hall'].forEach(k => {
    if (S[k] === undefined) S[k] = d[k];
  });
  if (!Array.isArray(S.slots) || S.slots.length !== 3) S.slots = [null, null, null];
  if (!Array.isArray(S.signed)) S.signed = [];
  S.slots = S.slots.map(id => (S.signed.indexOf(id) >= 0 ? id : null));
})();

const cur = () => PETS.find(p => p.id === S.current) || PETS[0];

/* =========================================================
   12 周赛季：一周 7 天，12 周一个循环。
   复用现有积木 —— S.day 天数计数器、EVENTS 事件卡 good/bad 结算、
   下一天的资源产出。「周」只是 S.day 的一层派生，不新增时间系统。
   ========================================================= */
const SEASON = {
  weeks: 12,
  slotN: 3,               // 每周 3 个流量位
  signGoal: 7,            // 12 周签 7 人（可签池正好 7 位，8 人里 1 位封印）
  fanGoal: 4000,          // 12 周冲 4000 粉
  weekFans: 333,          // 4000 / 12 取整，作为周目标
  signFans: { R: 120, SR: 200, SSR: 320, UR: 480 },
  minMood: 60,            // 签约心情门槛
  keepRate: 0.3,          // 清算后保留的粉丝比例
};

const weekOf = () => Math.min(SEASON.weeks, Math.floor((S.day - 1) / 7) + 1);
const rawWeek = () => Math.floor((S.day - 1) / 7) + 1;
const dayInWeek = () => ((S.day - 1) % 7) + 1;

/* 可签池 = 8 位里除封印角色 */
const signable = () => PETS.filter(p => !p.nc);

/* 每周轮换 3 个签约位：按周序号整体滑动，12 周里每位都会轮到多次 */
function weekPool() {
  const pool = signable();
  const start = ((weekOf() - 1) * SEASON.slotN) % pool.length;
  return [0, 1, 2].map(i => pool[(start + i) % pool.length]);
}

/* 事件池按周奇偶轮换：这周看这 5 张，下周换另外 5 张 */
function weekEvents() {
  const w = weekOf();
  const list = EVENTS.filter((_, i) => (i + w) % 2 === 0);
  return list.length ? list : EVENTS;
}

/* 流量位每天产粉：角色「流量」属性 × 心情修正 */
function slotYield() {
  let fans = 0;
  S.slots.forEach(id => {
    if (!id) return;
    const st = S.stats[id];
    if (!st) return;
    fans += Math.max(1, Math.round((st.流量 || 0) / 14 * (1 + (S.mood - 50) / 200)));
  });
  return fans;
}

function signPet(id) {
  const p = PETS.find(x => x.id === id);
  if (!p || p.nc) return;
  if (S.signed.indexOf(id) >= 0) { say(`「${p.name}」已经在名单里了。`); return; }
  if (!weekPool().some(x => x.id === id)) { say(`「${p.name}」本周没有档期，下周再来看看。`); return; }
  if (S.mood < SEASON.minMood) { say(`心情 ${Math.round(S.mood)}，太低了。「${p.name}」说改天再谈。`); return; }
  S.signed.push(id);
  const gain = SEASON.signFans[p.tier] || 100;
  S.fans += gain;
  S.weekFans += gain;
  S.mood = clamp(S.mood - 10);
  say(`签约成功：「${p.name}」${p.tier}，粉丝 +${gain}。`);
  if (S.signed.length === SEASON.signGoal) say('七位都签下了。剩下五周，冲粉丝。');
  refreshAfterAction();
  renderSeason();
}

/* 流量位：空 → 第 1 位 → 第 2 位 → … → 空，循环切换 */
function cycleSlot(i) {
  if (!S.signed.length) { say('先签一位，再谈流量位。'); return; }
  const curId = S.slots[i];
  const idx = S.signed.indexOf(curId);
  S.slots[i] = idx === -1 ? S.signed[0] : (idx === S.signed.length - 1 ? null : S.signed[idx + 1]);
  save();
  renderSeason();
  say(S.slots[i] ? `流量位 ${i + 1}：${PETS.find(p => p.id === S.slots[i]).name}。` : `流量位 ${i + 1} 空出来了。`);
}

/* 周末结算：达标给额外粉丝，写进本周战绩 */
function settleWeek(wkArg) {
  const w = wkArg || weekOf();
  const got = S.weekFans;
  let bonus = 0;
  if (got >= SEASON.weekFans) {
    bonus = 60;
    S.fans += bonus;
    S.mood = clamp(S.mood + 4);
    say(`第 ${w} 周结算：本周 +${got} 粉，达标，额外 +${bonus}。`);
  } else {
    say(`第 ${w} 周结算：本周 +${got} 粉，差 ${SEASON.weekFans - got} 粉达标。`);
  }
  (S.weekLog = S.weekLog || []).push({ w, fans: got, bonus });
  if (S.weekLog.length > 24) S.weekLog.shift();
  S.weekFans = 0;
  S.weekDone = w;
}

/* 第 12 周结束：按粉丝 + 签约数评级，保留 30% 粉丝进下一季 */
function endSeason() {
  const fans = S.fans, signed = S.signed.length;
  let rank = 'A';
  if (signed >= SEASON.signGoal && fans >= SEASON.fanGoal) rank = 'SSS';
  else if (fans >= 3000) rank = 'SS';
  else if (fans >= 2000) rank = 'S';
  const keep = Math.floor(fans * SEASON.keepRate);
  (S.hall = S.hall || []).push({ season: S.seasonNo, rank, fans, signed });
  const ov = $('#seasonOv');
  if (ov) {
    $('#ovTitle').textContent = `第 ${S.seasonNo} 赛季 · 清算`;
    $('#ovRank').textContent = rank;
    $('#ovBody').innerHTML =
      `签约 <b>${signed} / ${SEASON.signGoal}</b> 位　·　粉丝 <b>${fans}</b> / ${SEASON.fanGoal}<br>` +
      (rank === 'SSS' ? '顶流达成，赛季满分。' : '没到顶流，但账留下了。') + '<br>' +
      `清算后保留 <b>30%</b> 粉丝（<b>${keep}</b>）和全部等级，签约名单清空，重新开季。`;
    ov.classList.remove('hide');
  }
  S._pending = { keep, rank, fans, signed };
  save();
}

function startNextSeason() {
  const keep = (S._pending && S._pending.keep) || Math.floor(S.fans * SEASON.keepRate);
  S.seasonNo++;
  S.day = 1;
  S.fans = keep;
  S.signed = [];
  S.slots = [null, null, null];
  S.weekFans = 0;
  S.weekDone = 0;
  S.weekLog = [];
  S._pending = null;
  const ov = $('#seasonOv');
  if (ov) ov.classList.add('hide');
  say(`第 ${S.seasonNo} 赛季开始。带着 ${keep} 位老粉，重新签人。`);
  save();
  renderSeason(); renderStats(); renderPicker(); renderDetail();
}

function renderSeason() {
  if (!$('#sPool')) return;
  const wk = weekOf();
  $('#sNo').textContent = S.seasonNo;
  $('#sWeek').textContent = wk;
  $('#sLeft').textContent = Math.max(0, 7 - dayInWeek() + 1);
  $('#wkBar').innerHTML = Array.from({ length: SEASON.weeks }, (_, i) => {
    const w = i + 1;
    const cls = (w < wk || S.weekDone >= w) ? 'done' : (w === wk ? 'now' : '');
    return `<i class="${cls}">${w}</i>`;
  }).join('');
  $('#sFans').textContent = S.fans;
  $('#sSign').textContent = S.signed.length;
  $('#sWeekFans').textContent = `${S.weekFans} / ${SEASON.weekFans}`;

  $('#sPool').innerHTML = weekPool().map(p => {
    const signed = S.signed.indexOf(p.id) >= 0;
    const can = !signed && S.mood >= SEASON.minMood;
    const label = signed ? '已签约' : (can ? '签约 +' + (SEASON.signFans[p.tier] || 100) : '心情不足');
    return `<div class="sp ${signed ? 'signed' : ''}" data-sign="${p.id}">
      <div class="n">${p.name}</div>
      <div class="t">${p.tier} · ${p.alias}</div>
      <div class="b ${can ? 'can' : ''}">${label}</div></div>`;
  }).join('');
  $$('#sPool .sp').forEach(el => { el.onclick = () => signPet(el.dataset.sign); });

  $('#sSlots').innerHTML = S.slots.map((id, i) => {
    const p = id ? PETS.find(x => x.id === id) : null;
    return `<div class="sl ${id ? 'has' : ''}" data-slot="${i}">${p ? p.name : '空位 ' + (i + 1)}</div>`;
  }).join('');
  $$('#sSlots .sl').forEach(el => { el.onclick = () => cycleSlot(+el.dataset.slot); });
}

/* ---------------- 像素绘制 ---------------- */
/**
 * 用程序化像素块画"肖像"。每个人物一套配色 + 若干特征层。
 * 60x60 网格，16 色，不做美术资源依赖。
 */
const PALETTE = {
  yujie:    { bg: '#efe3cf', skin: '#e8b48a', hair: '#2a1d16', cloth: '#3f6b3a', acc: '#c0392b' },
  guige:    { bg: '#dbe8e4', skin: '#c99570', hair: '#3b3b3b', cloth: '#4a5d4e', acc: '#e0f2d8' },
  laozhou:  { bg: '#e4e7ea', skin: '#d8a87e', hair: '#8a8a8a', cloth: '#4b5563', acc: '#b45309' },
  zhouzhou: { bg: '#e9e2f3', skin: '#eec0a0', hair: '#1f1f2e', cloth: '#7c3aed', acc: '#f472b6' },
  niuge:    { bg: '#e8e3d8', skin: '#c98d63', hair: '#1a1a1a', cloth: '#1f2937', acc: '#f59e0b' },
  nongcung: { bg: '#e5e0d8', skin: '#c9a07a', hair: '#2b2b2b', cloth: '#6b7280', acc: '#991b1b' },
  kewin:    { bg: '#e3e6f2', skin: '#e5b791', hair: '#141414', cloth: '#1e293b', acc: '#4f46e5' },
  lizu:     { bg: '#dfe3e8', skin: '#d3a179', hair: '#232323', cloth: '#111827', acc: '#334155' },
};

function px(ctx, x, y, w, h, color, gs) {
  ctx.fillStyle = color;
  ctx.fillRect(x * gs, y * gs, w * gs, h * gs);
}

/** 立绘本体交给 pixel.js 的参数化引擎（体型×发型×道具×附加件×表情）。
    这里只负责把 data.js 的 pet 翻译成引擎要的 figure 形状。 */
function drawPet(ctx, pet, size, mood, t) {
  const P = PALETTE[pet.id] || PALETTE.laozhou;
  const fig = { id: pet.id, class: pet.species === 'abstract' ? 'stunt' : 'hard', palette: P };
  PX.draw(ctx, fig, size, { t: t || 0, glow: pet.color, mood: mood });
}

/* ---------------- 掌机屏幕 ---------------- */
const lcd = $('#lcd');
const lctx = lcd.getContext('2d');
let animT = 0;
function loop(ts) {
  animT = ts;
  const p = cur();
  drawPet(lctx, p, lcd.width, S.mood, ts);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------------- 控制台 ---------------- */
function say(text, cls = '') {
  const box = $('#console');
  const div = document.createElement('div');
  div.className = 'ln new ' + cls;
  div.textContent = text;
  box.appendChild(div);
  while (box.children.length > 6) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
  S.seen.push(text);
  if (S.seen.length > 60) S.seen.shift();
}

/* ---------------- 状态面板 ---------------- */
function renderStats() {
  const p = cur();
  const st = S.stats[p.id];
  const row = (k, v) => `<div class="row"><span class="k">${k}</span>
    <span class="bar"><i style="width:${clamp(v)}%"></i></span><span class="v">${Math.round(v)}</span></div>`;
  $('#statPanel').innerHTML = STAT_KEYS.map(k => row(k, st[k])).join('');
  $('#hudL').textContent = `DAY ${S.day}`;
  $('#hudR').textContent = `LV.${S.level} 心情 ${Math.round(S.mood)}`;
}

/* ---------------- 喂食 / 互动 / 休息 ---------------- */
function addStat(petId, key, delta) {
  S.stats[petId][key] = clamp((S.stats[petId][key] || 0) + delta);
}
function gainExp(n) {
  S.exp += n;
  const need = 30 + S.level * 15;
  if (S.exp >= need) {
    S.exp -= need; S.level++;
    say(`升到 LV.${S.level}。「${cur().name}」的人设更立体了一点。`);
  }
}

function feed() {
  const p = cur();
  if (p.nc) { say(`「${p.name}」不能喂食。有些东西不该被养成。`); return; }
  const likes = { yujie: '铁锅炖大鹅', guige: '白菜萝卜', laozhou: '两个煎饼', zhouzhou: '一碗拌粉', niuge: '两斤牛肉', kewin: '一杯普洱', lizu: '一碗担担面' };
  const fav = likes[p.id] || '一顿饭';
  S.mood = clamp(S.mood + rand(6, 14));
  addStat(p.id, '体质', rand(1, 3));
  addStat(p.id, '良心', rand(0, 2));
  say(`喂了一份${fav}。心情 +${rand(6, 14)}。`);
  if (Math.random() < 0.3) {
    const e = pick(weekEvents());
    say(`【事件】${e.title} —— ${e.text}`);
  }
  gainExp(4);
  refreshAfterAction();
}

function play() {
  const p = cur();
  const lines = {
    yujie: ['她一脚踹开了门，然后发现门是自己的。', '她说要给你把控质量，你赶紧把东西放下了。'],
    guige: ['「加油，奥利给！」你的心情莫名+20。', '他邀请你冬泳，水温零度。你拒绝了。'],
    laozhou: ['「能修能修。」他把你的手机壳修好了，还多打了一个孔。', '他说这个东西十年八年不坏，你不确定他指哪个。'],
    zhouzhou: ['她热情地问你想怎么剪，然后剪成了她想要的。', '十块钱。你摸着后脑勺，觉得还可以更糟。'],
    niuge: ['他单手举起四桶水，让你录音说「专业动作请勿模仿」。', '他掰弯了一根螺纹钢。你鼓掌。专家在评论区写小作文。'],
    nongcung: ['他让你跳抓钱舞，你退后了两步。'],
    kewin: ['他一边甩头一边弹琴，音准一点没跑。', '「甲乙丙丁。」你听不懂，但你觉得很高级。'],
    lizu: ['他一句话没说，只是清了清嗓子。你后退了三步。'],
  };
  const l = lines[p.id] || ['你们相处了一会儿。'];
  say(pick(l));
  S.mood = clamp(S.mood + rand(2, 10));
  addStat(p.id, '抽象', rand(1, 3));
  addStat(p.id, '流量', rand(0, 4));
  gainExp(5);
  refreshAfterAction();
}

function rest() {
  const p = cur();
  S.mood = clamp(S.mood + rand(10, 18));
  addStat(p.id, '风险', -rand(1, 3));
  say(`休息一天。${p.name}把手机扣在桌上。`);
  gainExp(2);
  refreshAfterAction();
}

function nextDay() {
  const fansGain = slotYield();       // 流量位先产粉，再推进日期
  S.day++;
  S.mood = clamp(S.mood - rand(3, 9));
  const p = cur();
  if (p.passive && p.id === 'yujie') addStat('yujie', '流量', -2);
  if (fansGain) {
    S.fans += fansGain;
    S.weekFans += fansGain;
    say(`流量位产出：粉丝 +${fansGain}。`);
  }
  if (Math.random() < 0.55) {
    const e = pick(weekEvents());
    say(`【事件】${e.title} —— ${e.text}`);
    // 结果
    const good = Object.entries(e.good || {});
    const bad = Object.entries(e.bad || {});
    const win = Math.random() < 0.5;
    const use = win ? good : bad;
    if (use.length) {
      use.forEach(([k, v]) => addStat(p.id, k, v));
      say(`结果：${use.map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(' / ')}`, win ? 'ok' : 'bad');
    }
    S.mood = clamp(S.mood + (win ? rand(2, 8) : -rand(4, 12)));
  }
  gainExp(6);

  /* 周末结算 / 赛季清算 */
  if (S.day > 1 && (S.day - 1) % 7 === 0) {
    settleWeek(rawWeek() - 1);          // 先把这一周结算掉（第 12 周也要结）
    if (rawWeek() > SEASON.weeks) {
      endSeason();
      save();
      renderStats();
      renderSeason();
      return;
    }
  }

  save();
  renderStats();
  renderSeason();
}

function refreshAfterAction() {
  save();
  renderStats();
  renderDetail();
  renderSeason();
}

/* ---------------- 渲染角色列表 ---------------- */
function renderPicker() {
  const box = $('#picker');
  box.innerHTML = '';
  PETS.forEach(p => {
    const d = document.createElement('div');
    d.className = 'pcard' + (p.id === S.current ? ' on' : '');
    d.innerHTML = `<span class="tier ${p.tier}">${p.tier}</span>
      <div class="nm">${p.name}</div>
      <div class="al">${p.alias}</div>
      <canvas width="64" height="64"></canvas>`;
    const c = d.querySelector('canvas');
    drawPet(c.getContext('2d'), p, 64, 80, 0);
    d.onclick = () => {
      if (p.nc) {
        say(`「${p.name}」已被平台降权。你可以收藏他，但不能喂，也不能对战。`);
      }
      S.current = p.id;
      save();
      renderPicker(); renderStats(); renderDetail();
      say(`切换到「${p.name}」——${p.alias}。`);
    };
    box.appendChild(d);
  });
}

/* ---------------- 渲染档案 ---------------- */
function renderDetail() {
  const p = cur();
  const st = S.stats[p.id];
  const bar = (k) => `<div class="row"><span class="k">${k}</span>
    <span class="bar"><i style="width:${clamp(st[k])}%"></i></span><span class="v">${Math.round(st[k])}</span></div>`;

  const species = (SPECIES[p.species] || {}).label || '未知';

  $('#detailBody').innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <canvas id="dpet" width="96" height="96" style="width:96px;height:96px;image-rendering:pixelated;border-radius:10px;border:1px solid var(--line);flex:none"></canvas>
      <div style="flex:1;min-width:220px">
        <div style="font-size:19px;font-weight:800;letter-spacing:-.3px">${p.name}
          <span style="font-size:11px;font-weight:600;color:#9b968b">No.${String(PETS.indexOf(p) + 1).padStart(3, '0')}</span>
        </div>
        <div style="font-size:11.5px;color:var(--ink2);margin-top:4px">${p.alias} · ${p.tier}</div>
        <div style="margin-top:9px">
          <span class="badge" style="background:${(SPECIES[p.species]||{}).color}1a;color:${(SPECIES[p.species]||{}).color}">${species}</span>
          <span class="badge">${p.region}</span>
          <span class="badge">${p.class}</span>
        </div>
      </div>
    </div>
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:0 18px">
      ${STAT_KEYS.map(bar).join('')}
    </div>
    <dl class="dl" style="margin-top:16px">
      <dt>原型</dt><dd>${p.realName}</dd>
      <dt>属性</dt><dd>${p.nature} · 爱吃 ${p.feed}</dd>
    </dl>
    <div class="quote-big">「${p.quote}」</div>
    <div style="font-size:12.5px;line-height:1.85;margin-top:14px;color:#3d3a34">${p.lore}</div>
    <div style="margin-top:16px;font-size:12px;font-weight:800;color:var(--ink2)">技能</div>
    <div class="skills">
      ${p.skills.map(s => `<div class="skill">
        <b>${s.name}</b><span class="p">${s.type} ${s.power}</span>
        <p>${s.desc}</p></div>`).join('')}
    </div>
    <div class="note"><b>被动 · ${p.passive.name}</b>　${p.passive.desc}<br><br>
      <b>对战定位</b>　${p.battle}</div>
  `;
  const c = $('#dpet');
  if (c) drawPet(c.getContext('2d'), p, 96, S.mood, 0);
}

/* ---------------- 词条 ---------------- */
function renderItems() {
  const box = $('#itemList');
  box.innerHTML = '';
  ITEMS.forEach(it => {
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = `<span class="ic">${it.icon}</span>${it.name}<div class="ef">${it.effect}</div>`;
    d.onclick = () => useItem(it);
    box.appendChild(d);
  });
}
function useItem(it) {
  const p = cur();
  if (p.nc) { say('该角色不能使用词条。'); return; }
  if (!it.targets.includes(p.id)) {
    say(`「${p.name}」看了看${it.name}，又看了看你，没接。`);
    S.mood = clamp(S.mood - 3);
    renderStats(); return;
  }
  say(`使用【${it.name}】→ ${it.effect}。「${it.quote}」`);
  // 简易解析效果文案
  it.effect.split('，').forEach(seg => {
    const m = seg.match(/([^\+\-]+)([\+\-])(\d+)/);
    if (m) {
      const k = m[1].trim();
      if (STAT_KEYS.includes(k)) addStat(p.id, k, (m[2] === '+' ? 1 : -1) * +m[3]);
    }
  });
  gainExp(3);
  refreshAfterAction();
}

/* ---------------- 对战 ---------------- */
let A = { pet: null, hp: 100, buff: 0 };
let B = { pet: null, hp: 100 };

function newFoe(exceptId) {
  const list = PETS.filter(p => !p.nc && p.id !== (exceptId || S.current));
  return pick(list);
}
function startBattle() {
  A.pet = cur(); A.hp = 100; A.buff = 0;
  B.pet = newFoe(); B.hp = 100;
  $('#faName').textContent = A.pet.name;
  $('#fbName').textContent = B.pet.name;
  drawPet($('#faCanvas').getContext('2d'), A.pet, 64, S.mood, 0);
  drawPet($('#fbCanvas').getContext('2d'), B.pet, 64, 70, 0);
  updateHp();
  $('#battleLog').innerHTML = `对手是「${B.pet.name}」——${B.pet.alias}。`;
}
function updateHp() {
  $('#faHp').style.width = Math.max(0, A.hp) + '%';
  $('#fbHp').style.width = Math.max(0, B.hp) + '%';
}
function blog(html) {
  const box = $('#battleLog');
  box.innerHTML += `<div>${html}</div>`;
  box.scrollTop = box.scrollHeight;
}
function calcDamage(attacker, defender, base) {
  const st = S.stats[attacker.id];
  const atk = st.才艺 * 0.4 + st.体质 * 0.4 + st.抽象 * 0.2;
  const dst = S.stats[defender.id].风险 * 0.15;
  const dmg = Math.round(base * (0.6 + atk / 120) - dst * 0.6 + rand(-8, 8));
  return Math.max(6, dmg);
}
function playerMove(idx) {
  if (!A.pet) startBattle();
  if (A.hp <= 0 || B.hp <= 0) { blog('<b>本局已结束，点「满血复位」再打。</b>'); return; }

  const mv = MOVES.battle[idx];
  if (idx === 3) {
    blog(`你选择了「别播了」。直播间黑屏，双方握手，本回合不加分。`);
    blog('—— 平局收场 ——');
    return;
  }
  let dmg = calcDamage(A.pet, B.pet, mv.power);
  if (idx === 1) {
    A.buff = 1;
    blog(`<b>${A.pet.name}</b> 使用「${mv.name}」，对手陷入混乱（下回合伤害-30%）。`);
  } else {
    blog(`<b>${A.pet.name}</b> 使用「${mv.name}」，对 ${B.pet.name} 造成 <b>${dmg}</b> 点伤害。`);
  }
  B.hp -= dmg;
  updateHp();
  if (B.hp <= 0) {
    blog(`<b>${B.pet.name}</b> 翻车了。你赢了。`);
    S.wins++; say(`对战胜利：${A.pet.name} 击败 ${B.pet.name}。`);
    addStat(A.pet.id, '流量', 5); gainExp(12); save(); renderStats();
    return;
  }
  foeTurn();
}
function foeTurn() {
  const mv = pick(MOVES.battle.slice(0, 3));
  let dmg = calcDamage(B.pet, A.pet, mv.power);
  if (A.buff) { dmg = Math.round(dmg * 0.7); A.buff = 0; blog('（混乱生效，伤害降低）'); }
  A.hp -= dmg;
  blog(`<b>${B.pet.name}</b> 使用「${mv.name}」，造成 <b>${dmg}</b> 点伤害。`);
  updateHp();
  if (A.hp <= 0) {
    blog(`<b>${A.pet.name}</b> 被反噬了。你输了。`);
    S.losses++; say(`对战失败：${A.pet.name} 不敌 ${B.pet.name}。`);
    addStat(A.pet.id, '风险', 6); S.mood = clamp(S.mood - 8); save(); renderStats();
  }
}

/* ---------------- Tab ---------------- */
$$('.tab').forEach(t => {
  t.onclick = () => {
    $$('.tab').forEach(x => x.classList.toggle('on', x === t));
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + t.dataset.tab));
    if (t.dataset.tab === 'battle') startBattle();
    if (t.dataset.tab === 'detail') renderDetail();
  };
});

/* ---------------- 绑定 ---------------- */
$('#btnFeed').onclick = feed;
$('#btnPlay').onclick = play;
$('#btnRest').onclick = rest;
$('#btnNext').onclick = nextDay;
$('#btnNewFoe').onclick = () => { startBattle(); };
$('#btnResetHp').onclick = () => { startBattle(); };
$$('.moves button').forEach(b => b.onclick = () => playerMove(+b.dataset.move));
if ($('#ovNext')) $('#ovNext').onclick = startNextSeason;
if ($('#btnShare')) $('#btnShare').onclick = shareCard;

/* ---------------- 启动 ---------------- */
renderPicker();
renderStats();
renderDetail();
renderItems();
renderSeason();
say(`掌机已开机。第 ${S.seasonNo} 赛季 · 第 ${weekOf()} 周，先签一位。`);
say('提示：12 周一个赛季。每周只有 3 个签约位，签下的人越多，流量位能产的粉越多。');
toyBoot();
