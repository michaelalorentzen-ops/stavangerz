// Kartet: statiske lag (land, bygg, veier, tåke) tegnes én gang,
// sektorer, sperringer og crew tegnes på nytt ved hver endring.
import { AREA, GATE_IDS, gateAlerts, GATES, HQ_SECTOR, isLocked, SECTORS, sectorIntel, toktAvailable, toktDays, TOKTS, ZONES } from '../engine';
import type { CrewMember, SectorId } from '../engine';
import { $, game, KIND_ICON, MAP, ui } from './store';
import type { Selection } from './store';

const NS = 'http://www.w3.org/2000/svg';
const svg = () => $('map') as unknown as SVGSVGElement;
let dyn: SVGGElement;
let vb = MAP.focus.slice() as number[];

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}
function text(parent: Element, attrs: Record<string, string | number>, content: string) {
  el('text', attrs, parent).textContent = content;
}
function onActivate(node: Element, fn: () => void) {
  node.addEventListener('click', fn);
  node.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') fn(); });
}

const toLatLon = (x: number, y: number) => ({ lat: MAP.geo.N - y / 1e5, lon: MAP.geo.W + x / (MAP.geo.KX * 1e5) });
const fromLat = (lat: number) => (MAP.geo.N - lat) * 1e5;
const fromLon = (lon: number) => (lon - MAP.geo.W) * MAP.geo.KX * 1e5;
function dm(v: number, h: string) { const d = Math.floor(v), m = (v - d) * 60; return `${d}°${m.toFixed(1).padStart(4, '0')}′${h}`; }

/** Gradnett med etiketter langs venstre og nedre kant av boksen b. */
function ticks(parent: Element, b: readonly number[], dLat: number, dLon: number, cls: string) {
  const [x, y, w, h] = b, ll0 = toLatLon(x, y + h), ll1 = toLatLon(x + w, y);
  const lats: number[] = [], lons: number[] = [];
  for (let lat = Math.ceil(ll0.lat / dLat) * dLat; lat < ll1.lat; lat += dLat) lats.push(lat);
  for (let lon = Math.ceil(ll0.lon / dLon) * dLon; lon < ll1.lon; lon += dLon) lons.push(lon);
  const g = el('g', { class: cls }, parent);
  const tickStyle = 'font-family:var(--f-mono);letter-spacing:0';
  const pad = cls.includes('far') ? 0 : 14; // etikettene i bykartet plasseres med CSS-skala (--k)
  for (const lat of lats) text(g, { x: x + pad, y: fromLat(lat) - pad / 2, class: `lab zsub ${cls}`, style: tickStyle }, dm(lat, 'N'));
  for (const lon of lons) text(g, { x: fromLon(lon) + pad / 2, y: y + h - pad, class: `lab zsub ${cls}`, style: tickStyle }, dm(lon, 'Ø'));
  return { lats, lons };
}

export function buildStaticMap(onSelect: (s: Selection) => void) {
  const root = svg();
  // B = hele kartet: bykartet hvis det finnes, ellers byøyeutsnittet
  const B = MAP.city?.view ?? MAP.view;
  const [bx, by, bw, bh] = B;
  // tåka i bykartet må dekke hele skjermen også når kartets form er smalere enn vinduet
  const mx = Math.max(bw, bh), my = 1000;
  const [x, y, w, h] = MAP.view;
  const defs = el('defs', {}, root);
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
    <mask id="fogmask"><rect x="${bx - mx - 100}" y="${by - my - 100}" width="${bw + 2 * mx + 200}" height="${bh + 2 * my + 200}" fill="#fff"/>
      ${MAP.sectors.map((s) => `<path d="${s.d}" fill="#000" stroke="#000" stroke-width="40"/>`).join('')}</mask>`;
  el('rect', { x: bx - mx, y: by - 3000, width: bw + 2 * mx, height: bh + 6000, fill: 'var(--sea)' }, root);

  // sjøkartrutenett med ekte koordinater, over hele kartet
  const ll0 = toLatLon(bx, by + bh), ll1 = toLatLon(bx + bw, by);
  const grid = el('g', { stroke: '#132836', 'stroke-width': 2 }, root);
  for (let lat = Math.ceil(ll0.lat / 0.005) * 0.005; lat < ll1.lat; lat += 0.005) el('line', { x1: bx - mx, x2: bx + bw + mx, y1: fromLat(lat), y2: fromLat(lat) }, grid);
  for (let lon = Math.ceil(ll0.lon / 0.01) * 0.01; lon < ll1.lon; lon += 0.01) el('line', { y1: by - 3000, y2: by + bh + 3000, x1: fromLon(lon), x2: fromLon(lon) }, grid);

  const depth = el('g', { fill: 'none', stroke: 'var(--contour)' }, root);
  MAP.depth.forEach((d, i) => el('path', { d, 'stroke-width': 3 - i, 'stroke-opacity': [0.9, 0.55, 0.3][i] }, depth));
  // resten av byen, forenklet og uten bygninger, under det detaljerte byøyeutsnittet
  if (MAP.city) el('path', { d: MAP.city.land, fill: 'var(--land)' }, root);
  el('path', { d: MAP.land, fill: 'var(--land)', stroke: 'var(--land-edge)', 'stroke-width': 2 }, root);
  el('path', { d: MAP.buildings, fill: 'var(--bld)' }, root);
  const road = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  el('path', { ...road, d: MAP.roads.minor, stroke: 'var(--road)', 'stroke-width': 3 }, root);
  el('path', { ...road, d: MAP.roads.major, stroke: 'var(--road-major)', 'stroke-width': 6 }, root);
  if (MAP.city) {
    // hovedveiene for hele byen vises bare i bykartet, med fast strektykkelse på skjermen
    const cr = el('g', { class: 'far cityroads' }, root);
    el('path', { ...road, d: MAP.city.roads.minor, stroke: 'var(--road)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, cr);
    el('path', { ...road, d: MAP.city.roads.major, stroke: 'var(--road-major)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, cr);
  }

  // tåke over alt som ikke er startområdet. Byøyeutsnittet og bykartet har hver sin, fordi en
  // enorm filterflate blir rastret grovere av nettleseren når man zoomer inn på Buøy.
  const fogBoxes: [Record<string, string | number>, string][] = [[{ x: x - 1200, y: y - 1200, width: w + 2400, height: h + 2400 }, 'near']];
  if (MAP.city) fogBoxes.push([{ x: bx - mx, y: by - my, width: bw + 2 * mx, height: bh + 2 * my }, 'far']);
  for (const [b, cls] of fogBoxes) {
    const g = el('g', { class: cls, mask: 'url(#fogmask)' }, root);
    el('rect', { ...b, filter: 'url(#fog)' }, g);
    el('rect', { ...b, fill: '#070d12', 'fill-opacity': 0.2 }, g);
  }

  // bykartet: landet lyses opp over tåka, så fjordene skiller seg fra havet (byøyeutsnittet + resten av byen)
  if (MAP.city) {
    const lit = el('g', { class: 'far', fill: 'var(--land-edge)', 'fill-opacity': 0.55, 'pointer-events': 'none' }, root);
    el('path', { d: MAP.land }, lit);
    el('path', { d: MAP.city.land }, lit);
  }
  // kystlinjen over tåka, så formen på byen synes i bykartet
  if (MAP.city) el('path', { d: MAP.city.coast, class: 'far', fill: 'none', stroke: 'var(--teal)', 'stroke-width': 1.2, 'stroke-opacity': 0.45, 'vector-effect': 'non-scaling-stroke' }, root);
  ticks(root, MAP.view, 0.005, 0.01, 'near');
  if (MAP.city) ticks(root, MAP.city.view, 0.02, 0.05, 'far');

  // fremtidige soner
  const zones = el('g', {}, root);
  for (const z of MAP.zones) {
    const p = el('path', { d: z.d, class: 'zone', 'data-zone': z.id, tabindex: 0, role: 'button', 'aria-label': ZONES[z.id].name }, zones);
    onActivate(p, () => onSelect({ kind: 'zone', id: z.id }));
  }
  for (const z of MAP.zones) {
    const sub = ZONES[z.id].phase ? `Fase ${ZONES[z.id].phase} · ukjent` : 'Ukjent';
    text(zones, { x: z.cx, y: z.cy, class: 'lab zone near', 'text-anchor': 'middle' }, ZONES[z.id].name);
    text(zones, { x: z.cx, y: z.cy + 30, class: 'lab zsub near', 'text-anchor': 'middle' }, sub);
    // i bykartet får de store sonene en etikett som holder fast størrelse på skjermen (se --k i CSS)
    if (z.fx === undefined || z.fy === undefined) continue;
    const far = el('g', { class: `far${z.small ? ' small' : ''}`, transform: `translate(${z.fx} ${z.fy})` }, zones);
    text(far, { class: 'lab zone far', 'text-anchor': 'middle' }, ZONES[z.id].name);
    text(far, { class: 'lab zsub far below', 'text-anchor': 'middle' }, sub);
  }
  if (MAP.city) {
    const [fx, fy, fw, fh] = MAP.focus;
    const g = el('g', { class: 'far', transform: `translate(${fx + fw / 2} ${fy + fh / 2})` }, zones);
    text(g, { class: 'lab zone far home', 'text-anchor': 'middle' }, AREA.name);
  }

  dyn = el('g', {}, root);
  el('rect', { x: x - 3000, y: y - 3000, width: w + 6000, height: h + 6000, fill: 'url(#vign)', 'pointer-events': 'none', class: 'near' }, root);
  setViewBox(vb);
}

function setViewBox(b: number[]) {
  vb = b;
  const s = svg();
  s.setAttribute('viewBox', b.map((n) => n.toFixed(1)).join(' '));
  // bykartet: langt ute er sektoretiketter og crew for små; da vises oversiktslagene i stedet
  s.classList.toggle('city', b[2] > MAP.view[2] * 1.6);
  updateScale();
}

export function animateView(to: readonly number[]) {
  const from = vb.slice(), t0 = performance.now();
  const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
  const step = (t: number) => {
    const k = dur ? Math.min(1, (t - t0) / dur) : 1;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    setViewBox(from.map((v, i) => v + (to[i] - v) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function updateScale() {
  const r = svg().getBoundingClientRect();
  if (!r.width) return;
  const pxPerUnit = Math.min(r.width / vb[2], r.height / vb[3]);
  // --k = kartenheter per skjermpiksel, så etikettene i bykartet kan ha fast størrelse
  svg().style.setProperty('--k', (1 / pxPerUnit).toFixed(2));
  const meters = vb[2] > MAP.view[2] * 1.6 ? 2000 : vb[2] > 2000 ? 500 : 250;
  // én kartenhet er omtrent 1,11 meter
  $('scale').innerHTML = `${meters >= 1000 ? `${meters / 1000} km` : `${meters} m`}<div style="width:${((meters / 1.11) * pxPerUnit).toFixed(0)}px"></div>`;
}

export function renderMap(onSelect: (s: Selection) => void) {
  const S = game(), sel = ui.sel;
  dyn.innerHTML = '';
  const tokensBy: Record<string, CrewMember[]> = {};
  for (const c of S.crew) {
    const t = c.task;
    // poster, istandsetting og reparasjon skjer i HQ-et
    const key = t.type === 'post' || t.type === 'istand' || t.type === 'reparere' ? HQ_SECTOR : !('target' in t) ? 'hjem' : t.type === 'tokt' ? `t_${t.target}` : t.type === 'befeste' || (t.type === 'vakt' && t.target in GATES) ? `g_${t.target}` : t.target;
    (tokensBy[key] ??= []).push(c);
  }
  for (const m of MAP.sectors) {
    const id = m.id;
    const cls = isLocked(S, id) ? 's-lock' : S.sectors[id as SectorId].z > 0 ? 's-inf' : sectorIntel(S, id as SectorId).safe ? 's-safe' : 's-clr';
    const g = el('g', { class: `sector ${cls}${sel.kind === 'sector' && sel.id === id ? ' sel' : ''}`, tabindex: 0, role: 'button', 'aria-label': SECTORS[id].name }, dyn);
    el('path', { d: m.d, class: 'fillbase' }, g);
    el('path', { d: m.d, class: 'edge', 'stroke-linejoin': 'round' }, g);
    onActivate(g, () => onSelect({ kind: 'sector', id }));
  }
  for (const m of MAP.sectors) {
    const mid = { 'text-anchor': 'middle' };
    if (isLocked(S, m.id)) {
      text(dyn, { ...mid, x: m.cx, y: m.cy - 10, class: 'lab big' }, 'HORDE');
      text(dyn, { ...mid, x: m.cx, y: m.cy + 28, class: 'lab' }, SECTORS[m.id].name);
      text(dyn, { ...mid, x: m.cx, y: m.cy + 58, class: 'lab sub inf' }, `Fase ${SECTORS[m.id].opensInPhase}`);
      continue;
    }
    const intel = sectorIntel(S, m.id as SectorId);
    const inf = S.sectors[m.id as SectorId].z > 0;
    text(dyn, { ...mid, x: m.cx, y: m.cy - 40, class: 'lab sub kind' }, KIND_ICON[SECTORS[m.id].kind]);
    text(dyn, { ...mid, x: m.cx, y: m.cy - 6, class: 'lab' }, SECTORS[m.id].short);
    text(dyn, { ...mid, x: m.cx, y: m.cy + 22, class: `lab sub ${inf ? 'inf' : intel.safe ? 'safe' : 'clr'}` }, inf ? `${intel.estimate} Z` : intel.safe ? '✓ Trygg' : `${intel.searched} %`);
    drawTokens(tokensBy[m.id], m.cx, m.cy + 58);
  }
  const alerts = gateAlerts(S);
  for (const id of GATE_IDS) {
    const gd = GATES[id], st = S.gates[id];
    const g = el('g', { class: `gate ${st.level ? 'on' : 'l0'}${sel.kind === 'gate' && sel.id === id ? ' sel' : ''}`, transform: `translate(${gd.x} ${gd.y})`, tabindex: 0, role: 'button', 'aria-label': gd.name }, dyn);
    // portvarsel: en pulserende ring rundt porten, gul når den står ubevoktet, rød når sektoren vokser fra dere
    const alert = alerts.find((a) => a.gate === id);
    if (alert) el('rect', { class: `alertring ${alert.level === 'rød' ? 'rod' : 'gul'}`, x: -60, y: -34, width: 120, height: 68, rx: 12 }, g);
    el('rect', { class: 'box', x: -48, y: -22, width: 96, height: 44, rx: 6 }, g);
    for (let i = 0; i < 3; i++) el('rect', { class: `pip${i < st.level ? ' on' : ''}`, x: -36 + i * 26, y: 4, width: 20, height: 8, rx: 2 }, g);
    text(g, { x: 0, y: -4, 'text-anchor': 'middle' }, st.level ? `Nivå ${st.level}` : 'Åpen');
    onActivate(g, () => onSelect({ kind: 'gate', id }));
    drawTokens(tokensBy[`g_${id}`], gd.x, gd.y + 50);
  }
  drawTokts(onSelect, tokensBy);
  for (const z of MAP.zones) svg().querySelector(`[data-zone="${z.id}"]`)?.classList.toggle('sel', sel.kind === 'zone' && sel.id === z.id);
}

/** Merke ved målet for hvert tokt som er ledig eller ute. Gruppa som er ute vises under merket. */
function drawTokts(onSelect: (s: Selection) => void, tokensBy: Record<string, CrewMember[]>) {
  const S = game();
  for (const d of TOKTS) {
    const active = S.tokts.find((t) => t.id === d.id);
    if (!active && !toktAvailable(S, d)) continue;
    const isGate = d.at in GATES;
    const p = isGate ? GATES[d.at as keyof typeof GATES] : MAP.sectors.find((m) => m.id === d.at)!;
    const x = isGate ? (p as { x: number }).x + 78 : (p as { cx: number }).cx + 90;
    const y = isGate ? (p as { y: number }).y - 34 : (p as { cy: number }).cy - 70;
    const g = el('g', { class: `toktmark${active ? ' out' : ''}`, transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', 'aria-label': `Tokt: ${d.name}` }, dyn);
    el('path', { class: 'flag', d: 'M0 22 V-22 L30 -12 L0 -2' }, g);
    text(g, { x: 14, y: 42, 'text-anchor': 'middle' }, active ? `Dag ${active.stage}/${toktDays(S, d)}` : 'Tokt');
    onActivate(g, () => onSelect(isGate ? { kind: 'gate', id: d.at as keyof typeof GATES } : { kind: 'sector', id: d.at as never }));
    drawTokens(tokensBy[`t_${d.id}`], x + 14, y + 90);
  }
}

function drawTokens(list: CrewMember[] | undefined, cx: number, cy: number) {
  if (!list) return;
  const gap = 46, x0 = cx - ((list.length - 1) * gap) / 2;
  list.forEach((c, i) => {
    const g = el('g', { class: `token t-${c.task.type}${c.hp < 3 ? ' hurt' : ''}`, transform: `translate(${x0 + i * gap} ${cy})`, 'pointer-events': 'none' }, dyn);
    el('circle', { r: 20 }, g);
    text(g, {}, c.name.slice(0, 2));
  });
}
