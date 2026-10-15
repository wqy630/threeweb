/* ═══════════════════════════════════════════════════════════════════════════
   陇原非遗数字图谱 · 交互引擎
   纯原生实现：无任何第三方依赖，可离线运行
   模块：① 数据层 ② 投影与地图 ③ 统计图表 ④ 力导向谱系 ⑤ 纹样再生引擎
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {

  /* ══════════════════ 0. 常量与配色 ══════════════════ */

  const CATEGORIES = [
    '民间文学', '传统音乐', '传统舞蹈', '传统戏剧', '曲艺',
    '传统体育、游艺与杂技', '传统美术', '传统技艺', '传统医药', '民俗'
  ];

  const CAT_COLOR = {
    '民间文学': '#8a6a4a',
    '传统音乐': '#2f6b8f',
    '传统舞蹈': '#7a4a6b',
    '传统戏剧': '#b0392c',
    '曲艺': '#cf9a24',
    '传统体育、游艺与杂技': '#4b8a63',
    '传统美术': '#c26d2e',
    '传统技艺': '#3a4a7a',
    '传统医药': '#4f7a7d',
    '民俗': '#9c3a5c'
  };

  const CITIES = [
    '兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市',
    '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'
  ];

  const CITY_SHORT = {
    '兰州市': '兰州', '嘉峪关市': '嘉峪关', '金昌市': '金昌', '白银市': '白银',
    '天水市': '天水', '武威市': '武威', '张掖市': '张掖', '平凉市': '平凉',
    '酒泉市': '酒泉', '庆阳市': '庆阳', '定西市': '定西', '陇南市': '陇南',
    '临夏回族自治州': '临夏州', '甘南藏族自治州': '甘南州'
  };

  const BATCHES = [
    { name: '第一批', year: 2006 },
    { name: '第二批', year: 2008 },
    { name: '第三批', year: 2011 },
    { name: '第四批', year: 2014 },
    { name: '第五批', year: 2021 }
  ];

  /* 色阶（宣纸 / 玄色 两套） */
  const RAMPS = {
    paper: ['#e6ddc8', '#e0cf9d', '#d2ab5b', '#bd7c45', '#a8543a', '#8a2f24'],
    ink: ['#241f1a', '#3c3220', '#65522a', '#93742f', '#c19c42', '#dfba5c']
  };

  /* 纹样调色板 —— 均取自敦煌壁画矿物颜料 */
  const PALETTES = [
    { id: 'dunhuang', name: '敦煌矿物', colors: ['#b0392c', '#2f6b8f', '#cf9a24', '#4b8a63', '#7a4a6b', '#96603a'] },
    { id: 'cinnabar', name: '朱砂单色', colors: ['#a83226', '#c0483a', '#8a2620', '#d0664f', '#7a1f1a'] },
    { id: 'azurite', name: '青绿山水', colors: ['#2f6b8f', '#4b8a63', '#6fa3b8', '#8fbf9f', '#1f4a63'] },
    { id: 'ink', name: '水墨五墨', colors: ['#2b2620', '#4d463c', '#6f6759', '#968b78', '#c0b49c'] },
    { id: 'night', name: '夜金', colors: ['#d8a838', '#b8862a', '#8a5f1f', '#f0d27a', '#6b4a12'] }
  ];

  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* ══════════════════ 1. 工具函数 ══════════════════ */

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function hex2rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function mixHex(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const hue = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < .5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
    }
    return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  function shiftHue(hex, deg) {
    const [r, g, b] = hex2rgb(hex);
    const [h, s, l] = rgbToHsl(r, g, b);
    return hslToRgb(h + deg, s, l);
  }
  function invertHex(hex) {
    const [r, g, b] = hex2rgb(hex);
    return rgb2hex(255 - r, 255 - g, 255 - b);
  }
  function contrastInk(hex) {
    const [r, g, b] = hex2rgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 148 ? '#2b2620' : '#fdf7ec';
  }

  function themeMode() { return document.documentElement.getAttribute('data-theme') || 'paper'; }

  function rampColor(t) {
    const r = RAMPS[themeMode()];
    return r[clamp(Math.round(t * (r.length - 1)), 0, r.length - 1)];
  }
  function rampRgbArray() { return RAMPS[themeMode()].map(hex2rgb); }
  function rampColorFrom(t, rgbArr) {
    const x = clamp(t, 0, 1) * (rgbArr.length - 1);
    const i = Math.floor(x), f = x - i;
    const a = rgbArr[i], b = rgbArr[Math.min(i + 1, rgbArr.length - 1)];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  function isDark() { return themeMode() === 'ink'; }
  function inkColor(alpha) {
    return isDark() ? `rgba(236,227,211,${alpha})` : `rgba(34,27,20,${alpha})`;
  }
  function paperColor() { return isDark() ? '#1a1714' : '#fdfbf6'; }

  function fmt(n) { return (n === null || n === undefined) ? '—' : String(n); }

  /* ══════════════════ 2. 数据层 ══════════════════ */

  const RAW = window.ICH_DATA || { items: [], stats: {}, sources: [], notes: '' };
  const GEO = window.GEO_DATA || { bbox: [92, 32, 109, 43], features: [] };

  const ITEMS = (RAW.items || []).map((it, i) => {
    const city = CITIES.indexOf(it.city) >= 0 ? it.city : null;
    const cat = CATEGORIES.indexOf(it.category) >= 0 ? it.category : '民俗';
    const o = Object.assign({}, it);
    o.city = city;
    o.category = cat;
    o.color = CAT_COLOR[cat];
    o.i = i;
    o.search = [it.name, cat, city || it.city, (it.tags || []).join(' '), it.intro || '', it.batch || '', it.county || '']
      .join(' ').toLowerCase();
    return o;
  });

  /* 市州质心（经纬度） */
  const CITY_GEO = {};
  GEO.features.forEach(f => { CITY_GEO[f.properties.name] = f.properties; });

  /* 统计 */
  const STAT = (function () {
    const byCity = {}, byCat = {}, byBatch = {};
    CITIES.forEach(c => byCity[c] = 0);
    CATEGORIES.forEach(c => byCat[c] = 0);
    BATCHES.forEach(b => byBatch[b.name] = 0);
    ITEMS.forEach(it => {
      if (it.city) byCity[it.city]++;
      byCat[it.category]++;
      if (it.batch && byBatch[it.batch] !== undefined) byBatch[it.batch]++;
    });
    const sortedCity = CITIES.slice().sort((a, b) => byCity[b] - byCity[a]);
    const sortedCat = CATEGORIES.slice().sort((a, b) => byCat[b] - byCat[a]);
    const tags = {};
    ITEMS.forEach(it => (it.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
    return {
      byCity, byCat, byBatch, sortedCity, sortedCat, tags,
      total: ITEMS.length,
      cityCovered: CITIES.filter(c => byCity[c] > 0).length,
      catCovered: CATEGORIES.filter(c => byCat[c] > 0).length,
      maxCity: sortedCity[0],
      maxCityN: byCity[sortedCity[0]],
      topCat: sortedCat[0],
      topCatN: byCat[sortedCat[0]],
      topBatch: BATCHES.slice().sort((a, b) => byBatch[b.name] - byBatch[a.name])[0]
    };
  })();

  /* ══════════════════ 3. 全局状态 ══════════════════ */

  const state = {
    view: 'overview',
    cats: new Set(),
    batch: 'all',
    query: '',
    city: null,
    metric: 'count'
  };

  function visibleItems() {
    const q = state.query.trim().toLowerCase();
    return ITEMS.filter(it => {
      if (state.cats.size && !state.cats.has(it.category)) return false;
      if (state.batch !== 'all' && it.batch !== state.batch) return false;
      if (q && it.search.indexOf(q) < 0) return false;
      return true;
    });
  }
  function cityCounts(list) {
    const m = {};
    CITIES.forEach(c => m[c] = 0);
    list.forEach(it => { if (it.city) m[it.city]++; });
    return m;
  }

  /* ══════════════════ 4. 投影（经纬度 → 平面） ══════════════════ */

  function makeProjection(width, height, pad) {
    const bb = GEO.bbox;
    const latMid = (bb[1] + bb[3]) / 2;
    const kx = Math.cos(latMid * Math.PI / 180);
    const px = (lon) => lon * kx, py = (lat) => -lat;
    const x0 = px(bb[0]), x1 = px(bb[2]), y0 = py(bb[3]), y1 = py(bb[1]);
    const s = Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0));
    const ox = (width - (x1 - x0) * s) / 2, oy = (height - (y1 - y0) * s) / 2;
    const project = (lon, lat) => [ox + (px(lon) - x0) * s, oy + (py(lat) - y0) * s];
    project.scale = s;
    return project;
  }

  const MAP_W = 1000, MAP_H = 720;
  const proj = makeProjection(MAP_W, MAP_H, 26);

  /* 项目点位：按市州质心 + 确定性抖动（示意分布） */
  const itemPos = {};
  const cityClusterR = {};   /* 每个市州点云的散射半径，用于把标签顶到点云之上 */
  (function layoutPoints() {
    const groups = {};
    ITEMS.forEach(it => {
      const key = it.city || '__none__';
      (groups[key] = groups[key] || []).push(it);
    });
    Object.keys(groups).forEach(key => {
      const list = groups[key];
      const g = CITY_GEO[key];
      if (!g) return;
      const base = proj(g.center[0], g.center[1]);
      let maxR = 0;
      list.forEach((it, idx) => {
        const rng = mulberry32(hashStr(it.id || it.name));
        const golden = 2.399963;
        const idx2 = idx + 1;
        const r = 8.5 * Math.sqrt(idx2) * (1 + rng() * 0.28);
        const a = idx2 * golden + rng() * 0.5;
        const jx = Math.cos(a) * r, jy = Math.sin(a) * r * 0.72;
        itemPos[it.id || it.name] = { x: base[0] + jx, y: base[1] + jy, r: rng };
        maxR = Math.max(maxR, r);
      });
      cityClusterR[key] = maxR;
    });
  })();

  /* ══════════════════ 5. 主题 ══════════════════ */

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('ly-theme', mode); } catch (e) { }
    renderOverview();
    renderMap();
    renderChips();
    if (state.city) renderSide(state.city); else renderSideSearch();
    Graph.recolor();
    Motif.rerender();
    Hero.restart();
  }

  /* ══════════════════ 6. 总览视图 ══════════════════ */

  function renderStatRow() {
    const host = $('#stat-row');
    clear(host);
    const cards = [
      { n: STAT.total, u: '项', l: '本图谱收录国家级非遗项目', s: 'NATIONAL ICH ITEMS' },
      { n: STAT.cityCovered, u: '/14', l: '覆盖市州（含全部省辖市州）', s: 'CITIES COVERED' },
      { n: STAT.catCovered, u: '/10', l: '覆盖门类（国务院十大门类）', s: 'CATEGORIES' },
      { n: BATCHES.length, u: '批', l: '名录批次（2006—2021）', s: 'BATCHES 2006-2021' },
      { n: (RAW.stats && RAW.stats.humanity_list ? RAW.stats.humanity_list.length : 0), u: '项', l: '入选联合国教科文组织名录', s: 'UNESCO LISTED' }
    ];
    cards.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'stat';
      d.innerHTML = `<div class="num">${c.n}<small>${c.u}</small></div>
        <div class="lab">${c.l}</div><div class="sub">${c.s}</div>`;
      host.appendChild(d);
      d.style.opacity = '0'; d.style.transform = 'translateY(10px)';
      setTimeout(() => { d.style.transition = 'all .5s cubic-bezier(.2,.7,.3,1)'; d.style.opacity = '1'; d.style.transform = 'none'; }, 60 * i);
    });
    $('#meta-count').textContent = STAT.total;
    $('#meta-cutoff').textContent = (RAW.stats && RAW.stats.cutoff) || (RAW.notes ? '以官方最新公布为准' : '—');
  }

  function renderDonut() {
    const svg = $('#chart-category');
    clear(svg);
    const W = 460, H = 340, cx = 168, cy = 170, R = 118, r0 = 74;
    const total = STAT.total || 1;
    const g = el('g', { transform: `translate(0,0)` }, svg);
    let a0 = -Math.PI / 2;
    const ordered = STAT.sortedCat.filter(c => STAT.byCat[c] > 0);
    ordered.forEach(cat => {
      const v = STAT.byCat[cat];
      const a1 = a0 + (v / total) * Math.PI * 2;
      const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
      const d = `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}` +
        `L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
      const path = el('path', { d, fill: CAT_COLOR[cat], class: 'arc', 'data-cat': cat }, g);
      path.style.opacity = state.cats.size && !state.cats.has(cat) ? 0.24 : 1;
      path.addEventListener('click', () => toggleCat(cat));
      const mid = (a0 + a1) / 2, [mx, my] = p((R + r0) / 2, mid);
      if ((a1 - a0) > 0.22) {
        el('text', {
          x: mx.toFixed(1), y: (my + 4).toFixed(1), 'text-anchor': 'middle',
          'font-family': 'var(--font-mono)', 'font-size': 11, fill: contrastInk(CAT_COLOR[cat]),
          'pointer-events': 'none', 'font-weight': 600
        }, g).textContent = v;
      }
      a0 = a1;
    });
    const cg = el('g', { class: 'donut-center', 'pointer-events': 'none' }, svg);
    el('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', class: 'dc-n' }, cg).textContent = STAT.total;
    el('text', { x: cx, y: cy + 24, 'text-anchor': 'middle', class: 'dc-l' }, cg).textContent = state.cats.size ? '已筛选项目' : '收录项目总数';

    /* 图例 */
    const lg = $('#legend-category');
    clear(lg);
    ordered.forEach(cat => {
      const li = document.createElement('li');
      li.className = state.cats.has(cat) ? 'is-on' : '';
      if (state.cats.size && !state.cats.has(cat)) li.className = 'is-off';
      li.innerHTML = `<i class="sw" style="background:${CAT_COLOR[cat]}"></i>
        <span>${cat}</span><span class="n">${STAT.byCat[cat]}</span>`;
      li.addEventListener('click', () => toggleCat(cat));
      lg.appendChild(li);
    });
  }

  function renderCityBars() {
    const svg = $('#chart-city');
    clear(svg);
    const list = visibleItems();
    const counts = cityCounts(list);
    const data = CITIES.slice().sort((a, b) => counts[b] - counts[a]);
    const max = Math.max(1, ...data.map(c => counts[c]));
    const W = 520, H = 400, padL = 72, padR = 46, padT = 14, rowH = (H - padT - 16) / data.length;
    const barMax = W - padL - padR;
    const g = el('g', {}, svg);

    [0, 0.5, 1].forEach(t => {
      const x = padL + barMax * t;
      el('line', { x1: x, y1: padT, x2: x, y2: H - 16, class: 'gridline' }, g);
      el('text', { x, y: H - 4, 'text-anchor': 'middle', class: 'axis' }, g).textContent = Math.round(max * t);
    });

    data.forEach((city, i) => {
      const y = padT + i * rowH;
      const w = Math.max(1, barMax * counts[city] / max);
      const t = counts[city] / max;
      const row = el('g', { class: 'bar', style: 'cursor:pointer' }, g);
      el('text', {
        x: padL - 10, y: y + rowH * 0.62, 'text-anchor': 'end',
        'font-family': 'var(--font-display)', 'font-size': 12.5, fill: 'var(--ink-2)'
      }, row).textContent = CITY_SHORT[city] || city;
      el('rect', {
        x: padL, y: y + 1, width: barMax, height: rowH - 7, fill: inkColor(.045), rx: 1
      }, row);
      el('rect', {
        x: padL, y: y + 1, width: w, height: rowH - 7, fill: rampColor(t), rx: 1
      }, row);
      el('text', {
        x: padL + w + 8, y: y + rowH * 0.62, 'font-family': 'var(--font-mono)',
        'font-size': 11, fill: 'var(--ink-3)'
      }, row).textContent = counts[city];
      row.addEventListener('click', () => {
        state.city = city; switchView('map'); renderMap(); renderSide(city);
      });
    });
  }

  function renderBatchChart() {
    const svg = $('#chart-batch');
    clear(svg);
    const list = visibleItems();
    const byBatch = {};
    BATCHES.forEach(b => byBatch[b.name] = []);
    list.forEach(it => { if (byBatch[it.batch]) byBatch[it.batch].push(it); });
    const W = 520, H = 300, padL = 46, padB = 46, padT = 22, padR = 14;
    const max = Math.max(1, ...BATCHES.map(b => byBatch[b.name].length));
    const colW = (W - padL - padR) / BATCHES.length;
    const barW = Math.min(56, colW * 0.52);
    const plotH = H - padB - padT;
    const g = el('g', {}, svg);

    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH * i / 4;
      el('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'gridline' }, g);
      el('text', { x: padL - 8, y: y + 3.5, 'text-anchor': 'end', class: 'axis' }, g)
        .textContent = Math.round(max * (1 - i / 4));
    }

    let prev = 0;
    BATCHES.forEach((b, bi) => {
      const cx = padL + colW * bi + colW / 2;
      const arr = byBatch[b.name];
      const byCat = {};
      arr.forEach(it => byCat[it.category] = (byCat[it.category] || 0) + 1);
      let acc = 0;
      STAT.sortedCat.forEach(cat => {
        const v = byCat[cat] || 0; if (!v) return;
        const h = plotH * v / max;
        const y = padT + plotH - plotH * (acc + v) / max;
        const r = el('rect', {
          x: cx - barW / 2, y, width: barW, height: Math.max(0.8, h),
          fill: CAT_COLOR[cat], opacity: (state.cats.size && !state.cats.has(cat)) ? .22 : .93
        }, g);
        r.addEventListener('click', () => { state.batch = state.batch === b.name ? 'all' : b.name; syncBatchSelect(); renderAll(); });
        el('title', {}, r).textContent = `${b.name} · ${cat} · ${v} 项`;
        acc += v;
      });
      const totalH = plotH * arr.length / max;
      el('text', {
        x: cx, y: padT + plotH - totalH - 7, 'text-anchor': 'middle',
        'font-family': 'var(--font-mono)', 'font-size': 12, 'font-weight': 700, fill: 'var(--ink)'
      }, g).textContent = arr.length;
      const lab = el('text', {
        x: cx, y: H - 24, 'text-anchor': 'middle', 'font-family': 'var(--font-display)',
        'font-size': 12.5, fill: state.batch === b.name ? 'var(--accent)' : 'var(--ink-2)', style: 'cursor:pointer'
      }, g);
      lab.textContent = b.name;
      el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, g).textContent = b.year + '年';
      lab.addEventListener('click', () => { state.batch = state.batch === b.name ? 'all' : b.name; syncBatchSelect(); renderAll(); });
      prev += arr.length;
    });
  }

  function renderFacts() {
    const host = $('#facts-list');
    clear(host);
    const S = RAW.stats || {};
    const tags = Object.keys(STAT.tags).sort((a, b) => STAT.tags[b] - STAT.tags[a]).slice(0, 1);
    const rows = [
      ['官方公布口径', (S.national_total ? `国家级 ${S.national_total} 项` : '—') +
        (S.provincial_total ? ` · 省级 ${S.provincial_total} 项` : '')],
      ['国家级代表性传承人', S.inheritor_national ? S.inheritor_national + ' 名' : '—'],
      ['联合国教科文名录', (S.humanity_list && S.humanity_list.length) ? S.humanity_list.join('、') : '—'],
      ['本图谱收录条目', STAT.total + ' 条（含扩展项目，按甘肃申报地区计）'],
      ['项目最多的市州', `${CITY_SHORT[STAT.maxCity] || STAT.maxCity} · ${STAT.maxCityN} 项`],
      ['项目最多的门类', `${STAT.topCat} · ${STAT.topCatN} 项`],
      ['项目最多的批次', `${STAT.topBatch.name} · ${STAT.byBatch[STAT.topBatch.name]} 项`],
      ['平均每市州项目数', (STAT.total / 14).toFixed(1) + ' 项'],
      ['最高频标签', tags.length ? `${tags[0]}（${STAT.tags[tags[0]]} 项）` : '—'],
      ['当前筛选结果', visibleItems().length + ' 项']
    ];
    rows.forEach(([k, v]) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
      host.appendChild(li);
    });
  }

  function renderSources() {
    const host = $('#source-list');
    clear(host);
    (RAW.sources || []).forEach(s => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>
        ${s.note ? `<span class="src-note">${s.note}</span>` : ''}`;
      host.appendChild(li);
    });
    $('#data-notes').textContent = RAW.notes || '';
  }

  function renderOverview() {
    renderStatRow();
    renderDonut();
    renderCityBars();
    renderBatchChart();
    renderFacts();
  }

  /* ══════════════════ 7. 地图视图 ══════════════════ */

  function renderChips() {
    const host = $('#chips-category');
    clear(host);
    const all = document.createElement('button');
    all.className = 'chip' + (state.cats.size === 0 ? ' is-on' : '');
    all.innerHTML = `全部门类 <span class="n">${STAT.total}</span>`;
    all.addEventListener('click', () => { state.cats.clear(); renderAll(); });
    host.appendChild(all);

    STAT.sortedCat.forEach(cat => {
      if (!STAT.byCat[cat]) return;
      const b = document.createElement('button');
      b.className = 'chip' + (state.cats.has(cat) ? ' is-on' : '');
      b.innerHTML = `<i class="sw" style="background:${CAT_COLOR[cat]}"></i>${cat}<span class="n">${STAT.byCat[cat]}</span>`;
      b.addEventListener('click', () => toggleCat(cat));
      host.appendChild(b);
    });
  }

  function toggleCat(cat) {
    if (state.cats.has(cat)) state.cats.delete(cat); else state.cats.add(cat);
    renderAll();
  }

  function renderMap() {
    const svg = $('#map');
    clear(svg);
    svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
    const list = visibleItems();
    const counts = cityCounts(list);
    /* 门类丰富度：该市州在筛选结果中出现的不同门类数 */
    const richness = {};
    CITIES.forEach(c => richness[c] = 0);
    const seen = {};
    list.forEach(it => {
      if (!it.city) return;
      const k = it.city + '|' + it.category;
      if (!seen[k]) { seen[k] = 1; richness[it.city]++; }
    });
    const metricVal = (c) => state.metric === 'richness' ? richness[c] : counts[c];
    const max = Math.max(1, ...CITIES.map(metricVal));
    const visibleIds = {};
    list.forEach(it => visibleIds[it.id || it.name] = true);

    const gShapes = el('g', {}, svg);
    const gPts = el('g', {}, svg);
    const gLabels = el('g', {}, svg);

    GEO.features.forEach(f => {
      const name = f.properties.name;
      let d = '';
      f.geometry.coordinates.forEach(poly => {
        poly.forEach(ring => {
          ring.forEach((pt, i) => {
            const [x, y] = proj(pt[0], pt[1]);
            d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
          });
          d += 'Z';
        });
      });
      const t = metricVal(name) / max;
      const fill = counts[name] === 0 ? 'var(--map-empty)' : rampColor(t);
      const p = el('path', { d, fill, class: 'city-shape' + (counts[name] === 0 ? ' is-dim' : ''), 'data-city': name }, gShapes);
      p.addEventListener('mouseenter', (e) => showTip(e, `<b>${name}</b>共 ${counts[name]} 项 · ${Object.keys(groupByCat(list.filter(i => i.city === name))).length} 个门类<span>点击查看地区详情</span>`));
      p.addEventListener('mousemove', (e) => moveTip(e));
      p.addEventListener('mouseleave', hideTip);
      p.addEventListener('click', () => { state.city = name; renderMap(); renderSide(name); });
    });

    /* 点位 */
    /* 点位 */
    list.forEach(it => {
      const pos = itemPos[it.id || it.name];
      if (!pos) return;
      const g = el('g', { class: 'pt', 'data-id': it.id || it.name }, gPts);
      el('circle', { cx: pos.x.toFixed(1), cy: pos.y.toFixed(1), r: 4.4, fill: it.color, stroke: paperColor(), 'stroke-width': 1.1 }, g);
      g.addEventListener('mouseenter', (e) => showTip(e, `<b>${it.name}</b>${it.category} · ${it.batch || ''}<span>${(it.city ? CITY_SHORT[it.city] : '')}${it.county ? ' · ' + it.county : ''}</span>`));
      g.addEventListener('mousemove', (e) => moveTip(e));
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(it); });
    });

    /* 标签：顶到点云上方，避免与项目点位互相遮挡 */
    GEO.features.forEach(f => {
      const name = f.properties.name;
      const c = f.properties.centroid || f.properties.center;
      const [x, y] = proj(c[0], c[1]);
      const r = (counts[name] > 0 ? (cityClusterR[name] || 0) : 0);
      const ly = y - r * 0.72 - 9;
      el('text', { x: x.toFixed(1), y: ly.toFixed(1), class: 'city-label' }, gLabels).textContent = CITY_SHORT[name] || name;
      el('text', { x: x.toFixed(1), y: (ly + 12).toFixed(1), class: 'city-count' }, gLabels)
        .textContent = metricVal(name) + (state.metric === 'richness' ? ' 类' : ' 项');
    });

    /* 图例 */
    const lg = $('#map-legend');
    clear(lg);
    const r = RAMPS[themeMode()];
    lg.innerHTML = `<span>0</span><span class="ramp">${r.map(c => `<i style="background:${c}"></i>`).join('')}</span>` +
      `<span>${max} ${state.metric === 'richness' ? '个门类' : '项'}</span>` +
      `<span class="lg-note">色阶编码${state.metric === 'richness' ? '门类丰富度' : '项目数量'}，与辖区面积无关</span>`;
    $('#map-badge').textContent =
      `${state.cats.size ? [...state.cats].join('/') : '全部门类'} · ${state.batch === 'all' ? '全部批次' : state.batch} · ${list.length} 项`;
  }

  function groupByCat(list) {
    const m = {};
    list.forEach(it => m[it.category] = (m[it.category] || 0) + 1);
    return m;
  }

  function showTip(e, html) {
    const tip = $('#map-tip');
    tip.innerHTML = html;
    tip.hidden = false;
    moveTip(e);
  }
  function moveTip(e) {
    const tip = $('#map-tip');
    if (tip.hidden) return;
    const host = $('.map-wrap').getBoundingClientRect();
    let x = e.clientX - host.left, y = e.clientY - host.top;
    x = clamp(x, 140, host.width - 140);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { $('#map-tip').hidden = true; }

  function renderSide(city) {
    const list = visibleItems().filter(it => it.city === city);
    const allCity = ITEMS.filter(it => it.city === city);
    const host = $('#side-body');
    $('#side-empty').hidden = true;
    host.hidden = false;

    const byCat = groupByCat(allCity);
    const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    const batches = {};
    allCity.forEach(it => batches[it.batch] = (batches[it.batch] || 0) + 1);
    const firstBatch = BATCHES.filter(b => batches[b.name])[0];

    let html = `<div class="side-title"><h3>${city}</h3>
      <span class="rank">全省第 ${STAT.sortedCity.indexOf(city) + 1} 位</span></div>
      <div class="mini-stats">
        <div><div class="n">${allCity.length}</div><div class="l">收录项目</div></div>
        <div><div class="n">${cats.length}</div><div class="l">涉及门类</div></div>
        <div><div class="n">${firstBatch ? firstBatch.year : '—'}</div><div class="l">最早入选</div></div>
      </div>`;

    html += `<div class="side-sub">门类构成</div>`;
    const maxc = Math.max(1, ...cats.map(c => byCat[c]));
    cats.forEach(c => {
      html += `<div class="bar-line">
        <div class="bl"><span>${c}</span><span class="n">${byCat[c]} 项</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(byCat[c] / maxc * 100).toFixed(1)}%;background:${CAT_COLOR[c]}"></div></div>
      </div>`;
    });

    html += `<div class="side-sub">项目清单（${list.length}${list.length !== allCity.length ? ' / ' + allCity.length : ''}）</div>`;
    if (!list.length) html += `<p class="ctrl-desc">当前筛选条件下该地区无匹配项目。</p>`;
    list.forEach(it => {
      html += `<div class="item-card" data-id="${it.id || it.name}">
        <i class="ic-dot" style="background:${it.color}"></i>
        <div class="ic-name">${it.name}</div>
        <div class="ic-meta">${it.category} · ${it.batch || '—'}${it.code ? ' · ' + it.code : ''}</div>
        ${(it.tags || []).slice(0, 2).map(t => `<span class="ic-tag">${t}</span>`).join('')}
      </div>`;
    });
    host.innerHTML = html;
    $$('.item-card', host).forEach(card => {
      card.addEventListener('click', () => {
        const it = ITEMS.find(x => (x.id || x.name) === card.dataset.id);
        if (it) openDrawer(it);
      });
    });
  }

  function renderSideSearch() {
    const host = $('#side-body');
    const q = state.query.trim();
    const list = visibleItems();
    if (!q && !state.cats.size && state.batch === 'all') {
      host.hidden = true; $('#side-empty').hidden = false;
      return;
    }
    $('#side-empty').hidden = true; host.hidden = false;
    let html = `<div class="side-title"><h3>${q ? '搜索结果' : '筛选结果'}</h3>
      <span class="rank">${list.length} 项</span></div>`;
    if (q) html = `<div class="side-title"><h3>“${q}”</h3><span class="rank">${list.length} 项</span></div>`;
    if (!list.length) html += `<p class="ctrl-desc">没有匹配的项目，试试「花儿」「皮影」「技艺」「庆阳」等关键词。</p>`;
    list.slice(0, 80).forEach(it => {
      html += `<div class="item-card" data-id="${it.id || it.name}">
        <i class="ic-dot" style="background:${it.color}"></i>
        <div class="ic-name">${it.name}</div>
        <div class="ic-meta">${it.category} · ${it.city ? CITY_SHORT[it.city] : '—'} · ${it.batch || '—'}</div>
      </div>`;
    });
    host.innerHTML = html;
    $$('.item-card', host).forEach(card => {
      card.addEventListener('click', () => {
        const it = ITEMS.find(x => (x.id || x.name) === card.dataset.id);
        if (it) openDrawer(it);
      });
    });
  }

  /* ══════════════════ 8. 详情抽屉 ══════════════════ */

  function openDrawer(it) {
    const d = $('#drawer'), body = $('#drawer-body');
    const sameCategory = ITEMS.filter(x => x.category === it.category && (x.id || x.name) !== (it.id || it.name)).slice(0, 5);
    const sameCity = ITEMS.filter(x => x.city && x.city === it.city && (x.id || x.name) !== (it.id || it.name)).slice(0, 5);
    const pos = itemPos[it.id || it.name];
    body.innerHTML = `
      <span class="dr-cat" style="color:${it.color};border-color:${it.color}33;background:${it.color}1a">${it.category}</span>
      <h2 class="dr-name">${it.name}</h2>
      <div class="dr-en">${it.code ? it.code + ' · ' : ''}${it.batch || ''}${it.year ? ' · ' + it.year : ''}</div>
      <div class="dr-rows">
        <div><span class="k">申报地区</span><span class="v">${it.city || it.region || '—'}${it.county ? ' · ' + it.county : ''}</span></div>
        <div><span class="k">名录批次</span><span class="v">${it.batch || '—'}${it.year ? '（' + it.year + ' 年公布）' : ''}</span></div>
        <div><span class="k">项目编号</span><span class="v">${it.code || '—'}</span></div>
        <div><span class="k">所属门类</span><span class="v">${it.category}</span></div>
      </div>
      <p class="dr-intro">${it.intro || '暂无简介。'}</p>
      ${(it.tags && it.tags.length) ? `<div class="dr-tags">${it.tags.map(t => `<span># ${t}</span>`).join('')}</div>` : ''}
      ${sameCity.length ? `<div class="dr-rel"><h4>同地区项目</h4>
        ${sameCity.map(x => `<div class="rel-item" data-id="${x.id || x.name}"><i style="background:${x.color}"></i>${x.name}</div>`).join('')}
      </div>` : ''}
      ${sameCategory.length ? `<div class="dr-rel"><h4>同门类项目</h4>
        ${sameCategory.map(x => `<div class="rel-item" data-id="${x.id || x.name}"><i style="background:${x.color}"></i>${x.name}</div>`).join('')}
      </div>` : ''}
      ${pos ? `<div class="dr-loc">图谱坐标 ${pos.x.toFixed(0)}, ${pos.y.toFixed(0)} · 点位为申报地区示意图</div>` : ''}
    `;
    d.hidden = false;
    $$('.rel-item', body).forEach(r => r.addEventListener('click', () => {
      const x = ITEMS.find(y => (y.id || y.name) === r.dataset.id);
      if (x) openDrawer(x);
    }));
  }

  /* ══════════════════ 9. 力导向关系谱系 ══════════════════ */

  const Graph = (function () {
    const canvas = $('#graph');
    const ctx = canvas.getContext('2d');
    let W = 1400, H = 820, dpr = 1;
    let nodes = [], links = [], adj = {};
    let running = true, alpha = 0, hover = null, dragNode = null, panning = false;
    let view = { x: 0, y: 0, k: 1 };
    let last = performance.now();

    function build() {
      nodes = []; links = []; adj = {};
      const mode = $('#graph-mode').value;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H);
      const add = (n) => { n.vx = 0; n.vy = 0; nodes.push(n); adj[n.id] = []; return n; };
      const link = (a, b, kind) => { links.push({ a, b, kind }); adj[a.id].push(b.id); adj[b.id].push(a.id); };

      const catNodes = {}, cityNodes = {}, tagNodes = {};
      const catList = CATEGORIES.filter(c => STAT.byCat[c]);
      const cityList = CITIES.filter(c => STAT.byCity[c]);

      /* 结构化初始位置：门类排内环、市州排外环、标签排中环、项目围绕所属门类 */
      if (mode === 'all' || mode === 'category') {
        catList.forEach((c, i) => {
          const a = -Math.PI / 2 + i * Math.PI * 2 / catList.length;
          catNodes[c] = add({
            id: 'c:' + c, type: 'cat', label: c, r: 17, color: CAT_COLOR[c],
            x: cx + Math.cos(a) * R * 0.30, y: cy + Math.sin(a) * R * 0.30
          });
        });
      }
      if (mode === 'all' || mode === 'city') {
        cityList.forEach((c, i) => {
          const a = -Math.PI / 2 + i * Math.PI * 2 / cityList.length + 0.35;
          cityNodes[c] = add({
            id: 'p:' + c, type: 'city', label: CITY_SHORT[c] || c,
            r: 12 + STAT.byCity[c] * 0.5, color: null,
            x: cx + Math.cos(a) * R * 0.46, y: cy + Math.sin(a) * R * 0.46
          });
        });
      }
      if (mode === 'all' || mode === 'tag') {
        Object.keys(STAT.tags).filter(t => STAT.tags[t] >= 2).slice(0, 24).forEach((t, i, arr) => {
          const a = -Math.PI / 2 + i * Math.PI * 2 / arr.length + 0.9;
          tagNodes[t] = add({
            id: 't:' + t, type: 'tag', label: t, r: 7, color: null,
            x: cx + Math.cos(a) * R * 0.38, y: cy + Math.sin(a) * R * 0.38
          });
        });
      }
      ITEMS.forEach((it, i) => {
        const anchor = catNodes[it.category] || { x: cx, y: cy };
        const a = i * 2.399963, rr = 18 + Math.sqrt(i) * 9;
        const n = add({
          id: 'i:' + (it.id || it.name), type: 'item', label: it.name, r: 5.4,
          color: it.color, item: it,
          x: anchor.x + Math.cos(a) * rr, y: anchor.y + Math.sin(a) * rr
        });
        if (catNodes[it.category]) link(n, catNodes[it.category], 'cat');
        if (it.city && cityNodes[it.city]) link(n, cityNodes[it.city], 'city');
        (it.tags || []).forEach(t => { if (tagNodes[t]) link(n, tagNodes[t], 'tag'); });
      });

      /* 预演算：让首帧即是收敛后的稳定布局 */
      for (let i = 0; i < 420; i++) step(16, 1);
      nodes.forEach(n => { n.x = clamp(n.x, 40, W - 40); n.y = clamp(n.y, 40, H - 40); });
      alpha = 0.16;
      updateHud();
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      /* 视图隐藏时 rect 为 0：回退到画布默认比例，待显示后 onShow 会重排 */
      W = Math.max(680, Math.round(rect.width) || 1400);
      H = Math.max(420, Math.round(rect.height) || Math.round(W * 820 / 1400));
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function step(dt, k) {
      const n = nodes.length; if (!n) return;
      const cx = W / 2, cy = H / 2;
      const kk = k === undefined ? 1 : k;
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { d2 = 1; dx = Math.random() - .5; dy = Math.random() - .5; }
          if (d2 > 202500) continue;              // 450px 之外不再两两计算
          const d = Math.sqrt(d2);
          const f = (3200 * (1 + (a.r + b.r) / 26)) / d2;
          const fx = dx / d * f, fy = dy / d * f;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }
      links.forEach(l => {
        const a = l.a, b = l.b;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const base = l.kind === 'cat' ? 118 : (l.kind === 'city' ? 132 : 82);
        const f = (d - base) * 0.022;
        const fx = dx / d * f, fy = dy / d * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });
      nodes.forEach(nd => {
        nd.vx += (cx - nd.x) * 0.0055;
        nd.vy += (cy - nd.y) * 0.0055;
        if (nd === dragNode) { nd.vx = nd.vy = 0; return; }
        nd.vx *= 0.84; nd.vy *= 0.84;
        const cap = 24;
        nd.x += clamp(nd.vx, -cap, cap) * dt * 0.06 * kk;
        nd.y += clamp(nd.vy, -cap, cap) * dt * 0.06 * kk;
        nd.x = clamp(nd.x, 26, W - 26); nd.y = clamp(nd.y, 26, H - 26);
      });
    }

    function drawLabel(text, x, y, size, color, weight) {
      ctx.font = `${weight || 400} ${size}px "Songti SC","Source Han Serif SC","SimSun",serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = isDark() ? 'rgba(20,17,14,.92)' : 'rgba(253,251,246,.94)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);

      const hi = hover ? new Set([hover.id].concat(adj[hover.id] || [])) : null;

      links.forEach(l => {
        const on = hi && hi.has(l.a.id) && hi.has(l.b.id);
        ctx.strokeStyle = on ? (l.a.color || l.b.color || '#b0392c') : inkColor(1);
        ctx.globalAlpha = on ? .8 : (hi ? .07 : .16);
        ctx.lineWidth = on ? 1.7 : .8;
        ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      ctx.lineJoin = 'round';
      nodes.forEach(nd => {
        const dim = hi && !hi.has(nd.id);
        ctx.globalAlpha = dim ? .16 : 1;
        if (nd.type === 'cat') {
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, 6.2832);
          ctx.fillStyle = nd.color; ctx.fill();
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r * .42, 0, 6.2832);
          ctx.fillStyle = paperColor(); ctx.fill();
        } else if (nd.type === 'city') {
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, 6.2832);
          ctx.fillStyle = paperColor(); ctx.fill();
          ctx.strokeStyle = isDark() ? '#d8a838' : '#8a2f24';
          ctx.lineWidth = 2; ctx.stroke();
        } else if (nd.type === 'tag') {
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, 6.2832);
          ctx.fillStyle = inkColor(.42); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, 6.2832);
          ctx.fillStyle = nd.color; ctx.fill();
          ctx.strokeStyle = paperColor(); ctx.lineWidth = 1.1; ctx.stroke();
        }
        if (nd.type !== 'item' && (!hi || hi.has(nd.id))) {
          const isCat = nd.type === 'cat';
          drawLabel(nd.label, nd.x, nd.y - nd.r - (isCat ? 8 : 6),
            isCat ? 13 : 11.5, isCat ? inkColor(.9) : (isDark() ? '#e6d9b8' : '#5c4b3a'), isCat ? 600 : 400);
        }
        if (hover === nd) {
          ctx.strokeStyle = inkColor(.9); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r + 5, 0, 6.2832); ctx.stroke();
          if (nd.type === 'item') {
            drawLabel(nd.label, nd.x, nd.y - nd.r - 9, 12.5, inkColor(.95), 600);
          }
        }
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }

    function loop() {
      const now = performance.now();
      const dt = Math.min(48, now - last); last = now;
      if (running && alpha > 0.002) { step(dt, 1); alpha *= 0.988; }
      draw();
      requestAnimationFrame(loop);
    }

    function pick(mx, my) {
      const x = (mx - view.x) / view.k, y = (my - view.y) / view.k;
      let best = null, bestD = 1e9;
      nodes.forEach(nd => {
        const d = (nd.x - x) ** 2 + (nd.y - y) ** 2;
        if (d < (nd.r + 7) ** 2 && d < bestD) { bestD = d; best = nd; }
      });
      return best;
    }

    function updateHud() {
      const items = nodes.filter(n => n.type === 'item').length;
      $('#graph-hud').textContent = `节点 ${nodes.length} · 关系 ${links.length} · 项目节点 ${items}`;
    }

    function initEvents() {
      canvas.addEventListener('mousemove', e => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        if (dragNode) {
          dragNode.x = (mx - view.x) / view.k; dragNode.y = (my - view.y) / view.k;
          dragNode.vx = dragNode.vy = 0; alpha = Math.max(alpha, .22);
          return;
        }
        if (panning) {
          view.x += e.movementX; view.y += e.movementY; return;
        }
        const nd = pick(mx, my);
        if (nd !== hover) {
          hover = nd;
          canvas.style.cursor = nd ? (nd.item ? 'pointer' : 'default') : 'grab';
        }
      });
      canvas.addEventListener('mouseleave', () => { hover = null; });
      canvas.addEventListener('mousedown', e => {
        const r = canvas.getBoundingClientRect();
        const nd = pick(e.clientX - r.left, e.clientY - r.top);
        if (nd) { dragNode = nd; alpha = Math.max(alpha, .3); }
        else panning = true;
      });
      window.addEventListener('mouseup', () => { dragNode = null; panning = false; });
      canvas.addEventListener('click', e => {
        const r = canvas.getBoundingClientRect();
        const nd = pick(e.clientX - r.left, e.clientY - r.top);
        if (nd && nd.item) openDrawer(nd.item);
      });
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        view.k = clamp(view.k * f, .35, 3.2);
      }, { passive: false });
      $('#graph-mode').addEventListener('change', () => { build(); alpha = 1; });
      $('#graph-reset').addEventListener('click', () => { view = { x: 0, y: 0, k: 1 }; build(); });
      $('#graph-pause').addEventListener('click', e => {
        running = !running;
        e.target.textContent = running ? '暂停演算' : '继续演算';
        e.target.classList.toggle('is-active', !running);
      });
      window.addEventListener('resize', () => { resize(); });
    }

    function legend() {
      const host = $('#graph-legend');
      host.innerHTML = `<span><i style="background:${isDark() ? '#d8a838' : '#8a2f24'}"></i>市州（圆环）</span>
        <span><i style="background:#b0392c"></i>门类（实心大点）</span>
        <span><i style="background:${inkColor(.4)}"></i>标签</span>
        <span><i style="background:${CAT_COLOR['传统音乐']}"></i>项目（小点，色=门类）</span>
        <span>滚轮缩放 · 拖拽平移 · 点击项目查看详情</span>`;
    }

    return {
      start() { resize(); build(); legend(); initEvents(); requestAnimationFrame(loop); },
      rebuild() { resize(); build(); },
      recolor() { legend(); build(); },
      onShow() {
        const prev = W + 'x' + H;
        resize();
        /* 从隐藏状态切回时画布尺寸会变化，需要按真实尺寸重新推演布局 */
        if (!nodes.length || prev !== W + 'x' + H) build();
        else alpha = Math.max(alpha, .1);
      }
    };
  })();

  /* ══════════════════ 10. 纹样再生引擎 ══════════════════ */

  const MOTIFS = [
    {
      id: 'spiral', name: '马家窑旋纹',
      about: '取材于马家窑文化彩陶的旋涡纹与网格纹。以黄金角递进的等距螺线为骨架，叠合同心弧带，再现彩陶以「旋」为核心的宇宙观与秩序感。'
    },
    {
      id: 'rosette', name: '庆阳剪纸团花',
      about: '取材于庆阳剪纸团花的折剪结构。以 N 重旋转对称为骨，用外轮廓与内部镂空两级切割形成「剪」与「留」的互文关系。'
    },
    {
      id: 'sachet', name: '庆阳香包',
      about: '取材于庆阳香包的造型与针法。以中线对称为骨架，缠绕「锁边针」的锯齿节奏，串联束口与流苏结构。'
    },
    {
      id: 'shadow', name: '环县道情皮影',
      about: '取材于环县道情皮影的镂刻语言。以侧影剪形加密集镂孔的对比，模拟牛皮透光后的明暗层次与「以线造型」的刀法。'
    },
    {
      id: 'knot', name: '甘南吉祥结',
      about: '取材于藏式吉祥结（盘长结）与唐卡边饰。以方形回环与交叠穿插构成「无始无终」的连续结构，行线不断、首尾相衔。'
    }
  ];

  const Motif = (function () {
    const canvas = $('#motif');
    const ctx = canvas.getContext('2d');
    const SZ = 1080;
    let fam = MOTIFS[0];
    let pal = PALETTES[0];
    let paperMode = 'paper';

    function params() {
      return {
        seed: +$('#p-seed').value,
        density: +$('#p-density').value,
        weight: +$('#p-weight').value,
        sym: +$('#p-sym').value,
        hue: +$('#p-hue').value
      };
    }

    function paletteShifted(p) {
      return pal.colors.map(c => p.hue ? shiftHue(c, p.hue) : c);
    }

    function paperBase(c, mode) {
      if (mode === 'ink') {
        const g = c.createLinearGradient(0, 0, SZ, SZ);
        g.addColorStop(0, '#14110e'); g.addColorStop(.55, '#1b1713'); g.addColorStop(1, '#0e0c0a');
        c.fillStyle = g; c.fillRect(0, 0, SZ, SZ);
      } else if (mode === 'paper') {
        const g = c.createLinearGradient(0, 0, SZ * .6, SZ);
        g.addColorStop(0, '#f7f2e6'); g.addColorStop(.5, '#f1e9d8'); g.addColorStop(1, '#e9dfc9');
        c.fillStyle = g; c.fillRect(0, 0, SZ, SZ);
        const rng = mulberry32(7);
        for (let i = 0; i < 2600; i++) {
          c.fillStyle = `rgba(120,100,70,${rng() * .05})`;
          c.fillRect(rng() * SZ, rng() * SZ, 1 + rng() * 2, 1);
        }
        c.strokeStyle = 'rgba(120,100,70,.07)'; c.lineWidth = 1;
        for (let i = 0; i < 26; i++) {
          const y = rng() * SZ; c.beginPath(); c.moveTo(0, y);
          c.bezierCurveTo(SZ * .3, y + 18 * (rng() - .5), SZ * .7, y - 18 * (rng() - .5), SZ, y + 6 * (rng() - .5)); c.stroke();
        }
      } else {
        c.fillStyle = paperMode === 'none' && isDark() ? '#141210' : '#f6f1e5';
        c.fillRect(0, 0, SZ, SZ);
      }
    }

    /* ── 母题绘制函数 ── */
    function drawSpiral(c, p, cols, rng, sz) {
      const cx = sz / 2, cy = sz / 2;
      const turns = 2 + rng() * 2.2;
      const arms = 2 + Math.floor(rng() * 4);
      const maxR = sz * 0.43;
      c.lineCap = 'round';
      for (let a = 0; a < arms; a++) {
        const col = cols[a % cols.length];
        c.strokeStyle = col;
        c.lineWidth = p.weight * (0.5 + rng() * 0.9) * sz / 1080;
        c.beginPath();
        const rot = a * Math.PI * 2 / arms;
        const pts = 260;
        for (let i = 0; i <= pts; i++) {
          const t = i / pts;
          const ang = rot + t * turns * Math.PI * 2;
          const rr = maxR * Math.pow(t, 0.82);
          const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.94;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
      /* 同心弧带 */
      c.globalAlpha = .5;
      const bands = 3 + Math.floor(rng() * 4);
      for (let b = 0; b < bands; b++) {
        const rr = maxR * (0.24 + b * 0.19);
        c.strokeStyle = cols[(b + 1) % cols.length];
        c.lineWidth = p.weight * 0.42 * sz / 1080;
        c.setLineDash([sz * 0.004 * (1 + rng() * 2), sz * 0.012]);
        c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.stroke();
      }
      c.setLineDash([]);
      /* 网格纹点阵 */
      const dots = 10 + Math.floor(p.density * 1.4);
      for (let i = 0; i < dots; i++) {
        const ang = rng() * Math.PI * 2, rr = maxR * (0.1 + rng() * 0.92);
        c.fillStyle = cols[Math.floor(rng() * cols.length)];
        c.globalAlpha = .55 + rng() * .35;
        const s = sz * 0.004 * (0.6 + rng() * 1.3);
        c.fillRect(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * .94, s, s);
      }
      c.globalAlpha = 1;
    }

    function drawRosette(c, p, cols, rng, sz) {
      const cx = sz / 2, cy = sz / 2;
      const N = p.sym;
      const R = sz * 0.42;
      const layers = 3 + Math.floor(p.density / 12);
      for (let L = 0; L < layers; L++) {
        const rr = R * (1 - L * 0.19);
        const col = cols[L % cols.length];
        c.strokeStyle = col; c.fillStyle = col;
        c.lineWidth = p.weight * (1 - L * 0.14) * sz / 1080;
        const petals = N;
        for (let i = 0; i < petals; i++) {
          const a0 = i * Math.PI * 2 / petals;
          const a1 = a0 + Math.PI * 2 / petals * (0.42 + rng() * 0.42);
          c.beginPath();
          const tipR = rr * (0.72 + rng() * 0.3);
          const px = cx + Math.cos((a0 + a1) / 2) * tipR, py = cy + Math.sin((a0 + a1) / 2) * tipR;
          c.moveTo(cx + Math.cos(a0) * rr * .38, cy + Math.sin(a0) * rr * .38);
          c.quadraticCurveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, px, py);
          c.quadraticCurveTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, cx + Math.cos(a1) * rr * .38, cy + Math.sin(a1) * rr * .38);
          if (rng() > .45) { c.globalAlpha = .18; c.fill(); c.globalAlpha = 1; }
          c.stroke();
        }
        /* 镂空小圆 */
        for (let i = 0; i < petals; i++) {
          const a = i * Math.PI * 2 / petals + Math.PI / petals;
          c.beginPath();
          c.arc(cx + Math.cos(a) * rr * .55, cy + Math.sin(a) * rr * .55, rr * .035 * (0.6 + rng()), 0, 6.2832);
          c.globalAlpha = .85; c.fill(); c.globalAlpha = 1;
        }
      }
      /* 中心 */
      c.beginPath(); c.arc(cx, cy, R * 0.075, 0, 6.2832);
      c.fillStyle = cols[0]; c.fill();
      c.beginPath(); c.arc(cx, cy, R * 0.14, 0, 6.2832);
      c.strokeStyle = cols[1 % cols.length]; c.lineWidth = p.weight * sz / 1080; c.stroke();
    }

    function drawSachet(c, p, cols, rng, sz) {
      const cx = sz / 2;
      const bodyTop = sz * 0.26, bodyBot = sz * 0.68;
      const halfW = sz * 0.2 * (0.85 + rng() * 0.3);
      const col = cols[0], col2 = cols[1 % cols.length], col3 = cols[2 % cols.length];
      /* 主体（桃形/锁形轮廓） */
      c.beginPath();
      c.moveTo(cx, bodyTop);
      c.bezierCurveTo(cx + halfW * 1.5, bodyTop + sz * 0.02, cx + halfW * 1.15, bodyBot, cx, bodyBot + sz * 0.03);
      c.bezierCurveTo(cx - halfW * 1.15, bodyBot, cx - halfW * 1.5, bodyTop + sz * 0.02, cx, bodyTop);
      c.fillStyle = col + '22';
      c.fill();
      c.strokeStyle = col; c.lineWidth = p.weight * 1.5 * sz / 1080; c.stroke();

      /* 锁边针（锯齿） */
      const steps = Math.max(28, Math.round(p.density * 3));
      c.lineWidth = p.weight * sz / 1080;
      for (let side = -1; side <= 1; side += 2) {
        c.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const y = bodyTop + (bodyBot - bodyTop) * t;
          const w = halfW * (1.18 * Math.sin(Math.PI * t) + 0.16) * side;
          const jag = (i % 2 ? 1 : 0) * sz * 0.012;
          const x = cx + w + jag * side;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.strokeStyle = col2; c.stroke();
      }
      /* 内部纹样：同心弧 + 点阵 */
      const rings = 3 + Math.floor(rng() * 3);
      for (let r = 0; r < rings; r++) {
        const rr = halfW * (0.28 + r * 0.26);
        c.beginPath();
        c.ellipse(cx, (bodyTop + bodyBot) / 2 + sz * 0.01, rr, rr * 1.05, 0, 0, 6.2832);
        c.strokeStyle = cols[(r + 1) % cols.length];
        c.lineWidth = p.weight * .55 * sz / 1080;
        c.setLineDash(r % 2 ? [sz * .008, sz * .014] : []);
        c.stroke();
      }
      c.setLineDash([]);
      const nDots = 8 + Math.round(p.density * 1.2);
      for (let i = 0; i < nDots; i++) {
        const a = rng() * Math.PI * 2, rr = halfW * (0.1 + rng() * 0.95);
        c.beginPath();
        c.arc(cx + Math.cos(a) * rr, (bodyTop + bodyBot) / 2 + Math.sin(a) * rr * 1.05, sz * 0.005 * (0.7 + rng()), 0, 6.2832);
        c.fillStyle = cols[Math.floor(rng() * cols.length)]; c.fill();
      }
      /* 束口与流苏 */
      c.strokeStyle = col3; c.lineWidth = p.weight * sz / 1080;
      c.beginPath(); c.moveTo(cx - halfW * 0.5, bodyTop + sz * 0.012); c.lineTo(cx + halfW * 0.5, bodyTop + sz * 0.012); c.stroke();
      const tassels = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < tassels; i++) {
        const x = cx + (i - (tassels - 1) / 2) * halfW * 0.36;
        c.beginPath(); c.moveTo(x, bodyBot + sz * 0.028);
        c.quadraticCurveTo(x + (rng() - .5) * sz * .02, bodyBot + sz * 0.075, x + (rng() - .5) * sz * .03, bodyBot + sz * 0.115);
        c.strokeStyle = cols[i % cols.length]; c.lineWidth = p.weight * .8 * sz / 1080; c.stroke();
      }
      /* 上挂绳 */
      c.beginPath(); c.moveTo(cx, bodyTop); c.lineTo(cx, sz * 0.14);
      c.strokeStyle = col2; c.lineWidth = p.weight * .7 * sz / 1080; c.stroke();
      c.beginPath(); c.arc(cx, sz * 0.125, sz * 0.012, 0, 6.2832); c.stroke();
    }

    function drawShadow(c, p, cols, rng, sz) {
      const frame = sz * 0.08;
      const col = cols[0], col2 = cols[1 % cols.length];
      /* 外框 */
      c.strokeStyle = col; c.lineWidth = p.weight * 1.6 * sz / 1080;
      c.strokeRect(frame, frame, sz - frame * 2, sz - frame * 2);
      c.lineWidth = p.weight * .6 * sz / 1080;
      c.strokeRect(frame * 1.6, frame * 1.6, sz - frame * 3.2, sz - frame * 3.2);

      /* 侧影剪形（抽象人物/走兽轮廓，左右各一，镜像呼应） */
      function silhouette(cx0, cy0, s, flip) {
        c.save();
        c.translate(cx0, cy0); c.scale(flip ? -s : s, s);
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(.28, -.06, .40, -.20, .34, -.40);
        c.bezierCurveTo(.30, -.54, .10, -.58, -.02, -.50);
        c.bezierCurveTo(-.16, -.42, -.24, -.24, -.30, -.06);
        c.bezierCurveTo(-.40, .06, -.52, .20, -.44, .40);
        c.bezierCurveTo(-.36, .58, -.10, .62, .10, .56);
        c.bezierCurveTo(.34, .50, .58, .30, .52, .06);
        c.closePath();
        c.fillStyle = col + '2e';
        c.fill();
        c.strokeStyle = col; c.lineWidth = p.weight * 1.1; c.stroke();
        /* 镂孔 */
        const n = 16 + Math.round(p.density * 2);
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2, rr = Math.pow(rng(), .6) * .45;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .9 + .05;
          c.beginPath();
          c.arc(x, y, .012 + rng() * .022, 0, 6.2832);
          c.fillStyle = cols[Math.floor(rng() * cols.length)];
          c.globalAlpha = .55 + rng() * .35;
          c.fill(); c.globalAlpha = 1;
        }
        c.restore();
      }
      silhouette(sz * 0.34, sz * 0.52, sz, false);
      silhouette(sz * 0.66, sz * 0.52, sz, true);

      /* 背景装饰弧与流云纹 */
      c.strokeStyle = col2; c.globalAlpha = .75;
      for (let i = 0; i < 4 + Math.floor(rng() * 3); i++) {
        c.lineWidth = p.weight * .5 * sz / 1080;
        c.beginPath();
        const y = frame * 1.6 + (sz - frame * 3.2) * (i + 0.5) / 6;
        c.moveTo(frame * 2, y);
        for (let k = 0; k < 6; k++) {
          const x0 = frame * 2 + (sz - frame * 4) * k / 6;
          c.quadraticCurveTo(x0 + sz * .04, y + (rng() - .5) * sz * .05,
            x0 + (sz - frame * 4) / 6, y + (rng() - .5) * sz * .02);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    function drawKnot(c, p, cols, rng, sz) {
      const pad = sz * 0.13;
      const inner = sz - pad * 2;
      const col = cols[0], col2 = cols[1 % cols.length], col3 = cols[2 % cols.length];
      const cells = clamp(Math.round(p.sym / 2) + 2, 3, 12);
      const step = inner / cells;
      const lw = p.weight * 1.35 * sz / 1080;
      c.lineCap = 'square';
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? col2 : col;
        c.lineWidth = pass ? lw * .62 : lw;
        c.globalAlpha = pass ? .85 : 1;
        for (let i = 0; i <= cells; i++) {
          const x = pad + i * step;
          const y0 = pad + ((i % 2) ? step * .18 : 0);
          c.beginPath(); c.moveTo(x, y0); c.lineTo(x, pad + inner - ((i % 2) ? 0 : step * .18)); c.stroke();
        }
        for (let j = 0; j <= cells; j++) {
          const y = pad + j * step;
          c.beginPath(); c.moveTo(pad, y); c.lineTo(pad + inner, y); c.stroke();
          if (j % 2 === 0) {
            c.beginPath(); c.moveTo(pad + step * .3, y); c.lineTo(pad + inner - step * .3, y);
            c.strokeStyle = pass ? col3 : col2; c.lineWidth = pass ? lw * .5 : lw * .5; c.stroke();
            c.strokeStyle = pass ? col2 : col; c.lineWidth = pass ? lw * .62 : lw;
          }
        }
      }
      /* 交叠节点强调 */
      for (let i = 0; i <= cells; i++) {
        for (let j = 0; j <= cells; j++) {
          if ((i + j) % 3 !== 0) continue;
          c.beginPath();
          c.arc(pad + i * step, pad + j * step, lw * 1.15, 0, 6.2832);
          c.fillStyle = cols[(i + j) % cols.length];
          c.fill();
        }
      }
      /* 边框回纹 */
      c.globalAlpha = 1;
      c.strokeStyle = col3;
      c.lineWidth = lw * .8;
      c.setLineDash([step * .3, step * .2]);
      c.strokeRect(pad * .62, pad * .62, sz - pad * 1.24, sz - pad * 1.24);
      c.setLineDash([]);
      c.lineWidth = lw * .45;
      c.strokeRect(pad * .34, pad * .34, sz - pad * .68, sz - pad * .68);
    }

    const DRAW = { spiral: drawSpiral, rosette: drawRosette, sachet: drawSachet, shadow: drawShadow, knot: drawKnot };

    let renderSeq = 0;
    /* 单一母题的纯绘制（不含底纹），供首屏动画与导出复用 */
    function paint(c, famId, p, cols, sz) {
      const rng = mulberry32(p.seed + famId.length * 977);
      DRAW[famId](c, p, cols, rng, sz);
    }

    function render(target, size, p, scale) {
      const c = target.getContext('2d');
      const s = scale || 1;
      c.setTransform(s, 0, 0, s, 0, 0);
      const sz = size;
      paperBase(c, paperMode);
      const cols = paletteShifted(p);
      paint(c, fam.id, p, cols, sz);
      /* 作品署名水印 */
      if (paperMode !== 'none') {
        c.save();
        c.globalAlpha = .3;
        c.fillStyle = isDark() ? '#e8dcc0' : '#4a3b2c';
        c.font = `${Math.round(sz * 0.019)}px "Songti SC","SimSun",serif`;
        c.textAlign = 'right';
        c.fillText('陇原非遗数字图谱 · 纹样再生', sz - sz * 0.05, sz - sz * 0.045);
        c.restore();
      }
    }

    function updateLabels(p) {
      $('#v-seed').textContent = p.seed;
      $('#v-density').textContent = p.density;
      $('#v-weight').textContent = p.weight;
      $('#v-sym').textContent = p.sym;
      $('#v-hue').textContent = (p.hue > 0 ? '+' : '') + p.hue + '°';
    }

    function rerender() {
      const p = params();
      updateLabels(p);
      $('#motif-caption').textContent = `${fam.name} · 种子 ${p.seed} · 对称 ${p.sym} 重 · ${pal.name}`;
      render(canvas, SZ, p, 1);
    }

    function setFamily(id) {
      fam = MOTIFS.find(m => m.id === id) || MOTIFS[0];
      $('#motif-about').textContent = fam.about;
      $('#motif-family').value = fam.id;
      rerender();
    }

    function init() {
      const sel = $('#motif-family');
      MOTIFS.forEach(m => {
        const o = document.createElement('option');
        o.value = m.id; o.textContent = m.name;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => setFamily(sel.value));

      const sw = $('#palettes');
      PALETTES.forEach((pl, i) => {
        const b = document.createElement('button');
        b.className = i === 0 ? 'is-active' : '';
        b.title = pl.name;
        b.innerHTML = pl.colors.map(c => `<i style="background:${c}"></i>`).join('');
        b.addEventListener('click', () => {
          pal = pl;
          $$('#palettes button').forEach(x => x.classList.remove('is-active'));
          b.classList.add('is-active');
          rerender();
        });
        sw.appendChild(b);
      });

      ['seed', 'density', 'weight', 'sym', 'hue'].forEach(k => {
        $('#p-' + k).addEventListener('input', rerender);
      });
      $$('#paper-mode button').forEach(b => b.addEventListener('click', () => {
        paperMode = b.dataset.val;
        $$('#paper-mode button').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        rerender();
      }));
      $('#motif-random').addEventListener('click', () => {
        $('#p-seed').value = 1 + Math.floor(Math.random() * 9999);
        $('#p-density').value = 6 + Math.floor(Math.random() * 40);
        $('#p-weight').value = 1 + Math.floor(Math.random() * 11);
        $('#p-sym').value = 3 + Math.floor(Math.random() * 21);
        rerender();
      });
      $('#motif-export').addEventListener('click', () => {
        const out = document.createElement('canvas');
        out.width = 2160; out.height = 2160;
        render(out, SZ, params(), 2160 / SZ);
        const a = document.createElement('a');
        a.download = `陇原非遗纹样_${fam.id}_${$('#p-seed').value}.png`;
        a.href = out.toDataURL('image/png');
        a.click();
      });
      setFamily(MOTIFS[0].id);
    }

    return { init, rerender, setFamily, MOTIFS, paint };
  })();

  /* ══════════════════ 11. 首屏纹样动画 ══════════════════ */

  const Hero = (function () {
    const canvas = $('#hero-canvas');
    let timer = null, seq = 0;
    function frame() {
      const fam = Motif.MOTIFS[seq % Motif.MOTIFS.length];
      const rng = mulberry32(1000 + seq * 37);
      const p = {
        seed: 1000 + Math.floor(rng() * 9000),
        density: 10 + Math.floor(rng() * 24),
        weight: 2 + Math.floor(rng() * 6),
        sym: 6 + Math.floor(rng() * 12),
        hue: Math.round((rng() - .5) * 40)
      };
      const c = canvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      const dark = isDark();
      const g = c.createLinearGradient(0, 0, 720, 720);
      if (dark) { g.addColorStop(0, '#14110e'); g.addColorStop(1, '#0e0c0a'); }
      else { g.addColorStop(0, '#f9f5ea'); g.addColorStop(1, '#efe6d2'); }
      c.fillStyle = g; c.fillRect(0, 0, 720, 720);
      const pal = PALETTES[seq % PALETTES.length];
      const cols = pal.colors.map(x => p.hue ? shiftHue(x, p.hue) : x);
      c.globalAlpha = 0;
      Motif.paint(c, fam.id, p, cols, 720);
      c.globalAlpha = 1;
      seq++;
    }
    function start() { stop(); frame(); timer = setInterval(frame, 3600); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    return { start, stop, restart: start };
  })();

  /* ══════════════════ 12. 视图与事件绑定 ══════════════════ */

  function switchView(v) {
    if (!document.getElementById('view-' + v)) v = 'overview';
    state.view = v;
    $$('.view').forEach(s => s.classList.toggle('is-active', s.id === 'view-' + v));
    $$('.tab').forEach(t => {
      const on = t.dataset.view === v;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    try { history.replaceState(null, '', '#' + v); } catch (e) { }
    if (v === 'graph') Graph.onShow();
  }

  function syncBatchSelect() {
    $('#filter-batch').value = state.batch;
  }

  function renderAll() {
    renderOverview();
    renderChips();
    renderMap();
    if (state.city) {
      const exists = visibleItems().some(it => it.city === state.city);
      if (exists) renderSide(state.city);
      else { state.city = null; $('#side-body').hidden = true; $('#side-empty').hidden = false; }
    } else {
      renderSideSearch();
    }
  }

  function initTabs() {
    $$('.tab').forEach(t => {
      t.addEventListener('click', () => switchView(t.dataset.view));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { $('#drawer').hidden = true; hideTip(); }
      if (e.key === 'ArrowRight' && (e.altKey)) {
        const list = $$('.tab'); const i = list.findIndex(t => t.classList.contains('is-active'));
        switchView(list[(i + 1) % list.length].dataset.view);
      }
    });
  }

  function initFilters() {
    const sel = $('#filter-batch');
    BATCHES.forEach(b => {
      const o = document.createElement('option');
      o.value = b.name; o.textContent = `${b.name}（${b.year} 年）`;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { state.batch = sel.value; renderAll(); });

    let t = null;
    $('#search').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { state.query = e.target.value; renderMap(); renderSideSearch(); }, 160);
    });
    $('#search-clear').addEventListener('click', () => {
      $('#search').value = ''; state.query = ''; renderAll();
    });
    $('#filter-metric').addEventListener('change', e => { state.metric = e.target.value; renderMap(); });
    $('#filter-reset').addEventListener('click', () => {
      state.cats.clear(); state.batch = 'all'; state.query = ''; state.city = null;
      $('#search').value = ''; syncBatchSelect();
      renderAll();
    });
    $('#drawer-close').addEventListener('click', () => { $('#drawer').hidden = true; });
    $('#theme-toggle').addEventListener('click', () => {
      applyTheme(isDark() ? 'paper' : 'ink');
    });
  }

  /* ══════════════════ 13. 启动 ══════════════════ */

  function boot() {
    let saved = null;
    try { saved = localStorage.getItem('ly-theme'); } catch (e) { }
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    /* URL 参数：支持深链与演示预设
       index.html#map  · index.html?motif=knot&seed=1234&theme=ink  */
    const qs = new URLSearchParams(location.search);
    if (qs.get('theme')) document.documentElement.setAttribute('data-theme', qs.get('theme') === 'ink' ? 'ink' : 'paper');

    initTabs();
    initFilters();
    renderAll();
    renderSources();
    Graph.start();
    Motif.init();
    Hero.start();

    if (qs.get('motif')) Motif.setFamily(qs.get('motif'));
    if (qs.get('seed')) { $('#p-seed').value = qs.get('seed'); Motif.rerender(); }
    if (qs.get('sym')) { $('#p-sym').value = qs.get('sym'); Motif.rerender(); }
    if (qs.get('cat')) { state.cats.add(qs.get('cat')); renderAll(); }

    const h = (location.hash || '').replace('#', '');
    if (['overview', 'map', 'graph', 'motif', 'about'].indexOf(h) >= 0) switchView(h);
    window.addEventListener('hashchange', () => {
      const v = (location.hash || '').replace('#', '');
      if (v && v !== state.view) switchView(v);
    });

    if (window.__lyOk) window.__lyOk(`自检通过 · 数据模块已加载 · 收录 ${ITEMS.length} 项 · ${STAT.cityCovered}/14 市州 · ${STAT.catCovered}/10 门类 · 地理要素 ${GEO.features.length} 个`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 暴露给调试 */
  window.LY = { ITEMS, STAT, state, renderAll, openDrawer };

  } catch (err) {
    var msg = '可视化引擎异常：' + (err && err.message ? err.message : err) +
      '\n' + (err && err.stack ? err.stack : '（无堆栈信息）');
    if (window.__lyFail) window.__lyFail(msg);
    else { try { console.error(msg); } catch (e) { } }
    try { document.title = '【异常】陇原非遗数字图谱'; } catch (e) { }
  }
})();
