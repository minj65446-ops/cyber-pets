/* =========================================================
   赛博群像馆 · 逻辑层
   ========================================================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/* ---------------- 像素肖像 ---------------- */
/* ---------------- 视图切换 ---------------- */
let currentTab = 'hall';
function showView(key) {
  currentTab = key;
  $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === key));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + key));
  try { sessionStorage.setItem('fate-tab', key); } catch (e) { /* 隐私模式忽略 */ }
}
$$('.tab').forEach(t => {
  t.onclick = () => showView(t.dataset.tab);
});
$('#backBtn').onclick = () => showView(currentTab === 'detail' ? 'hall' : currentTab);

// 从养成馆回来时恢复上次停留的标签页
try {
  const saved = sessionStorage.getItem('fate-tab');
  if (saved && saved !== 'detail' && $(`#view-${saved}`)) showView(saved);
} catch (e) { /* 隐私模式忽略 */ }

/* ---------------- 群像馆 ---------------- */
let filter = 'all';
try {
  const f = sessionStorage.getItem('fate-filter');
  if (f && (f === 'all' || CLASSES[f])) filter = f;
} catch (e) { /* 隐私模式忽略 */ }

function renderFilters() {
  const counts = {};
  FIGURES.forEach(s => counts[s.class] = (counts[s.class] || 0) + 1);
  let html = `<button class="chip${filter === 'all' ? ' on' : ''}" data-f="all">全部 · ${FIGURES.length}</button>`;
  Object.entries(CLASSES).forEach(([k, c]) => {
    if (!counts[k]) return;
    html += `<button class="chip${filter === k ? ' on' : ''}" data-f="${k}"><i style="color:${c.color}">${c.icon}</i>${c.name} · ${counts[k]}</button>`;
  });
  $('#filters').innerHTML = html;
  $$('#filters .chip').forEach(b => {
    b.onclick = () => {
      filter = b.dataset.f;
      try { sessionStorage.setItem('fate-filter', filter); } catch (e) {}
      $$('#filters .chip').forEach(x => x.classList.toggle('on', x === b));
      renderGrid();
    };
  });
}

function renderGrid() {
  const tierRank = { UR: 0, SSR: 1, SR: 2, R: 3 };
  const list = FIGURES
    .filter(s => filter === 'all' || s.class === filter)
    .slice()
    .sort((a, b) => {
      if (!!a.nc !== !!b.nc) return a.nc ? 1 : -1;           // 可编队的排前面
      const t = (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9);
      if (t) return t;
      const ta = Object.values(a.stats).reduce((x, y) => x + y, 0);
      const tb = Object.values(b.stats).reduce((x, y) => x + y, 0);
      return tb - ta;
    });
  const box = $('#grid');
  box.innerHTML = '';
  list.forEach(s => {
    const c = CLASSES[s.class];
    const d = document.createElement('div');
    d.className = 'scard' + (s.nc ? ' sealed' : '');
    d.style.setProperty('--glow', hexA(c.color, 0.3));
    const total = Object.values(s.stats).reduce((a, b) => a + b, 0);
    const lit = Math.round(total / 600 * 10);
    d.innerHTML = `
      <span class="cls" style="background:${hexA(c.color, .22)};color:${c.color};border:1px solid ${hexA(c.color, .45)}">${c.en}</span>
      <span class="rank ${s.tier}">${s.tier}</span>
      <canvas width="64" height="64"></canvas>
      <div class="nm">${s.name}</div>
      <div class="ru">${s.trueName !== '—' ? s.trueName : '本名未录'}</div>
      <div class="mini">${Array.from({ length: 10 }, (_, i) => `<span class="${i < lit ? 'on' : ''}"></span>`).join('')}</div>
      ${s.nc ? '<div class="seal">SEALED</div>' : ''}
    `;
    const cvs = d.querySelector('canvas');
    drawFigure(cvs.getContext('2d'), s, 64);
    d.onclick = () => openDetail(s.id);
    box.appendChild(d);
  });
}

/* ---------------- 详情 ---------------- */
function openDetail(id) {
  const s = FIGURES.find(x => x.id === id);
  const c = CLASSES[s.class];
  const KEY = [
    ['力', s.stats.力], ['耐', s.stats.耐], ['敏', s.stats.敏],
    ['魔', s.stats.魔], ['幸', s.stats.幸], ['宝', s.stats.宝],
  ];
  $('#detailBody').innerHTML = `
    <div class="detail">
      <div class="panel">
        <div class="hero-wrap">
          <canvas id="heroC" width="120" height="120"></canvas>
          <div>
            <div class="hero-name">${s.name}</div>
            <div class="hero-sub">${s.trueName !== '—' ? s.trueName : '本名未录'}</div>
            <div class="hero-title">${s.title}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
            <span style="font-size:9.5px;font-weight:800;letter-spacing:1px;padding:3px 7px;border-radius:2px;
              background:${hexA(c.color, .2)};color:${c.color};border:1px solid ${hexA(c.color, .5)}">${c.icon} ${c.en}</span>
            <span style="font-size:9.5px;font-weight:800;letter-spacing:1px;padding:3px 7px;border-radius:2px;
              border:1px solid var(--line2);color:var(--gold2)">${s.tier}</span>
          </div>
        </div>
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
          ${KEY.map(([k, v]) => `
            <div class="statrow ${v >= 90 ? 'hi' : ''}">
              <span class="k">${k}</span>
              <span class="bar"><i style="width:${v}%"></i></span>
              <span class="v">${v}</span>
            </div>`).join('')}
        </div>
        <div style="margin-top:14px;font-size:10.5px;color:var(--ink3);line-height:1.9;font-family:ui-monospace,monospace">
          ${s.region}<br>${s.era}
        </div>
        ${s.nc ? `<div style="margin-top:14px;padding:10px;border:1px solid rgba(193,39,45,.45);border-radius:4px;
          background:rgba(193,39,45,.08);font-size:10.5px;color:#ff9aa8;letter-spacing:1.5px;text-align:center;font-weight:800">
          SEALED / 无法编入阵容</div>` : ''}
      </div>

      <div class="panel">
        <h3>人物</h3>
        <p style="font-size:12.5px;line-height:1.95;color:var(--ink2)">${s.lore}</p>
        <div class="quote">「${s.quote}」</div>

        <h3 style="margin-top:22px">固有技能</h3>
        ${s.skills.map(k => `<div class="skill"><b>${k.name}</b><span class="rk">${k.rank}</span><p>${k.desc}</p></div>`).join('')}

        <h3 style="margin-top:20px">成名作</h3>
        <div class="npbox">
          <div class="kind">${s.np.kind} · RANK ${s.np.rank}</div>
          <div class="nm">${s.np.name}</div>
          <div class="rd">${s.np.reading}</div>
          <div class="ds">${s.np.desc}</div>
          <div class="ef">▸ 效果：${s.np.effect}</div>
        </div>

        <div style="margin-top:16px;font-size:11.5px;color:var(--ink3);line-height:1.8">
          <b style="color:var(--ink2)">弱点</b>　${s.weak}
        </div>
      </div>
    </div>
  `;
  const hc = $('#heroC');
  drawFigure(hc.getContext('2d'), s, 120);
  // 详情页不写入 currentTab，返回卡池时仍回到原标签
  $$('.tab').forEach(x => x.classList.toggle('on', false));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-detail'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- 榜位之争 ---------------- */
let team = [null, null, null, null, null, null, null];
let warState = null;

function renderSlots() {
  const box = $('#slots');
  box.innerHTML = '';
  team.forEach((id, i) => {
    const d = document.createElement('div');
    if (id) {
      const s = FIGURES.find(x => x.id === id);
      const c = CLASSES[s.class];
      d.className = 'slot filled';
      d.innerHTML = `<span class="cls-tag" style="background:${hexA(c.color, .3)};color:${c.color}">${c.icon}</span>
        <span class="x" title="移出">✕</span>
        <canvas width="40" height="48"></canvas>
        <div class="lbl">${s.name}</div>`;
      const scv = d.querySelector('canvas');
      drawFigure(scv.getContext('2d'), s, 40);
      d.querySelector('.x').onclick = e => { e.stopPropagation(); team[i] = null; renderSlots(); };
      d.onclick = () => openDetail(s.id);
    } else {
      d.className = 'slot';
      d.innerHTML = `<div class="lbl">EMPTY</div><div class="lbl" style="color:var(--ink3);opacity:.5">${SLOT_ORDER[i] ? CLASSES[SLOT_ORDER[i]].en : '—'}</div>`;
      d.onclick = () => drawOne(i);
    }
    box.appendChild(d);
  });
  $('#cnt').textContent = FIGURES.length;
  if ($('#seatCnt')) $('#seatCnt').textContent = FIGURES.filter(s => !s.nc).length;
}

function drawOne(slot) {
  const pool = FIGURES.filter(s => !s.nc);
  // 优先未在队伍中的
  const avail = pool.filter(s => !team.includes(s.id));
  const chosen = pick(avail.length ? avail : pool);
  const idx = slot != null ? slot : team.indexOf(null);
  if (idx === -1) { log('阵容已满。', 'dim'); return; }
  team[idx] = chosen.id;
  renderSlots();
  log(`召集：<b>${chosen.name}</b> —— ${CLASSES[chosen.class].name} / ${chosen.title}`, 'grn');
}

/* ---------------- 战斗 ---------------- */
function log(html, cls = '') {
  const box = $('#warlog');
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.innerHTML = html;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}
function clearLog() { $('#warlog').innerHTML = ''; }

function sum(a) { return a.reduce((x, y) => x + y, 0); }

function startWar() {
  const valid = team.filter(Boolean).map(id => FIGURES.find(s => s.id === id));
  if (valid.length === 0) { clearLog(); log('至少放一位在册者。', 'red'); return; }
  clearLog();

  // 交集
  const bondBonus = {};
  BONDS.forEach(b => {
    if (team.includes(b.a) && team.includes(b.b)) {
      bondBonus[b.a] = (bondBonus[b.a] || 0) + 12;
      bondBonus[b.b] = (bondBonus[b.b] || 0) + 12;
      log(`交集成立：<b>${b.name}</b>　${b.desc}`, 'grn');
    }
  });

  const total = valid.reduce((acc, s) => {
    const b = bondBonus[s.id] || 0;
    return {
      hp: acc.hp + s.stats.耐 * (1 + b / 100),
      atk: acc.atk + (s.stats.力 + s.stats.宝) / 2 * (1 + b / 100),
      mag: acc.mag + s.stats.魔,
      luck: acc.luck + s.stats.幸,
    };
  }, { hp: 0, atk: 0, mag: 0, luck: 0 });

  // 敌方：耐久随队员数线性增长，攻击力增长更慢 —— 保证「阵容越大越占优」
  const L = valid.length;
  const enemy = {
    hp: 340 + L * 120 + rand(-40, 80),
    hpMax: 0,
    atk: 50 + L * 8,
  };
  enemy.hpMax = enemy.hp;

  warState = {
    turn: 0, myHp: total.hp, myHpMax: total.hp, myAtk: total.atk,
    myMag: total.mag, myLuck: total.luck, enemy, active: true,
    masters: [], risk: 0,
  };

  log(`<span class="dim">——— 榜位之争 · 开始 ———</span>`);
  log(`我方：${valid.map(s => s.name).join(' / ')}`);
  log(`耐久 ${Math.round(total.hp)}　攻击 ${Math.round(total.atk)}　魔力 ${Math.round(total.mag)}　幸运 ${Math.round(total.luck)}`);
  log(`敌方：<b>「舆论场」</b>　耐久 ${Math.round(enemy.hp)}`, 'red');
  log(`<span class="dim">每回合随机登场一位敌方 Master。</span>`);
  renderBars();
  step();
}

function step() {
  if (!warState || !warState.active) return;
  warState.turn++;
  const t = warState.turn;

  // Master 干预
  const m = pick(MASTERS);
  const last = warState.masters[warState.masters.length - 1];
  const mm = (last && last === m.name) ? pick(MASTERS) : m;
  warState.masters.push(mm.name);
  log(`<span class="dim">— 第 ${t} 回合 —</span>`);
  log(`敌方 Master「<b>${mm.name}</b>」介入：${mm.desc}`, 'red');

  let atkMul = 1, defMul = 1, dmgTaken = 1;
  switch (mm.name) {
    case '平台审核': atkMul = 0.55; break;
    case '对家 MCN': atkMul = 0.8; break;
    case '十年老粉': dmgTaken = 1.15; break;
    case '匿名举报者': warState.risk += 12; break;
    case '数据女工': warState.enemy.hp = Math.min(warState.enemy.hpMax, warState.enemy.hp + 40); break;
    case '甲方': atkMul = 1.1; break;
    case '品牌方公关': warState.enemy.hp = Math.min(warState.enemy.hpMax, warState.enemy.hp + 55); break;
    case '同行前辈': warState.risk = Math.max(0, warState.risk - 8); dmgTaken = 1.1; log(`<span class="dim">（他顺手牵走了你 8 点风险，并把它记在了自己账上）</span>`); break;
    case '当年的自己': atkMul = 0.82; warState.risk += 5; break;
  }

  // 我方输出
  const variance = 0.78 + Math.random() * 0.44;
  let dmg = Math.round(warState.myAtk * 0.42 * atkMul * variance);
  // 幸运决定暴击 / 哑火
  const luckT = warState.myLuck / (warState.myLuck + 120);
  if (Math.random() < 0.16 + luckT * 0.35) {
    dmg = Math.round(dmg * 1.85);
    log(`<b>成名作本名解放</b>！对「舆论场」造成 <b>${dmg}</b> 点伤害。`, 'grn');
  } else if (Math.random() < 0.14 - luckT * 0.1) {
    dmg = Math.round(dmg * 0.25);
    log(`本名念错了……只造成 <b>${dmg}</b> 点伤害。`, 'dim');
  } else {
    log(`攻击命中，造成 <b>${dmg}</b> 点伤害。`);
  }
  warState.enemy.hp -= dmg;

  if (warState.enemy.hp <= 0) {
    log(`<span class="grn">「舆论场」崩解。榜首显现。</span>`);
    log(`<b>胜利。</b>但你清楚地知道，这不是结束。`, 'grn');
    warState.active = false;
    renderBars();
    return;
  }

  // 敌方反击
  let eDmg = Math.round(warState.enemy.atk * (0.7 + Math.random() * 0.5) * dmgTaken + warState.risk * 0.35);
  warState.myHp -= eDmg;
  log(`「舆论场」反击，造成 <b>${eDmg}</b> 点伤害。`, 'red');
  if (warState.risk > 0) log(`<span class="dim">（其中 ${Math.round(warState.risk * 0.35)} 点来自你积累的风险）</span>`);

  if (warState.myHp <= 0) {
    log(`<span class="red">阵容崩解。你被自己积累的东西压垮了。</span>`);
    log(`<b>败北。</b> 第 ${t} 回合。`, 'red');
    warState.active = false;
    renderBars();
    return;
  }

  renderBars();
  if (t >= 12) {
    log(`<span class="dim">十二回合过去。榜首没有出现。战争继续。</span>`);
    warState.active = false;
    renderBars();
    return;
  }
  setTimeout(step, 430);
}

function renderBars() {
  if (!warState) { $('#bars').innerHTML = ''; return; }
  const w = warState;
  $('#bars').innerHTML = `
    <div class="bar-row">
      <div class="lb"><span>我方耐久</span><span>${Math.max(0, Math.round(w.myHp))} / ${Math.round(w.myHpMax)}</span></div>
      <div class="tr"><i style="width:${clamp(w.myHp / w.myHpMax * 100)}%;background:linear-gradient(90deg,#2dd4bf,#0d9488)"></i></div>
    </div>
    <div class="bar-row">
      <div class="lb"><span>「舆论场」</span><span>${Math.max(0, Math.round(w.enemy.hp))} / ${Math.round(w.enemy.hpMax)}</span></div>
      <div class="tr"><i style="width:${clamp(w.enemy.hp / w.enemy.hpMax * 100)}%;background:linear-gradient(90deg,#c1272d,#7f1d1d)"></i></div>
    </div>
    <div class="bar-row">
      <div class="lb"><span>积累风险</span><span>${w.risk}</span></div>
      <div class="tr"><i style="width:${clamp(w.risk)}%;background:linear-gradient(90deg,#d4b062,#c1272d)"></i></div>
    </div>
  `;
}

/* ---------------- 交集 / 生态位 ---------------- */
function renderBonds() {
  $('#bondList').innerHTML = BONDS.map(b => {
    const A = FIGURES.find(s => s.id === b.a), B = FIGURES.find(s => s.id === b.b);
    return `<div class="bond"><b>${b.name}</b>
      <div class="ab">${A ? A.name : b.a} × ${B ? B.name : b.b}</div>
      <p>${b.desc}</p></div>`;
  }).join('');
}

function renderClasses() {
  $('#classList').innerHTML = Object.entries(CLASSES).map(([k, c]) => `
    <div class="bond" style="border-left:2px solid ${c.color}">
      <b style="color:${c.color}">${c.icon} ${c.name} <span style="font-size:10px;letter-spacing:1px;opacity:.7">${c.en}</span></b>
      <p style="margin-top:5px">${c.desc}</p>
    </div>`).join('');
}

/* ---------------- 按钮 ---------------- */
$('#btnDraw').onclick = () => {
  const idx = team.indexOf(null);
  if (idx === -1) { log('阵容已满。先移出一位。', 'dim'); return; }
  drawOne(idx);
};
$('#btnRandom').onclick = () => {
  const pool = FIGURES.filter(s => !s.nc);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  team = shuffled.slice(0, 7).map(s => s.id);
  renderSlots();
};
$('#btnClear').onclick = () => { team = [null, null, null, null, null, null, null]; renderSlots(); warState = null; renderBars(); };
$('#btnFight').onclick = startWar;

/* ---------------- 启动 ---------------- */
renderFilters();
renderGrid();
renderSlots();
renderBonds();
renderClasses();
$('#cnt').textContent = FIGURES.length;
$('#masters').innerHTML = MASTERS.map(m => `<div><b>${m.name}</b>${m.desc}　<span style="color:#d4b062">${m.buff}</span></div>`).join('');
