// Stavanger Z – grensesnitt: kart, panel og modaler.
const SAVE_KEY = 'stavanger-z-v1';
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S = null;                    // spilltilstand
let sel = { kind: 'sector', id: 'hjem' };
let selAction = null;            // valgt handling i sektorkortet
let view = 'focus';
let vb = MAP.focus.slice();

function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* lagring er en bonus */ } }
function load() { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignorer */ } }

// ================= KART =================
const svg = $('map');
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function toLatLon(x, y) { return { lat: MAP.geo.N - y / 1e5, lon: MAP.geo.W + x / (MAP.geo.KX * 1e5) }; }
function fromLat(lat) { return (MAP.geo.N - lat) * 1e5; }
function fromLon(lon) { return (lon - MAP.geo.W) * MAP.geo.KX * 1e5; }
function dm(v, h) { const d = Math.floor(v), m = (v - d) * 60; return `${d}°${m.toFixed(1).padStart(4, '0')}′${h}`; }

let dyn;
function buildStaticMap() {
  const [x, y, w, h] = MAP.view;
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <pattern id="hatchRed" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="22" height="22" fill="none"/><line x1="0" y1="0" x2="0" y2="22" stroke="#e5484d" stroke-width="5" stroke-opacity=".38"/></pattern>
    <pattern id="hatchDark" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="16" height="16" fill="none"/><line x1="0" y1="0" x2="0" y2="16" stroke="#e5484d" stroke-width="3" stroke-opacity=".5"/></pattern>
    <filter id="fog" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0025" numOctaves="4" seed="11"/>
      <feColorMatrix values="0 0 0 0 0.04  0 0 0 0 0.07  0 0 0 0 0.10  0 0 0 -0.9 1.0"/>
    </filter>
    <radialGradient id="vign" cx="50%" cy="50%" r="70%"><stop offset="60%" stop-color="#05090d" stop-opacity="0"/><stop offset="100%" stop-color="#05090d" stop-opacity=".7"/></radialGradient>
    <mask id="fogmask"><rect x="${x - 2000}" y="${y - 2000}" width="${w + 4000}" height="${h + 4000}" fill="#fff"/>
      ${MAP.sectors.map((s) => `<path d="${s.d}" fill="#000" stroke="#000" stroke-width="40"/>`).join('')}</mask>`;
  el('rect', { x: x - 3000, y: y - 3000, width: w + 6000, height: h + 6000, fill: 'var(--sea)' }, svg);
  // sjøkartrutenett med ekte koordinater
  const grid = el('g', { stroke: '#132836', 'stroke-width': 2 }, svg);
  const ll0 = toLatLon(x, y + h), ll1 = toLatLon(x + w, y);
  for (let lat = Math.ceil(ll0.lat / 0.005) * 0.005; lat < ll1.lat; lat += 0.005) el('line', { x1: x - 3000, x2: x + w + 3000, y1: fromLat(lat), y2: fromLat(lat) }, grid);
  for (let lon = Math.ceil(ll0.lon / 0.01) * 0.01; lon < ll1.lon; lon += 0.01) el('line', { y1: y - 3000, y2: y + h + 3000, x1: fromLon(lon), x2: fromLon(lon) }, grid);
  const depth = el('g', { fill: 'none', stroke: 'var(--contour)' }, svg);
  MAP.depth.forEach((d, i) => el('path', { d, 'stroke-width': 3 - i, 'stroke-opacity': [0.9, 0.55, 0.3][i] }, depth));
  el('path', { d: MAP.land, fill: 'var(--land)', stroke: 'var(--land-edge)', 'stroke-width': 2 }, svg);
  el('path', { d: MAP.buildings, fill: 'var(--bld)' }, svg);
  el('path', { d: MAP.roads.minor, fill: 'none', stroke: 'var(--road)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  el('path', { d: MAP.roads.major, fill: 'none', stroke: 'var(--road-major)', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  // tåke over alt som ikke er Buøy
  el('rect', { x: x - 300, y: y - 300, width: w + 600, height: h + 600, filter: 'url(#fog)', mask: 'url(#fogmask)' }, svg);
  el('rect', { x: x - 300, y: y - 300, width: w + 600, height: h + 600, fill: '#070d12', 'fill-opacity': 0.2, mask: 'url(#fogmask)' }, svg);
  // koordinatmerker
  const tick = el('g', { class: 'ticks' }, svg);
  for (let lat = Math.ceil(ll0.lat / 0.005) * 0.005; lat < ll1.lat; lat += 0.005) {
    const t = el('text', { x: x + 14, y: fromLat(lat) - 8, class: 'lab zsub', style: 'font-family:var(--f-mono);letter-spacing:0' }, tick); t.textContent = dm(lat, 'N');
  }
  for (let lon = Math.ceil(ll0.lon / 0.01) * 0.01; lon < ll1.lon; lon += 0.01) {
    const t = el('text', { x: fromLon(lon) + 8, y: y + h - 14, class: 'lab zsub', style: 'font-family:var(--f-mono);letter-spacing:0' }, tick); t.textContent = dm(lon, 'Ø');
  }
  // fremtidige soner
  const zones = el('g', {}, svg);
  for (const z of MAP.zones) {
    const p = el('path', { d: z.d, class: 'zone', 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': z.name }, zones);
    p.addEventListener('click', () => select('zone', z.id));
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter') select('zone', z.id); });
  }
  for (const z of MAP.zones) {
    const t = el('text', { x: z.cx, y: z.cy, class: 'lab zone', 'text-anchor': 'middle' }, zones); t.textContent = z.name;
    const u = el('text', { x: z.cx, y: z.cy + 30, class: 'lab zsub', 'text-anchor': 'middle' }, zones); u.textContent = z.id === 'hundvag' ? 'Fase 3 · ukjent' : 'Ukjent';
  }
  dyn = el('g', {}, svg);
  el('rect', { x: x - 3000, y: y - 3000, width: w + 6000, height: h + 6000, fill: 'url(#vign)', 'pointer-events': 'none' }, svg);
  setViewBox(vb);
}

function setViewBox(b) {
  vb = b;
  svg.setAttribute('viewBox', b.map((n) => n.toFixed(1)).join(' '));
  updateScale();
}
function animateView(to) {
  const from = vb.slice(), t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
  const step = (t) => {
    const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    setViewBox(from.map((v, i) => v + (to[i] - v) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function updateScale() {
  const r = svg.getBoundingClientRect();
  if (!r.width) return;
  const pxPerUnit = Math.min(r.width / vb[2], r.height / vb[3]);
  const meters = vb[2] > 2000 ? 500 : 250;
  const units = meters / 1.11;
  $('scale').innerHTML = `${meters} m<div style="width:${(units * pxPerUnit).toFixed(0)}px"></div>`;
}

function renderMap() {
  dyn.innerHTML = '';
  const tokensBy = {};
  for (const c of S.crew) {
    if (c.task.type === 'hvile') (tokensBy.hjem = tokensBy.hjem || []).push(c);
    else if (c.task.type === 'befeste') (tokensBy['g_' + c.task.target] = tokensBy['g_' + c.task.target] || []).push(c);
    else (tokensBy[c.task.target] = tokensBy[c.task.target] || []).push(c);
  }
  for (const m of MAP.sectors) {
    const id = m.id, isLocked = id === 'rosenberg';
    const intel = isLocked ? null : sectorIntel(S, id);
    const cls = isLocked ? 's-lock' : intel.status === 'infisert' ? 's-inf' : 's-clr';
    const g = el('g', { class: `sector ${cls}${sel.kind === 'sector' && sel.id === id ? ' sel' : ''}`, tabindex: 0, role: 'button', 'aria-label': SECTORS[id].name }, dyn);
    el('path', { d: m.d, class: 'fillbase' }, g);
    el('path', { d: m.d, class: 'edge', 'stroke-linejoin': 'round' }, g);
    g.addEventListener('click', () => select('sector', id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') select('sector', id); });
  }
  for (const m of MAP.sectors) {
    const id = m.id;
    if (id === 'rosenberg') {
      const t = el('text', { x: m.cx, y: m.cy - 10, class: 'lab big', 'text-anchor': 'middle' }, dyn); t.textContent = 'HORDE';
      const u = el('text', { x: m.cx, y: m.cy + 28, class: 'lab', 'text-anchor': 'middle' }, dyn); u.textContent = 'Rosenberg Verft';
      const v = el('text', { x: m.cx, y: m.cy + 58, class: 'lab sub inf', 'text-anchor': 'middle' }, dyn); v.textContent = 'Fase 2';
      continue;
    }
    const intel = sectorIntel(S, id);
    const t = el('text', { x: m.cx, y: m.cy - 6, class: 'lab', 'text-anchor': 'middle' }, dyn); t.textContent = SECTORS[id].short;
    const u = el('text', { x: m.cx, y: m.cy + 22, class: `lab sub ${intel.status === 'infisert' ? 'inf' : 'clr'}`, 'text-anchor': 'middle' }, dyn);
    u.textContent = intel.status === 'infisert' ? `${intel.estimate} Z` : `✓ ${intel.conf}%`;
    drawTokens(tokensBy[id], m.cx, m.cy + 58);
  }
  for (const id in GATES) {
    const gd = GATES[id], st = S.gates[id];
    const g = el('g', { class: `gate ${st.level ? 'on' : 'l0'}${sel.kind === 'gate' && sel.id === id ? ' sel' : ''}`, transform: `translate(${gd.x} ${gd.y})`, tabindex: 0, role: 'button', 'aria-label': gd.name }, dyn);
    el('rect', { class: 'box', x: -48, y: -22, width: 96, height: 44, rx: 6 }, g);
    for (let i = 0; i < 3; i++) el('rect', { class: `pip${i < st.level ? ' on' : ''}`, x: -36 + i * 26, y: 4, width: 20, height: 8, rx: 2 }, g);
    const t = el('text', { x: 0, y: -4, 'text-anchor': 'middle' }, g); t.textContent = st.level ? `Nivå ${st.level}` : 'Åpen';
    g.addEventListener('click', () => select('gate', id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') select('gate', id); });
    drawTokens(tokensBy['g_' + id], gd.x, gd.y + 50);
  }
  for (const z of MAP.zones) svg.querySelector(`[data-zone="${z.id}"]`).classList.toggle('sel', sel.kind === 'zone' && sel.id === z.id);
}
function drawTokens(list, cx, cy) {
  if (!list) return;
  const gap = 46, x0 = cx - ((list.length - 1) * gap) / 2;
  list.forEach((c, i) => {
    const g = el('g', { class: `token t-${c.task.type}${c.hp < 3 ? ' hurt' : ''}`, transform: `translate(${x0 + i * gap} ${cy})`, 'pointer-events': 'none' }, dyn);
    el('circle', { r: 20 }, g);
    const t = el('text', {}, g); t.textContent = c.name.slice(0, 2);
  });
}

// ================= PANEL =================
function renderTop() {
  $('day').textContent = `Dag ${S.day}`;
  const food = dailyFood(S), water = dailyWater(S);
  const cell = (k, v, d, low) => `<div class="r${low ? ' low' : ''}"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${d || ''}</span></div>`;
  $('res').innerHTML =
    cell('Mat', S.res.mat, `−${food}/d`, S.res.mat < food * 2) +
    cell('Vann', S.res.vann, `−${water}/d`, S.res.vann < water * 2) +
    cell('Medisin', S.res.medisin) +
    cell('Materialer', S.res.materialer) +
    cell('Drivstoff', S.res.drivstoff) +
    `<div class="r moral"><span class="k">Moral ${S.moral}</span><span class="bar"><i style="width:${S.moral}%;${S.moral < 30 ? 'background:var(--red)' : ''}"></i></span></div>`;
}
function renderGoals() {
  const p = phaseProgress(S);
  const row = (txt, val, done) => `<div class="goal${done ? ' done' : ''}"><span>${done ? '✓ ' : ''}${txt}</span><b>${val}</b></div>`;
  $('goals').innerHTML = `<div class="goals">
    ${row('Klarer alle sektorer på Buøy', `${p.cleared}/${p.total}`, p.cleared === p.total)}
    ${p.gates.map((g) => row(`${g.name} på nivå 2`, `${g.level}/2`, g.level >= 2)).join('')}
    <div class="hint">Utstyr: ${GEAR[S.gear].name}</div>
  </div>`;
}

function crewChips(isMine, assign, label) {
  return `<div class="chips">${S.crew.map((c) => {
    const on = isMine(c);
    const cur = c.task.type === 'hvile' ? 'hviler' : on ? '' : taskShort(c.task);
    return `<button class="chip" data-crew="${c.id}" aria-pressed="${on}">${esc(c.name)}${cur ? `<small>${cur}</small>` : ''}</button>`;
  }).join('')}</div>`;
}
function taskShort(t) {
  if (t.type === 'befeste') return 'bygger';
  const map = { klarere: 'klarerer', lete: 'leter', finsjekk: 'sjekker' };
  return `${map[t.type]} ${SECTORS[t.target].short}`;
}
function lootHint(sec) {
  const tiers = Object.entries(sec.loot).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!tiers.length) return 'Tømt for alt nyttig.';
  return 'Rykter om: ' + tiers.slice(0, 3).map(([k, v]) => `${v >= 10 ? 'mye ' : v >= 4 ? '' : 'litt '}${RES_LABEL[k].toLowerCase()}`).join(', ') + '.';
}

function renderSel() {
  const box = $('sel');
  if (sel.kind === 'sector' && sel.id === 'rosenberg') {
    box.innerHTML = `<div class="card"><span class="badge lock">Horde · Fase 2</span><h2>Rosenberg Verft</h2><p>${SECTORS.rosenberg.desc}</p>
      <div class="metrics"><div class="metric"><div class="k">Horde</div><div class="v">60–120</div></div>
      <div class="metric"><div class="k">Kapasitet</div><div class="v">???</div></div><div class="metric"><div class="k">Forsvar</div><div class="v">???</div></div></div>
      <p class="hint">Dette er HQ-et ditt i fase 2. De ekte HQ-verdiene er skjulte. Hold Rosenberg-gjerdet oppe så horden blir der den er.</p></div>`;
    return;
  }
  if (sel.kind === 'zone') {
    const z = MAP.zones.find((z) => z.id === sel.id);
    box.innerHTML = `<div class="card"><span class="badge fog">Ukjent sone</span><h2>${esc(z.name)}</h2><p>${ZONE_INFO[z.id] || ''}</p><p class="hint">Utenfor rekkevidde i fase 1. Sikre Buøy først.</p></div>`;
    return;
  }
  if (sel.kind === 'gate') {
    const gd = GATES[sel.id], st = S.gates[sel.id];
    const ready = S.sectors[gd.sector].z === 0;
    const next = GATE_STEPS[Math.min(3, st.level + 1)];
    const prev = GATE_STEPS[st.level];
    const pct = st.level >= 3 ? 100 : Math.round(((st.work - prev) / (next - prev)) * 100);
    const mine = (c) => c.task.type === 'befeste' && c.task.target === sel.id;
    box.innerHTML = `<div class="card"><span class="badge ${st.level ? 'clr' : 'inf'}">Sperring · nivå ${st.level}/3</span><h2>${gd.name}</h2><p>${gd.desc}</p>
      <div><div class="hint">${st.level >= 3 ? 'Fullt utbygd.' : `Fram til nivå ${st.level + 1}: ${pct}%`}</div><div class="prog"><i style="width:${pct}%"></i></div></div>
      <p class="hint">${ready ? 'Mekk teller mest. Hver arbeidsdag bruker materialer.' : `Klarer ${SECTORS[gd.sector].short} før dere kan bygge her.`}</p>
      ${ready && st.level < 3 ? `<p class="eyebrow" style="margin:0">Send til befesting</p>${crewChips(mine)}` : ''}</div>`;
    box.querySelectorAll('[data-crew]').forEach((b) => b.addEventListener('click', () => {
      const c = S.crew.find((x) => x.id === b.dataset.crew);
      c.task = mine(c) ? { type: 'hvile' } : { type: 'befeste', target: sel.id };
      refresh();
    }));
    return;
  }
  const id = sel.id, sec = S.sectors[id], intel = sectorIntel(S, id);
  const inf = intel.status === 'infisert';
  const actions = inf ? ['klarere'] : [...(intel.searched < 100 ? ['lete'] : []), 'finsjekk'];
  if (!actions.includes(selAction)) selAction = actions[0];
  const actLabel = { klarere: 'Klarere', lete: 'Lete', finsjekk: 'Finsjekke' };
  const mine = (c) => c.task.type === selAction && c.task.target === id;
  box.innerHTML = `<div class="card">
    <span class="badge ${inf ? 'inf' : 'clr'}">${inf ? 'Infisert' : 'Klarert'}${id === 'hjem' ? ' · Du bor her' : ''}</span>
    <h2>${SECTORS[id].name}</h2><p>${SECTORS[id].desc}</p>
    <div class="metrics">
      <div class="metric"><div class="k">Zombier</div><div class="v">${intel.estimate}${!sec.seen && inf ? ' <small>anslag</small>' : ''}</div></div>
      <div class="metric"><div class="k">Sikkerhet</div><div class="v">${inf ? '–' : `${intel.conf}%`}${!inf ? ` <small>${intel.confExact ? 'regneark' : 'magefølelse'}</small>` : ''}</div></div>
      <div class="metric"><div class="k">Gjennomsøkt</div><div class="v">${intel.searched}%</div></div>
    </div>
    <p class="hint">${inf ? 'Muskler og Nerver dreper zombier. Snoking finner dem som gjemmer seg i kjellere. Send flere sammen for å unngå skader.' : `${lootHint(sec)} Lav sikkerhet betyr at noe kan ligge igjen i en kjeller.`}</p>
    ${actions.length > 1 ? `<div class="seg" role="group">${actions.map((a) => `<button data-act="${a}" aria-pressed="${a === selAction}">${actLabel[a]}</button>`).join('')}</div>` : ''}
    <p class="eyebrow" style="margin:0">Send til ${actLabel[selAction].toLowerCase()}</p>
    ${crewChips(mine)}
  </div>`;
  box.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { selAction = b.dataset.act; renderSel(); }));
  box.querySelectorAll('[data-crew]').forEach((b) => b.addEventListener('click', () => {
    const c = S.crew.find((x) => x.id === b.dataset.crew);
    c.task = mine(c) ? { type: 'hvile' } : { type: selAction, target: id };
    refresh();
  }));
}

function statPips(st, cls = 'st') {
  return STATS.map((k) => `<div class="${cls}">${STAT_LABEL[k].slice(0, 3)}<div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= st[k] ? 'on' : ''}"></i>`).join('')}</div></div>`).join('');
}
function renderCrew() {
  const opts = taskOptions(S);
  $('crew').innerHTML = S.crew.map((c) => {
    const val = c.task.type + ':' + (c.task.target || '');
    return `<div class="cm${c.task.type !== 'hvile' ? ' busy' : ''}">
      <div class="nm">${esc(c.name)}<small>${esc(c.role)}</small></div>
      <div class="hp h${c.hp}" title="${HEALTH_LABEL[c.hp]}">${[1, 2, 3].map((i) => `<i class="${i <= c.hp ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tr"><b>${TRAITS[c.trait].name}.</b> ${TRAITS[c.trait].desc}</div>
      <div class="statrow">${statPips(c.stats)}</div>
      <select data-crew="${c.id}" aria-label="Oppdrag for ${esc(c.name)}">${opts.map((o) => `<option value="${o.type}:${o.target || ''}"${o.type + ':' + (o.target || '') === val ? ' selected' : ''}>${o.label}</option>`).join('')}</select>
    </div>`;
  }).join('');
  $('crew').querySelectorAll('select').forEach((s) => s.addEventListener('change', () => {
    const c = S.crew.find((x) => x.id === s.dataset.crew);
    const [type, target] = s.value.split(':');
    c.task = target ? { type, target } : { type };
    refresh();
  }));
}
function renderPlan() {
  const groups = {};
  for (const c of S.crew) { const k = c.task.type === 'hvile' ? 'hviler' : taskShort(c.task) + (c.task.type === 'befeste' ? ' ' + GATES[c.task.target].name : ''); (groups[k] = groups[k] || []).push(c.name); }
  $('plan').textContent = Object.entries(groups).map(([k, v]) => `${v.join(', ')} ${k}`).join(' · ');
  $('end').textContent = `Avslutt dag ${S.day}`;
}

function select(kind, id) { sel = { kind, id }; selAction = null; renderSel(); renderMap(); if (innerWidth <= 860) $('sel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
let previewing = false;
function refresh() { renderTop(); renderGoals(); renderSel(); renderCrew(); renderPlan(); renderMap(); if (!previewing) save(); }

// ================= MODALER =================
function modal(html, wide) {
  $('sheet').className = 'sheet' + (wide ? ' wide' : '');
  $('sheet').innerHTML = html;
  $('modal').hidden = false;
  const f = $('sheet').querySelector('button, input');
  if (f) f.focus({ preventScroll: true });
  $('modal').scrollTop = 0;
}
function closeModal() { $('modal').hidden = true; }

function titleScreen() {
  const saved = load();
  modal(`<div class="title" style="display:grid;gap:18px">
    <div class="kick">Et turbasert overlevelsesspill fra byøyene</div>
    <h1>STAVANGER <b>Z</b></h1>
    <p>Utbruddet starter en tirsdag morgen. Du bor på Buøy. Bybrua er stengt, Rosenberg er overkjørt, og det regner. Samle et crew blant naboene, klarer øya sektor for sektor og bygg sperringer før natta tar dere.</p>
    <div class="coords">58°59′N 5°43′Ø · Buøy, Hundvåg bydel</div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="new">Ny runde</button>
      ${saved && !saved.over ? `<button class="btn ghost" id="cont">Fortsett dag ${saved.day}</button>` : ''}
    </div></div>`);
  $('new').onclick = createSelf;
  if ($('cont')) $('cont').onclick = () => { S = saved; closeModal(); refresh(); };
}

const draft = { name: '', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent', picks: [] };
const POOL = 15;
function createSelf() {
  const used = sum(Object.values(draft.stats));
  modal(`<span class="eyebrow">Steg 1 av 2</span><h2>Hvem er du?</h2>
    <div class="field"><label for="nm">Navn</label><input id="nm" maxlength="18" placeholder="Deg" value="${esc(draft.name)}"></div>
    <div><p class="eyebrow">Fordel ${POOL} poeng · ${POOL - used} igjen</p><div class="statedit">
    ${STATS.map((k) => `<div class="se"><div class="lbl">${STAT_LABEL[k]}<small>${STAT_HINT[k]}</small></div>
      <div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= draft.stats[k] ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ctl"><button data-k="${k}" data-d="-1" aria-label="Mindre ${STAT_LABEL[k]}">−</button><button data-k="${k}" data-d="1" aria-label="Mer ${STAT_LABEL[k]}">+</button></div></div>`).join('')}
    </div></div>
    <div><p class="eyebrow">Egenskap</p><div class="picks">${SELF_TRAITS.map((t) => `<button class="pick" data-t="${t}" aria-pressed="${draft.trait === t}"><span class="nm" style="font-size:17px">${TRAITS[t].name}</span><span class="role">${TRAITS[t].desc}</span></button>`).join('')}</div></div>
    <div class="row"><button class="btn ghost" id="back">Tilbake</button><button class="btn" id="next" ${used !== POOL ? 'disabled' : ''}>Velg naboer</button></div>`, true);
  $('nm').addEventListener('input', (e) => (draft.name = e.target.value));
  $('sheet').querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k, d = +b.dataset.d, v = draft.stats[k] + d;
    if (v < 1 || v > 5 || sum(Object.values(draft.stats)) + d > POOL) return;
    draft.stats[k] = v; createSelf();
  }));
  $('sheet').querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { draft.trait = b.dataset.t; createSelf(); }));
  $('back').onclick = titleScreen;
  $('next').onclick = pickNeighbors;
}
function pickNeighbors() {
  modal(`<span class="eyebrow">Steg 2 av 2</span><h2>Velg tre naboer</h2>
    <p>Disse er i live og banker på døra di. Du har plass til tre. De andre må klare seg selv. Kanskje dukker de opp igjen.</p>
    <div class="picks">${START_NEIGHBORS.map((id) => { const n = NEIGHBORS.find((x) => x.id === id); return `<button class="pick" data-n="${id}" aria-pressed="${draft.picks.includes(id)}">
      <span class="nm">${n.name} <small style="font:400 14px var(--f-body);color:var(--muted)">${n.age}</small></span><span class="role">${n.role}</span>
      <span class="tr">${TRAITS[n.trait].name}: ${TRAITS[n.trait].desc}</span><span class="q">«${n.quip}»</span>
      <span class="statrow">${statPips(n.stats)}</span></button>`; }).join('')}</div>
    <div class="row"><span class="hint" style="margin-right:auto;align-self:center">${draft.picks.length}/3 valgt</span><button class="btn ghost" id="back">Tilbake</button><button class="btn" id="go" ${draft.picks.length !== 3 ? 'disabled' : ''}>Start utbruddet</button></div>`, true);
  $('sheet').querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.n, i = draft.picks.indexOf(id);
    if (i >= 0) draft.picks.splice(i, 1); else if (draft.picks.length < 3) draft.picks.push(id);
    pickNeighbors();
  }));
  $('back').onclick = createSelf;
  $('go').onclick = () => {
    previewing = false;
    S = newGame((Date.now() ^ (Math.random() * 1e9)) | 0, { name: draft.name.trim() || 'Deg', stats: draft.stats, trait: draft.trait }, draft.picks);
    sel = { kind: 'sector', id: 'hjem' };
    refresh();
    showEvent(INTRO, () => { closeModal(); refresh(); });
  };
}

function showEvent(ev, done) {
  const body = typeof ev.text === 'function' ? ev.text(S) : ev.text;
  const choices = ev.choices.filter((c) => !c.when || c.when(S));
  modal(`<div class="radio">${ev.channel || 'Samband · kanal 16'} · Dag ${S.day}</div><h2>${ev.title}</h2>
    <div class="transcript">${esc(body)}</div>
    <div class="choices">${choices.map((c, i) => `<button class="choice" data-i="${i}"><span>${c.label}</span>${c.check ? `<small>${STAT_LABEL[c.check]} · ${best(S, c.check).name} · ${Math.round(checkOdds(S, c.check) * 100)}%</small>` : ''}</button>`).join('')}</div>`);
  $('sheet').querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const ch = choices[+b.dataset.i];
    const r = runChoice(S, ev, ch);
    save();
    $('sheet').querySelector('.choices').outerHTML = `<div class="result ${ch.check ? (r.ok ? 'ok' : 'fail') : ''}">${ch.check ? `<div class="tag">${r.ok ? 'Lyktes' : 'Mislyktes'}</div>` : ''}${esc(r.text)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
    $('ok').focus();
    $('ok').onclick = done;
  }));
}

function endDay() {
  const day = S.day;
  const lines = resolveDay(S);
  const ev = S.over ? null : drawEvent(S);
  save();
  modal(`<div class="radio">Vaktlogg · Buøy</div><h2>Dag ${day} er over</h2>
    <div class="logl">${lines.map((l) => `<div class="${l.kind}">${esc(l.t)}</div>`).join('') || '<div>En stille dag. Mistenkelig stille.</div>'}</div>
    <div class="row"><button class="btn" id="ok">${ev ? 'Samband: ny melding' : `Start dag ${S.day}`}</button></div>`);
  $('ok').onclick = () => {
    if (ev) showEvent(ev, after); else after();
  };
  function after() {
    closeModal(); refresh();
    if (S.over) endScreen();
  }
}

function endScreen() {
  const st = S.stats;
  if (S.over === 'won') {
    modal(`<div class="radio">Samband · alle stasjoner</div><h2>Buøy er sikret</h2>
      <p>Fase 1 er fullført på ${S.day - 1} dager. Sperringene holder, kjellerne er (antakelig) tomme, og noen har hengt opp et banner på Obs Bygg: «BUØY: 1 – APOKALYPSEN: 0».</p>
      <div class="metrics"><div class="metric"><div class="k">Zombier ryddet</div><div class="v">${st.kills}</div></div>
      <div class="metric"><div class="k">Ressurser funnet</div><div class="v">${st.found}</div></div>
      <div class="metric"><div class="k">Crew mistet</div><div class="v">${st.lost}</div></div></div>
      <div class="card"><span class="badge lock">Neste: Fase 2</span><h2>Rosenberg Verft</h2>
      <p>Horden på verftet venter. ${S.flags.gann ? 'Skoleskipet Gann ligger klart ved Tømmerodden.' : 'Dere har ingen båt ennå.'} ${S.flags.buss ? 'Kolumbus-bussen på Sørspissen har full tank.' : 'Dere har ikke funnet transport ennå.'}</p></div>
      <div class="row"><button class="btn ghost" id="newr">Ny runde</button><button class="btn" id="cont">Fortsett på Buøy</button></div>`);
    $('cont').onclick = () => { S.over = 'won-seen'; closeModal(); refresh(); };
  } else {
    modal(`<div class="radio">Samband · ingen svar</div><h2>Buøy har falt</h2>
      <p>Crewet er borte. Kaffetrakteren står fortsatt på. Kjell ville ha skrevet et avviksskjema.</p>
      <div class="metrics"><div class="metric"><div class="k">Dager</div><div class="v">${S.day - 1}</div></div>
      <div class="metric"><div class="k">Zombier ryddet</div><div class="v">${st.kills}</div></div>
      <div class="metric"><div class="k">Ressurser funnet</div><div class="v">${st.found}</div></div></div>
      <div class="row"><button class="btn" id="newr">Prøv igjen</button></div>`);
  }
  $('newr').onclick = () => { wipe(); draft.picks = []; titleScreen(); };
}

// ================= OPPSTART =================
$('v-focus').onclick = () => { view = 'focus'; $('v-focus').setAttribute('aria-pressed', 'true'); $('v-all').setAttribute('aria-pressed', 'false'); animateView(MAP.focus); };
$('v-all').onclick = () => { view = 'all'; $('v-all').setAttribute('aria-pressed', 'true'); $('v-focus').setAttribute('aria-pressed', 'false'); animateView(MAP.view); };
$('end').onclick = endDay;
addEventListener('resize', updateScale);

function start(data) {
  buildStaticMap();
  S = data && data.S ? data.S : null;
  if (S) { refresh(); if (S.over === 'won' || S.over === 'dead') endScreen(); }
  else {
    // forhåndsvisning bak tittelskjermen
    previewing = true;
    S = newGame(1234, { name: 'Deg', stats: draft.stats, trait: 'lokalkjent' }, ['mona', 'arild', 'toregil']);
    refresh();
    previewing = false;
    titleScreen();
  }
}
window.claude?.hot?.snapshot?.(() => ({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
