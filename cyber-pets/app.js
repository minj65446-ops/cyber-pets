/* =========================================================
   赛博人物志 · 养成馆 逻辑层
   纯前端，无依赖。状态存 localStorage。
   ========================================================= */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

const SAVE_KEY = 'cyber-pets-v1';

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
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      o.stats = o.stats || {};
      return o;
    }
  } catch (e) {}
  return defaultState();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

const cur = () => PETS.find(p => p.id === S.current) || PETS[0];

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

/** 通用：头身比 1:1 的 Q 版肖像，带各自特征 */
function drawPet(ctx, pet, size, mood = 80, t = 0) {
  const gs = size / 40;           // 40 格
  const P = PALETTE[pet.id] || PALETTE.laozhou;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // 背景
  px(ctx, 0, 0, 40, 40, P.bg, gs);
  // 站台
  px(ctx, 6, 33, 28, 2, 'rgba(0,0,0,.08)', gs);
  px(ctx, 8, 35, 24, 1, 'rgba(0,0,0,.05)', gs);

  const bob = Math.round(Math.sin(t / 500) * 0.6);
  const oy = bob;

  // 身体
  px(ctx, 13, 22 + oy, 14, 11, P.cloth, gs);
  px(ctx, 13, 22 + oy, 14, 2, 'rgba(255,255,255,.14)', gs);
  // 腿
  px(ctx, 15, 32 + oy, 4, 2, P.cloth, gs);
  px(ctx, 21, 32 + oy, 4, 2, P.cloth, gs);
  // 手
  px(ctx, 11, 24 + oy, 2, 6, P.skin, gs);
  px(ctx, 27, 24 + oy, 2, 6, P.skin, gs);

  // 脖子/头
  px(ctx, 14, 14 + oy, 12, 9, P.skin, gs);   // 头
  px(ctx, 13, 13 + oy, 14, 3, P.hair, gs);   // 头发

  // 各自特征
  switch (pet.id) {
    case 'yujie':
      px(ctx, 12, 11 + oy, 16, 5, P.hair, gs);
      px(ctx, 11, 13 + oy, 2, 4, P.hair, gs);
      px(ctx, 27, 13 + oy, 2, 4, P.hair, gs);
      px(ctx, 15, 16 + oy, 2, 1, '#3a2a20', gs); // 眉
      px(ctx, 23, 16 + oy, 2, 1, '#3a2a20', gs);
      px(ctx, 16, 19 + oy, 8, 1, '#b98a72', gs);
      px(ctx, 13, 24 + oy, 14, 3, P.acc, gs);   // 围裙带
      break;
    case 'guige':
      px(ctx, 14, 11 + oy, 12, 3, P.hair, gs);
      px(ctx, 16, 17 + oy, 2, 1, '#2a2a2a', gs);
      px(ctx, 22, 17 + oy, 2, 1, '#2a2a2a', gs);
      px(ctx, 16, 20 + oy, 8, 1, '#6b4a35', gs);
      px(ctx, 16, 18 + oy, 1, 1, '#2a2a2a', gs);
      px(ctx, 23, 18 + oy, 1, 1, '#2a2a2a', gs);
      if (mood > 60) { // 笑
        px(ctx, 17, 21 + oy, 6, 1, '#6b4a35', gs);
      }
      break;
    case 'laozhou':
      px(ctx, 13, 11 + oy, 14, 2, P.hair, gs);
      px(ctx, 12, 16 + oy, 3, 1, '#555', gs);
      px(ctx, 25, 16 + oy, 3, 1, '#555', gs);
      px(ctx, 15, 16 + oy, 2, 1, '#333', gs);
      px(ctx, 23, 16 + oy, 2, 1, '#333', gs);
      px(ctx, 15, 20 + oy, 10, 1, '#8b6b52', gs);
      px(ctx, 13, 22 + oy, 14, 1, '#3a3f4b', gs); // 围裙
      px(ctx, 9, 26 + oy, 3, 1, '#8a8f96', gs);   // 扳手
      px(ctx, 10, 26 + oy, 1, 3, '#8a8f96', gs);
      break;
    case 'zhouzhou':
      px(ctx, 12, 10 + oy, 16, 4, P.hair, gs);
      px(ctx, 11, 13 + oy, 2, 8, P.hair, gs);
      px(ctx, 27, 13 + oy, 2, 8, P.hair, gs);
      px(ctx, 16, 17 + oy, 2, 1, '#1f1f2e', gs);
      px(ctx, 22, 17 + oy, 2, 1, '#1f1f2e', gs);
      px(ctx, 17, 20 + oy, 6, 1, '#c25b8a', gs);   // 口红
      px(ctx, 28, 22 + oy, 4, 1, '#d1d5db', gs);   // 剪刀
      px(ctx, 30, 22 + oy, 1, 2, '#d1d5db', gs);
      px(ctx, 30, 23 + oy, 1, 2, '#d1d5db', gs);
      break;
    case 'niuge':
      px(ctx, 12, 12 + oy, 16, 2, P.acc, gs);      // 蝙蝠头带
      px(ctx, 13, 10 + oy, 3, 3, P.acc, gs);
      px(ctx, 24, 10 + oy, 3, 3, P.acc, gs);
      px(ctx, 15, 17 + oy, 3, 2, '#f8fafc', gs);   // 眼白
      px(ctx, 22, 17 + oy, 3, 2, '#f8fafc', gs);
      px(ctx, 16, 17 + oy, 1, 2, '#111', gs);
      px(ctx, 23, 17 + oy, 1, 2, '#111', gs);
      px(ctx, 17, 21 + oy, 6, 1, '#5b3a2a', gs);
      px(ctx, 12, 21 + oy, 1, 3, P.skin, gs);      // 大臂
      px(ctx, 27, 21 + oy, 1, 3, P.skin, gs);
      break;
    case 'nongcung':
      px(ctx, 14, 11 + oy, 12, 3, P.hair, gs);
      px(ctx, 16, 17 + oy, 2, 1, '#2b2b2b', gs);
      px(ctx, 22, 17 + oy, 2, 1, '#2b2b2b', gs);
      px(ctx, 16, 20 + oy, 8, 1, '#7a5a45', gs);
      px(ctx, 13, 22 + oy, 14, 2, '#4b5563', gs);
      break;
    case 'kewin':
      px(ctx, 13, 11 + oy, 14, 3, P.hair, gs);
      px(ctx, 16, 17 + oy, 2, 1, '#333', gs);
      px(ctx, 22, 17 + oy, 2, 1, '#333', gs);
      px(ctx, 17, 20 + oy, 6, 1, '#8b6b52', gs);
      px(ctx, 10, 25 + oy, 6, 1, '#f8fafc', gs);   // 键盘
      px(ctx, 10, 26 + oy, 6, 3, '#f8fafc', gs);
      px(ctx, 11, 27 + oy, 1, 1, '#111', gs);
      px(ctx, 13, 27 + oy, 1, 1, '#111', gs);
      break;
    case 'lizu':
      px(ctx, 13, 11 + oy, 14, 3, P.hair, gs);
      px(ctx, 15, 17 + oy, 2, 1, '#222', gs);
      px(ctx, 23, 17 + oy, 2, 1, '#222', gs);
      px(ctx, 15, 20 + oy, 10, 1, '#6b4a35', gs);
      px(ctx, 12, 22 + oy, 16, 1, '#0f172a', gs);  // 西装领
      break;
  }

  // 红晕 / 心情
  if (mood > 70) {
    px(ctx, 14, 19 + oy, 2, 1, 'rgba(230,120,120,.35)', gs);
    px(ctx, 24, 19 + oy, 2, 1, 'rgba(230,120,120,.35)', gs);
  }
  if (mood < 30) {
    px(ctx, 16, 20 + oy, 8, 1, '#7a5a45', gs);
    px(ctx, 17, 21 + oy, 1, 1, '#7a5a45', gs);
    px(ctx, 22, 21 + oy, 1, 1, '#7a5a45', gs);
  }
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
    const e = pick(EVENTS);
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
  S.day++;
  S.mood = clamp(S.mood - rand(3, 9));
  const p = cur();
  if (p.passive && p.id === 'yujie') addStat('yujie', '流量', -2);
  if (Math.random() < 0.55) {
    const e = pick(EVENTS);
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
  save();
  renderStats();
}

function refreshAfterAction() {
  save();
  renderStats();
  renderDetail();
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
        say(`「${p.name}」已被平台限流。你可以收藏他，但不能喂，也不能对战。`);
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
    blog(`<b>${B.pet.name}</b> 塌房了。你赢了。`);
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

/* ---------------- 启动 ---------------- */
renderPicker();
renderStats();
renderDetail();
renderItems();
say('掌机已开机。DAY 1，请选择要养的那一位。');
say('提示：每天都会发生一点事。多数时候你控制不了。');
