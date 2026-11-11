import * as maplibre from './vendor/maplibre-gl.mjs';

const WORKER = new URL('vendor/maplibre-gl-worker.mjs', location.href).href;
maplibre.setWorkerUrl(WORKER);

const PALETTE = ['#e0605c', '#4a97dc', '#55ae66', '#e6a436', '#9a70d8', '#37b3ae', '#dc6aa8', '#8ea638', '#c9794a', '#5f6fda'];
const UNASSIGNED = '#8c9190';
const THIN_SHAPE = 7;
const LEVEL_NAME = { 1: 'L1', 2: 'L2', 3: 'L3' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const number = n => Math.round(n).toLocaleString('nb-NO');
const hectares = m2 => (m2 / 1e4).toLocaleString('nb-NO', { maximumFractionDigits: 1 });

const S = {
  rev: '', settings: {}, areas: [], level: 3, active: { 1: null, 2: null, 3: null },
  zones: new Map(), assign: new Map(), cells: new Map(), blocks: new Map(), edges: new Map(), neighbours: new Map(),
  features: new Map(), edgeFeatures: new Map(), loaded: new Set(), undo: [], redo: [], stats: new Map(), colors: new Map(),
  warnings: [], dirty: false, dirtyKeys: new Set(), dirtyZones: false, saving: false, saveTimer: 0, opacity: .45,
  hover: new Set(), hoverKey: null, activeEdges: new Set(), search: '', cut: null, pick: null, gesture: null, ignoreClick: false,
  showLabels: true, mode: 'edit', pois: new Map(), activePoi: null, featureBoxes: new Map(),
  cellStats: new Map(), statFields: null,
};

const map = new maplibre.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      topo: {
        type: 'raster', tileSize: 256, maxzoom: 18,
        tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'],
        attribution: '© Kartverket',
      },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': '#b9cfd8' } },
      { id: 'topo', type: 'raster', source: 'topo', paint: { 'raster-opacity': .85, 'raster-saturation': -.35 } },
    ],
  },
  center: [5.735, 58.998], zoom: 12.6, maxZoom: 20, minZoom: 8,
  dragRotate: false, pitchWithRotate: false, boxZoom: false, doubleClickZoom: false, attributionControl: false,
});
map.touchZoomRotate.disableRotation();
map.addControl(new maplibre.AttributionControl({
  compact: false, customAttribution: '© OpenStreetMap-bidragsytere (ODbL) · © Kartverket, Matrikkelen',
}));
map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');

// ------------------------------------------------------------ hierarchy helpers

const zoneAt = (key, level = S.level) => {
  let zone = S.zones.get(S.assign.get(key));
  while (zone && zone.level > level) zone = S.zones.get(zone.parentId);
  return zone && zone.level === level ? zone : null;
};
const activeZone = () => S.zones.get(S.active[S.level]) ?? null;
const zonesOf = level => [...S.zones.values()].filter(z => z.level === level);
const childrenOf = id => [...S.zones.values()].filter(z => z.parentId === id);
const isLocked = zone => {
  for (let z = zone; z; z = S.zones.get(z.parentId)) if (z.locked) return true;
  return false;
};
function cellsOfZone(id) {
  const zone = S.zones.get(id);
  if (!zone) return [];
  const result = [];
  for (const key of S.cells.keys()) {
    const at = zoneAt(key, zone.level);
    if (at && at.id === id) result.push(key);
  }
  return result;
}
function freshZoneId(level) {
  let n = zonesOf(level).length + 1;
  while (S.zones.has(`z${level}-${String(n).padStart(4, '0')}`)) n++;
  return `z${level}-${String(n).padStart(4, '0')}`;
}

// ------------------------------------------------------------ painting state onto the map

const cellSource = key => `cells-${S.cells.get(key).area}`;
function paintCell(key) {
  const cell = S.cells.get(key);
  if (!cell) return;
  const zone = zoneAt(key);
  const color = zone ? S.colors.get(zone.id) ?? UNASSIGNED : UNASSIGNED;
  if (cell.paint !== color) {
    cell.paint = color;
    map.setFeatureState({ source: cellSource(key), id: key }, { c: color });
  }
}
function edgeWeight(edge) {
  const za = S.assign.get(edge.a), zb = S.assign.get(edge.b);
  if (za === zb) return 0;
  if (!za || !zb) return 1;
  const l2a = S.zones.get(za)?.parentId, l2b = S.zones.get(zb)?.parentId;
  if (l2a === l2b) return 1;
  const l1a = S.zones.get(l2a)?.parentId, l1b = S.zones.get(l2b)?.parentId;
  return l1a === l1b ? 2 : 3;
}
function paintEdge(edge) {
  const w = edgeWeight(edge);
  if (edge.w !== w) {
    edge.w = w;
    map.setFeatureState({ source: edge.source, id: edge.id }, { w });
  }
}
function paintEdgesOf(keys) {
  for (const key of keys) for (const edge of S.neighbours.get(key) ?? []) paintEdge(edge);
}
function paintActiveOutline() {
  const zone = activeZone();
  const next = new Set();
  if (zone) {
    for (const key of cellsOfZone(zone.id)) {
      for (const edge of S.neighbours.get(key) ?? []) {
        const other = edge.a === key ? edge.b : edge.a;
        if (zoneAt(other, zone.level)?.id !== zone.id) next.add(edge.id);
      }
    }
  }
  for (const id of S.activeEdges) if (!next.has(id)) {
    const edge = S.edges.get(id);
    if (edge) map.setFeatureState({ source: edge.source, id }, { a: false });
  }
  for (const id of next) if (!S.activeEdges.has(id)) {
    const edge = S.edges.get(id);
    map.setFeatureState({ source: edge.source, id }, { a: true });
  }
  S.activeEdges = next;
}

/** Neighbouring zones get different colours; a zone keeps its colour unless a new neighbour conflicts. */
function assignColors() {
  const adjacency = new Map();
  for (const zone of zonesOf(S.level)) adjacency.set(zone.id, new Set());
  for (const edge of S.edges.values()) {
    const a = zoneAt(edge.a)?.id, b = zoneAt(edge.b)?.id;
    if (a && b && a !== b) {
      adjacency.get(a)?.add(b);
      adjacency.get(b)?.add(a);
    }
  }
  const order = [...adjacency.keys()].sort((a, b) => adjacency.get(b).size - adjacency.get(a).size || (a < b ? -1 : 1));
  const previous = S.colorMemory ??= new Map();
  const result = new Map();
  for (const id of order) {
    const used = new Set([...adjacency.get(id)].map(n => result.get(n)).filter(Boolean));
    const kept = previous.get(id);
    if (kept && !used.has(kept)) result.set(id, kept);
    else {
      const counts = PALETTE.map(c => [...result.values()].filter(v => v === c).length);
      let best = PALETTE.find(c => !used.has(c));
      for (let i = 0; i < PALETTE.length; i++) {
        if (!used.has(PALETTE[i]) && counts[i] < counts[PALETTE.indexOf(best)]) best = PALETTE[i];
      }
      result.set(id, best ?? PALETTE[0]);
    }
    previous.set(id, result.get(id));
  }
  S.colors = result;
}

function repaintAll() {
  assignColors();
  for (const key of S.cells.keys()) paintCell(key);
  for (const edge of S.edges.values()) paintEdge(edge);
  paintActiveOutline();
}

function setHover(keys, color) {
  for (const key of S.hover) {
    if (!keys.has(key) && S.cells.has(key)) map.setFeatureState({ source: cellSource(key), id: key }, { h: null, hov: false });
  }
  for (const key of keys) map.setFeatureState({ source: cellSource(key), id: key }, { h: color ?? null, hov: true });
  S.hover = keys;
}

// ------------------------------------------------------------ commands and undo

function applyAssign(changes, direction) {
  const touched = [];
  for (const [key, from, to] of changes) {
    if (!S.cells.has(key)) continue;
    const value = direction > 0 ? to : from;
    if (value) S.assign.set(key, value); else S.assign.delete(key);
    S.dirtyKeys.add(key);
    touched.push(key);
  }
  for (const key of touched) paintCell(key);
  paintEdgesOf(touched);
}
function applyZones(list) {
  S.zones = new Map(list.map(z => [z.id, { ...z }]));
  S.dirtyZones = true;
  for (const level of [1, 2, 3]) if (!S.zones.has(S.active[level])) S.active[level] = null;
}
const snapshotZones = () => [...S.zones.values()].map(z => ({ ...z }));
const snapshotPois = () => [...S.pois.values()].map(p => ({ ...p }));
function applyPois(list) {
  S.pois = new Map(list.map(p => [p.id, { ...p }]));
  S.dirtyZones = true;
  if (!S.pois.has(S.activePoi)) S.activePoi = null;
}

function runCommand(command, direction) {
  if (command.t === 'assign') applyAssign(command.changes, direction);
  else if (command.t === 'state') {
    applyZones(direction > 0 ? command.afterZones : command.beforeZones);
    if (command.beforePois) applyPois(direction > 0 ? command.afterPois : command.beforePois);
    applyAssign(command.changes, direction);
    repaintAll();
  }
}
function commit(command) {
  S.undo.push(command);
  S.redo = [];
  changed();
}
function assignCells(keys, target) {
  const changes = [];
  for (const key of keys) {
    const from = S.assign.get(key) ?? null;
    if (from !== target) changes.push([key, from, target]);
  }
  if (!changes.length) return 0;
  const command = { t: 'assign', changes };
  runCommand(command, 1);
  commit(command);
  return changes.length;
}
/** Run a structural change. `fn` edits S.zones in place and may return cell reassignments. */
function structural(fn) {
  const beforeZones = snapshotZones();
  const beforePois = snapshotPois();
  const changes = fn() ?? [];
  const afterZones = snapshotZones();
  const afterPois = snapshotPois();
  const command = { t: 'state', beforeZones, afterZones, beforePois, afterPois, changes };
  applyZones(afterZones);
  applyPois(afterPois);
  applyAssign(changes, 1);
  repaintAll();
  commit(command);
}

async function undoRedo(direction) {
  const from = direction < 0 ? S.undo : S.redo;
  const to = direction < 0 ? S.redo : S.undo;
  const command = from.pop();
  if (!command) return;
  if (command.t === 'cut') {
    try {
      if (direction < 0) await performCutUndo(command);
      else await performCut(command.line, command);
    } catch (error) {
      toast(error.message, true);
      from.push(command);
      return;
    }
    to.push(command);
    changed();
    return;
  }
  runCommand(command, direction);
  to.push(command);
  changed();
}

function changed() {
  S.dirty = true;
  scheduleSave();
  scheduleDerived();
  $('undo').disabled = !S.undo.length;
  $('redo').disabled = !S.redo.length;
}

// ------------------------------------------------------------ saving and outside changes

function setStatus(text, error = false) {
  $('save-status').textContent = text;
  $('save-status').classList.toggle('error', error);
}
function scheduleSave() {
  setStatus('Lagrer …');
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(save, 500);
}
function payload() {
  return { baseRev: S.rev, zones: snapshotZones(), pois: snapshotPois(), assignments: Object.fromEntries(S.assign) };
}
async function api(path, body) {
  const response = await fetch(path, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `Feil ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
async function save() {
  if (S.saving) return scheduleSave();
  clearTimeout(S.saveTimer);
  S.saving = true;
  const sentKeys = new Set(S.dirtyKeys);
  try {
    const result = await api('/api/project', payload());
    S.rev = result.rev;
    S.dirty = false;
    for (const key of sentKeys) S.dirtyKeys.delete(key);
    S.dirtyZones = false;
    setStatus('Lagret');
  } catch (error) {
    if (error.status === 409) {
      await pullOutsideChanges(true);
    } else {
      setStatus('Ikke lagret. Prøver igjen', true);
      S.saveTimer = setTimeout(save, 3000);
    }
  } finally {
    S.saving = false;
    if (S.dirtyKeys.size || S.dirtyZones) scheduleSave();
  }
}
async function flushSave() {
  clearTimeout(S.saveTimer);
  while (S.saving) await new Promise(r => setTimeout(r, 30));
  if (S.dirty) await save();
}

/** Someone else, usually Claude, changed project.json. It arrives as one step that Ctrl+Z can take back. */
async function pullOutsideChanges(keepLocal = false, message = 'Prosjektet ble endret utenfor editoren og er lastet inn. Ctrl+Z angrer.') {
  const state = await api('/api/state');
  const beforeZones = snapshotZones();
  const beforePois = snapshotPois();
  const incoming = new Map(Object.entries(state.project.assignments));
  const changes = [];
  const seen = new Set();
  for (const [key, value] of S.assign) {
    seen.add(key);
    if (keepLocal && S.dirtyKeys.has(key)) continue;
    const next = incoming.get(key) ?? null;
    if (next !== value) changes.push([key, value, next]);
  }
  for (const [key, value] of incoming) {
    if (!seen.has(key) && !(keepLocal && S.dirtyKeys.has(key))) changes.push([key, null, value]);
  }
  let zones = state.project.zones;
  if (keepLocal && S.dirtyZones) {
    const ids = new Set(beforeZones.map(z => z.id));
    zones = [...beforeZones, ...zones.filter(z => !ids.has(z.id))];
  }
  S.rev = state.rev;
  S.settings = state.project.settings;
  S.areas = state.project.areas;
  await loadMissingAreas();
  let pois = state.project.pois ?? [];
  if (keepLocal && S.dirtyZones) {
    const ids = new Set(beforePois.map(p => p.id));
    pois = [...beforePois, ...pois.filter(p => !ids.has(p.id))];
  }
  const command = { t: 'state', beforeZones, afterZones: zones, beforePois, afterPois: pois, changes };
  const hadLocal = S.dirtyZones || S.dirtyKeys.size;
  applyZones(zones);
  applyPois(pois);
  S.dirtyZones = keepLocal && hadLocal ? S.dirtyZones : false;
  applyAssign(changes, 1);
  if (!keepLocal) S.dirtyKeys.clear();
  repaintAll();
  S.undo.push(command);
  S.redo = [];
  scheduleDerived();
  renderAreas();
  toast(message);
  if (keepLocal) scheduleSave();
  else { S.dirty = false; setStatus('Lagret'); }
}
setInterval(async () => {
  if (S.dirty || S.saving || !S.rev || S.busyCut) return;
  try {
    const { rev } = await api('/api/revision');
    if (rev !== S.rev && !S.dirty) await pullOutsideChanges(false);
  } catch { setStatus('Mistet kontakt med serveren', true); }
}, 3000);

// ------------------------------------------------------------ derived numbers and warnings

let derivedTimer = 0;
function scheduleDerived() {
  clearTimeout(derivedTimer);
  derivedTimer = setTimeout(refreshDerived, 80);
}
function refreshDerived() {
  const before = JSON.stringify([...S.colors]);
  assignColors();
  if (before !== JSON.stringify([...S.colors])) for (const key of S.cells.keys()) paintCell(key);
  computeStats();
  computeWarnings();
  paintActiveOutline();
  renderList();
  renderActive();
  renderWarnings();
  renderLabels();
  renderPois();
}
function computeStats() {
  const stats = new Map();
  for (const zone of S.zones.values()) {
    stats.set(zone.id, { buildings: 0, area: 0, cells: 0, coast: 0, inland: 0, sumX: 0, sumY: 0, weight: 0, minX: 180, maxX: -180, minY: 90, maxY: -90, members: [] });
  }
  for (const [key, cell] of S.cells) {
    let zone = S.zones.get(S.assign.get(key));
    while (zone) {
      const s = stats.get(zone.id);
      s.buildings += cell.n;
      s.area += cell.a;
      s.cells++;
      s.coast += S.cellStats.get(key)?.[8] ?? 0;
      const w = Math.max(cell.a, 1);
      s.sumX += cell.x * w;
      s.sumY += cell.y * w;
      s.weight += w;
      s.minX = Math.min(s.minX, cell.x); s.maxX = Math.max(s.maxX, cell.x);
      s.minY = Math.min(s.minY, cell.y); s.maxY = Math.max(s.maxY, cell.y);
      if (zone.level === S.level) s.members.push(key);
      zone = S.zones.get(zone.parentId);
    }
  }
  for (const edge of S.edges.values()) {
    const a = S.assign.get(edge.a), b = S.assign.get(edge.b);
    if (a !== b) {
      if (a) stats.get(a) && (stats.get(a).inland += edge.l);
      if (b) stats.get(b) && (stats.get(b).inland += edge.l);
    }
  }
  S.stats = stats;
}
/** Connected groups of the given cells, following shared borders. */
function components(keys) {
  const members = new Set(keys);
  const seen = new Set();
  const groups = [];
  for (const start of keys) {
    if (seen.has(start)) continue;
    const group = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const key = stack.pop();
      group.push(key);
      for (const edge of S.neighbours.get(key) ?? []) {
        const other = edge.a === key ? edge.b : edge.a;
        if (members.has(other) && !seen.has(other)) {
          seen.add(other);
          stack.push(other);
        }
      }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}
/** The zone sharing the longest border with these cells. */
/** Give each cell of a zone to the neighbour it shares most border with, working inward from the edge. */
function dissolveZone(zoneId) {
  const zone = S.zones.get(zoneId);
  const left = new Set(cellsOfZone(zoneId));
  const target = new Map();
  const ownerOf = key => target.get(key) ?? (left.has(key) ? null : S.assign.get(key));
  while (left.size) {
    let best = null;
    for (const key of left) {
      const score = new Map();
      for (const edge of S.neighbours.get(key) ?? []) {
        const owner = ownerOf(edge.a === key ? edge.b : edge.a);
        const other = owner && S.zones.get(owner);
        if (!other || owner === zoneId || isLocked(other)) continue;
        score.set(owner, (score.get(owner) ?? 0) + edge.l * (other.parentId === zone.parentId ? 2 : 1));
      }
      for (const [owner, value] of score) if (!best || value > best.value) best = { key, owner, value };
    }
    if (!best) break;
    target.set(best.key, best.owner);
    left.delete(best.key);
  }
  if (left.size) return toast('Noen celler har ingen nabo å gå til. Flytt dem for hånd.', true);
  const changes = [...target].map(([key, owner]) => [key, zoneId, owner]);
  structural(() => { S.zones.delete(zoneId); return changes; });
  toast(`${zone.name} er fordelt på ${new Set(target.values()).size} nabosoner. Ctrl+Z angrer.`);
}
function bestNeighbour(keys, own) {
  const members = new Set(keys);
  const scores = new Map();
  for (const key of keys) {
    for (const edge of S.neighbours.get(key) ?? []) {
      const other = edge.a === key ? edge.b : edge.a;
      const zone = S.assign.get(other);
      if (!members.has(other) && zone && zone !== own && !isLocked(S.zones.get(zone))) scores.set(zone, (scores.get(zone) ?? 0) + edge.l);
    }
  }
  return [...scores].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
function computeWarnings() {
  const warnings = [];
  const members = new Map();
  for (const [key, zoneId] of S.assign) {
    if (S.cells.has(key)) (members.get(zoneId) ?? members.set(zoneId, []).get(zoneId)).push(key);
  }
  const unassigned = [...S.cells.keys()].filter(k => !S.zones.has(S.assign.get(k)));
  if (unassigned.length) {
    warnings.push({ rank: 0, text: `${number(unassigned.length)} celler uten sone`, keys: unassigned, detail: 'Kommer ikke med i eksporten' });
  }
  const { minBuildings = 100, maxBuildings = 450 } = S.settings;
  for (const zone of zonesOf(3)) {
    const keys = members.get(zone.id) ?? [];
    const stat = S.stats.get(zone.id);
    if (!keys.length) {
      warnings.push({ rank: 4, text: `${zone.name} er tom`, zone: zone.id, keys: [] });
      continue;
    }
    if (!zone.parentId || !S.zones.has(zone.parentId)) {
      warnings.push({ rank: 1, text: `${zone.name} ligger ikke i noen L2`, zone: zone.id, keys });
    }
    const groups = components(keys);
    for (const group of groups.slice(1)) {
      const hasNeighbour = group.some(k => (S.neighbours.get(k) ?? []).length);
      if (!hasNeighbour) continue;
      const count = group.reduce((sum, k) => sum + S.cells.get(k).n, 0);
      const target = bestNeighbour(group, zone.id);
      warnings.push({
        rank: 1, text: `Løsrevet bit av ${zone.name}`, detail: `${group.length} celler, ${count} bygg`, zone: zone.id, keys: group,
        fix: target ? { label: 'Gi til nabo', target, keys: group } : null,
      });
    }
    const neighbours = new Set();
    for (const key of keys) for (const edge of S.neighbours.get(key) ?? []) {
      const other = S.assign.get(edge.a === key ? edge.b : edge.a);
      if (other && other !== zone.id) neighbours.add(other);
    }
    if (neighbours.size === 1 && stat.coast < 20) {
      const outer = S.zones.get([...neighbours][0]);
      warnings.push({
        rank: 2, text: `${zone.name} er en øy inni ${outer.name}`, zone: zone.id, keys,
        fix: isLocked(outer) ? null : { label: 'Slå sammen', target: outer.id, keys, removeZone: zone.id },
      });
    }
    const sides = new Set();
    for (const key of keys) if (S.cells.get(key).s) sides.add(S.cells.get(key).s);
    if (sides.size > 1) warnings.push({ rank: 2, text: `${zone.name} krysser hovedveien`, detail: 'Ligger på begge sider av Hundvåg ring', zone: zone.id, keys });
    // A long strip along the shore: much coast, a long land border and little depth behind it.
    if (stat.inland > 1200 && stat.coast > .5 * stat.inland && stat.area / stat.inland < 100) {
      warnings.push({ rank: 3, text: `${zone.name} er en lang kyststripe`, detail: `ca. ${Math.round(stat.area / stat.inland)} m dyp`, zone: zone.id, keys,
        fix: isLocked(zone) ? null : { label: 'Fordel på naboene', dissolve: zone.id, keys } });
    }
    const shape = stat.inland * stat.inland / Math.max(4 * Math.PI * stat.area, 1);
    if (shape > THIN_SHAPE) warnings.push({ rank: 3, text: `${zone.name} har en smal eller kroket form`, zone: zone.id, keys });
    if (stat.buildings > maxBuildings) warnings.push({ rank: 3, text: `${zone.name} er stor`, detail: `${number(stat.buildings)} bygg, mål ${maxBuildings} eller færre`, zone: zone.id, keys });
    if (stat.buildings < minBuildings && stat.area < 200000) warnings.push({ rank: 3, text: `${zone.name} er liten`, detail: `${number(stat.buildings)} bygg`, zone: zone.id, keys });
  }
  S.warnings = warnings.sort((a, b) => a.rank - b.rank).slice(0, 300);
}

// ------------------------------------------------------------ side panel

function renderList() {
  const query = S.search.trim().toLocaleLowerCase('nb');
  const warned = new Set(S.warnings.filter(w => w.zone && w.rank < 3).map(w => w.zone));
  const max = S.level === 3 ? Math.max(S.settings.maxBuildings ?? 450, 1) : 0;
  const row = zone => {
    const stat = S.stats.get(zone.id) ?? { buildings: 0 };
    const flag = S.mode === 'content' ? contentFlag(zone)
      : isLocked(zone) ? '<span class="flags" title="Låst">🔒</span>' : warned.has(zone.id) ? '<span class="flags warn" title="Har noe å se på">●</span>' : '<span class="flags"></span>';
    const fill = max ? Math.min(100, 100 * stat.buildings / max) : 0;
    const meter = max ? `<span class="meter"><i class="${stat.buildings > max ? 'over' : ''}" style="width:${fill}%"></i></span>` : '';
    return `<button class="zone ${S.active[S.level] === zone.id ? 'on' : ''}" data-zone="${esc(zone.id)}" role="option" aria-selected="${S.active[S.level] === zone.id}">
      <span class="swatch" style="background:${S.colors.get(zone.id) ?? UNASSIGNED}"></span>
      <span class="name">${esc(zone.name)}</span><span class="count">${number(stat.buildings)}</span>${flag}${meter}</button>`;
  };
  const matching = zonesOf(S.level).filter(z => !query || z.name.toLocaleLowerCase('nb').includes(query));
  const sorted = list => list.sort((a, b) => a.name.localeCompare(b.name, 'nb', { numeric: true }));
  let html = '';
  if (S.level === 1) html = sorted(matching).map(row).join('');
  else {
    const groups = new Map();
    for (const zone of matching) {
      const parent = S.zones.has(zone.parentId) ? zone.parentId : '';
      (groups.get(parent) ?? groups.set(parent, []).get(parent)).push(zone);
    }
    const order = [...groups.keys()].sort((a, b) => (S.zones.get(a)?.name ?? '￿').localeCompare(S.zones.get(b)?.name ?? '￿', 'nb'));
    for (const parent of order) {
      const stat = S.stats.get(parent);
      html += `<div class="group"><span>${esc(S.zones.get(parent)?.name ?? 'Uten overordnet')}</span><span>${stat ? `${number(stat.buildings)} bygg` : ''}</span></div>`;
      html += sorted(groups.get(parent)).map(row).join('');
    }
  }
  const list = $('zone-list');
  const scroll = list.scrollTop;
  list.innerHTML = html || '<p class="hint" style="padding:12px">Ingen soner her ennå. Trykk + Ny.</p>';
  list.scrollTop = scroll;
}
function renderActive() {
  const zone = activeZone();
  renderSheet();
  $('active-card').hidden = !zone || S.mode === 'content';
  if (!zone) return;
  const stat = S.stats.get(zone.id) ?? { buildings: 0, area: 0, cells: 0 };
  $('active-swatch').style.background = S.colors.get(zone.id) ?? UNASSIGNED;
  if (document.activeElement !== $('active-name')) $('active-name').value = zone.name;
  $('active-lock').textContent = zone.locked ? '🔒' : '🔓';
  $('active-lock').setAttribute('aria-pressed', String(!!zone.locked));
  const parent = S.zones.get(zone.parentId);
  $('active-stats').textContent = `${number(stat.buildings)} bygg · ${hectares(stat.area)} ha · ${number(stat.cells)} celler${parent ? ` · i ${parent.name}` : ''}`;
  $('active-propose').hidden = zone.level !== 2;
  $('active-merge').disabled = !!zone.locked;
  $('active-delete').disabled = !!zone.locked;
}
function renderWarnings() {
  const count = S.warnings.length;
  $('warning-count').textContent = count;
  $('warning-count').classList.toggle('has', S.warnings.some(w => w.rank < 3));
  if ($('warnings-toggle').getAttribute('aria-expanded') !== 'true') { $('warning-list').hidden = true; return; }
  $('warning-list').hidden = false;
  $('warning-list').innerHTML = S.warnings.map((w, i) => `<div class="warning"><button data-warning="${i}">${esc(w.text)}${w.detail ? `<small>${esc(w.detail)}</small>` : ''}</button>${w.fix ? `<button class="fix" data-fix="${i}">${esc(w.fix.label)}</button>` : ''}</div>`).join('');
}
function renderAreas() {
  $('area-list').innerHTML = S.areas.map(area => {
    const c = area.counts ?? {};
    return `<div class="area-row"><strong>${esc(area.name)}</strong><button data-area="${esc(area.id)}">Vis</button>
      <small>${number(c.cells ?? 0)} celler · ${number(c.buildings ?? 0)} bygg · ${String(c.km2 ?? 0).replace('.', ',')} km²</small></div>`;
  }).join('');
}

// ------------------------------------------------------------ zone labels

const labelNodes = new Map();
function zoneLabelPoint(stat) {
  const x = stat.sumX / stat.weight, y = stat.sumY / stat.weight;
  let best = null, distance = Infinity;
  for (const key of stat.members) {
    const cell = S.cells.get(key);
    const d = (cell.x - x) ** 2 * .27 + (cell.y - y) ** 2 - Math.min(cell.a, 40000) * 1e-13;
    if (d < distance) { distance = d; best = cell; }
  }
  return best ? [best.x, best.y] : [x, y];
}
function renderLabels() {
  const host = $('labels');
  const zoom = map.getZoom();
  const show = S.showLabels ? zonesOf(S.level).filter(z => (S.stats.get(z.id)?.cells ?? 0) > 0) : [];
  const keep = new Set();
  const bounds = map.getBounds();
  const small = S.level === 3 && zoom < 12;
  for (const zone of small ? [] : show) {
    const stat = S.stats.get(zone.id);
    if (!stat.members.length) continue;
    if (!stat.point || stat.pointFor !== stat.members.length) { stat.point = zoneLabelPoint(stat); stat.pointFor = stat.members.length; }
    const [x, y] = stat.point;
    if (!bounds.contains([x, y])) continue;
    keep.add(zone.id);
    let node = labelNodes.get(zone.id);
    if (!node) {
      node = document.createElement('div');
      host.appendChild(node);
      labelNodes.set(zone.id, node);
    }
    node.className = `label ${S.active[S.level] === zone.id ? 'on' : ''}`;
    const hq = hqCount(zone.id) ? '★ ' : '';
    const kind = S.mode === 'content' && zone.level === 3 ? typeLabel(zone.type) : `${number(stat.buildings)} bygg`;
    const text = `${hq}${esc(zone.name)}<small>${esc(kind)}</small>`;
    if (node.dataset.text !== text) { node.innerHTML = text; node.dataset.text = text; }
    const point = map.project([x, y]);
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
  }
  for (const [id, node] of labelNodes) if (!keep.has(id)) { node.remove(); labelNodes.delete(id); }
}

// ------------------------------------------------------------ loading areas

function fillPaint() {
  return {
    'fill-color': ['to-color', ['coalesce', ['feature-state', 'h'], ['feature-state', 'c'], UNASSIGNED]],
    'fill-opacity': ['case', ['boolean', ['feature-state', 'hov'], false], Math.min(.9, S.opacity + .3), S.opacity],
  };
}
function firstOverlay() {
  return map.getLayer('cut-line') ? 'cut-line' : undefined;
}
function addCellRecord(feature) {
  const p = feature.properties;
  S.features.set(p.k, feature);
  S.cells.set(p.k, { ...p });
  (S.blocks.get(p.b) ?? S.blocks.set(p.b, new Set()).get(p.b)).add(p.k);
  if (!S.neighbours.has(p.k)) S.neighbours.set(p.k, []);
}
function removeCellRecord(key) {
  const cell = S.cells.get(key);
  if (!cell) return;
  S.blocks.get(cell.b)?.delete(key);
  S.cells.delete(key);
  S.features.delete(key);
  S.neighbours.delete(key);
}
function addEdgeRecord(feature, source) {
  const p = feature.properties;
  const edge = { id: p.i, a: p.a, b: p.b, l: p.l, source, w: 0 };
  S.edges.set(edge.id, edge);
  S.edgeFeatures.set(edge.id, feature);
  for (const key of [edge.a, edge.b]) (S.neighbours.get(key) ?? S.neighbours.set(key, []).get(key)).push(edge);
}
function removeEdgeRecord(id) {
  const edge = S.edges.get(id);
  if (!edge) return;
  for (const key of [edge.a, edge.b]) {
    const list = S.neighbours.get(key);
    if (list) S.neighbours.set(key, list.filter(e => e.id !== id));
  }
  S.edges.delete(id);
  S.edgeFeatures.delete(id);
  S.activeEdges.delete(id);
}
async function loadArea(area) {
  const [cells, edges, buildings, roads] = await Promise.all(['cells', 'edges', 'buildings', 'roads']
    .map(name => fetch(`/api/areas/${area.id}/${name}`).then(r => r.json())));
  const id = area.id;
  cells.features.forEach(addCellRecord);
  map.addSource(`cells-${id}`, { type: 'geojson', data: cells, promoteId: 'k', tolerance: .2, buffer: 8 });
  map.addSource(`edges-${id}`, { type: 'geojson', data: edges, promoteId: 'i', tolerance: .2, buffer: 8 });
  map.addSource(`buildings-${id}`, { type: 'geojson', data: buildings, tolerance: .3 });
  map.addSource(`roads-${id}`, { type: 'geojson', data: roads, tolerance: .3 });
  const before = firstOverlay();
  map.addLayer({ id: `fill-${id}`, type: 'fill', source: `cells-${id}`, paint: fillPaint() }, before);
  map.addLayer({
    id: `roads-${id}`, type: 'line', source: `roads-${id}`, minzoom: 12,
    layout: { visibility: $('layer-basemap').checked ? 'none' : 'visible' },
    paint: { 'line-color': '#6f6a5f', 'line-width': ['match', ['get', 'c'], 'street', 1.2, .5] },
  }, before);
  map.addLayer({
    id: `buildings-${id}`, type: 'fill', source: `buildings-${id}`, minzoom: 13,
    layout: { visibility: $('layer-buildings').checked ? 'visible' : 'none' },
    paint: { 'fill-color': '#3a3f3e', 'fill-opacity': .55 },
  }, before);
  map.addLayer({
    id: `cell-line-${id}`, type: 'line', source: `cells-${id}`, minzoom: 14,
    layout: { visibility: $('layer-cells').checked ? 'visible' : 'none' },
    paint: { 'line-color': '#ffffff', 'line-opacity': .55, 'line-width': .6 },
  }, before);
  map.addLayer({
    id: `border-${id}`, type: 'line', source: `edges-${id}`,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['boolean', ['feature-state', 'a'], false], '#f7c978', '#12232c'],
      'line-width': ['case', ['boolean', ['feature-state', 'a'], false], 4,
        ['match', ['coalesce', ['feature-state', 'w'], 0], 1, 1.8, 2, 3.2, 3, 4.5, 0]],
      'line-opacity': ['match', ['coalesce', ['feature-state', 'w'], 0], 0, ['case', ['boolean', ['feature-state', 'a'], false], 1, 0], 1],
    },
  }, before);
  edges.features.forEach(f => addEdgeRecord(f, `edges-${id}`));
  S.loaded.add(id);
  await loadCellStats(id);
}
async function loadMissingAreas() {
  const missing = S.areas.filter(a => a.status === 'ready' && !S.loaded.has(a.id));
  for (const area of missing) await loadArea(area);
  if (missing.length) renderAreas();
}
const fillLayers = () => [...S.loaded].map(id => `fill-${id}`);
function refreshAreaSources(areaId) {
  const cells = [...S.features.values()].filter(f => f.properties.area === areaId);
  map.getSource(`cells-${areaId}`).setData({ type: 'FeatureCollection', features: cells });
  const source = `edges-${areaId}`;
  const edges = [...S.edges.values()].filter(e => e.source === source).map(e => S.edgeFeatures.get(e.id));
  map.getSource(source).setData({ type: 'FeatureCollection', features: edges });
}

function fitKeys(keys, maxZoom = 16.5) {
  if (!keys.length) return;
  let w = 180, e = -180, s = 90, n = -90;
  for (const key of keys) {
    const c = S.cells.get(key);
    if (!c) continue;
    w = Math.min(w, c.x); e = Math.max(e, c.x); s = Math.min(s, c.y); n = Math.max(n, c.y);
  }
  map.fitBounds([[w, s], [e, n]], { padding: 90, maxZoom, duration: 450 });
}

// ------------------------------------------------------------ pointer: what a click would change

function keyAt(point) {
  const hits = map.queryRenderedFeatures(point, { layers: fillLayers() });
  return hits[0]?.properties?.k ?? null;
}
/** Cells a click would move at this level. At L2 and L1 the whole child zone moves. */
function clickTargets(key, single) {
  if (S.level !== 3) {
    const child = zoneAt(key, S.level + 1);
    return child ? new Set(cellsOfZone(child.id)) : new Set();
  }
  if (single) return new Set([key]);
  return new Set(S.blocks.get(S.cells.get(key).b) ?? [key]);
}
function movable(keys, target) {
  const result = [];
  for (const key of keys) {
    const zone = S.zones.get(S.assign.get(key));
    if (zone && zone.id === target) continue;
    if (zone && isLocked(zone)) continue;
    result.push(key);
  }
  return result;
}
function tooltipAt(point, html) {
  const tip = $('tooltip');
  if (!html) { tip.hidden = true; return; }
  tip.hidden = false;
  tip.innerHTML = html;
  const stage = $('stage').getBoundingClientRect();
  const x = Math.min(point.x + 16, stage.width - tip.offsetWidth - 8);
  const y = Math.min(point.y + 16, stage.height - tip.offsetHeight - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
function hoverAt(point, event) {
  if (S.cut || S.pick) { setHover(new Set()); return tooltipAt(point, null); }
  if (S.mode === 'content') return contentHover(point);
  const key = keyAt(point);
  S.hoverKey = key;
  if (!key) { setHover(new Set()); return tooltipAt(point, null); }
  const active = activeZone();
  const under = zoneAt(key);
  if (!active || event.altKey) {
    const keys = under ? new Set(cellsOfZone(under.id)) : new Set([key]);
    setHover(keys);
    return tooltipAt(point, `${under ? `Klikk for å velge <b>${esc(under.name)}</b>` : 'Celle uten sone'}<small>Velg en sone for å flytte områder</small>`);
  }
  if (isLocked(active)) { setHover(new Set()); return tooltipAt(point, `<b>${esc(active.name)}</b> er låst`); }
  if (S.level === 3) {
    const keys = movable(clickTargets(key, event.shiftKey), active.id);
    setHover(new Set(keys), S.colors.get(active.id));
    if (!keys.length) return tooltipAt(point, under?.id === active.id ? null : 'Låst område');
    const sources = new Map();
    let buildings = 0;
    for (const k of keys) {
      const cell = S.cells.get(k);
      buildings += cell.n;
      const name = zoneAt(k)?.name ?? 'uten sone';
      sources.set(name, (sources.get(name) ?? 0) + cell.n);
    }
    const from = [...sources].map(([name, n]) => `${esc(name)} −${n}`).join(', ');
    return tooltipAt(point, `<b>${keys.length === 1 ? 'Tomt' : 'Kvartal'}</b> til ${esc(active.name)}: +${buildings} bygg<small>${from}</small>`);
  }
  const child = zoneAt(key, S.level + 1);
  if (!child) { setHover(new Set()); return tooltipAt(point, null); }
  const current = S.zones.get(child.parentId);
  const keys = current?.id === active.id ? new Set() : new Set(cellsOfZone(child.id));
  setHover(keys, S.colors.get(active.id));
  tooltipAt(point, current?.id === active.id ? null : `<b>${esc(child.name)}</b> til ${esc(active.name)}<small>Fra ${esc(current?.name ?? 'ingen')}</small>`);
}

function clickAt(event) {
  if (S.mode === 'content') return contentClick(event);
  const key = keyAt(event.point);
  if (!key) return;
  const active = activeZone();
  const altKey = event.originalEvent.altKey;
  if (!active || altKey) {
    const under = zoneAt(key);
    if (under) setActive(under.id);
    return;
  }
  if (isLocked(active)) return toast(`${active.name} er låst`, true);
  if (S.level === 3) {
    assignCells(movable(clickTargets(key, event.originalEvent.shiftKey), active.id), active.id);
  } else {
    const child = zoneAt(key, S.level + 1);
    if (child && child.parentId !== active.id) {
      if (isLocked(child)) return toast(`${child.name} er låst`, true);
      structural(() => { S.zones.get(child.id).parentId = active.id; });
    }
  }
  setHover(new Set());
  S.lastPointer && hoverAt(S.lastPointer.point, S.lastPointer.event);
}

function setActive(id) {
  S.active[S.level] = id;
  paintActiveOutline();
  renderList();
  renderActive();
  renderLabels();
}
function setLevel(level) {
  S.level = level;
  for (const button of $('levels').children) button.classList.toggle('on', Number(button.dataset.level) === level);
  S.colorMemory = null;
  setHover(new Set());
  repaintAll();
  computeStats();
  renderList();
  renderActive();
  renderLabels();
}

// ------------------------------------------------------------ gestures: paint, lasso, rectangle

function stagePoint(event) {
  const rect = map.getCanvasContainer().getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function drawLasso(points) {
  $('lasso').firstElementChild.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
}
function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const container = map.getCanvasContainer();
container.addEventListener('mousedown', event => {
  if (event.button !== 0) return;
  if (S.pick?.kind === 'rect') {
    map.dragPan.disable();
    S.gesture = { kind: 'rect', start: stagePoint(event) };
    return;
  }
  if (S.cut || S.mode === 'content') return;
  if (event.ctrlKey || event.metaKey) {
    const active = activeZone();
    if (S.level !== 3 || !active) return toast('Velg en L3-sone først');
    map.dragPan.disable();
    S.gesture = { kind: 'lasso', points: [stagePoint(event)] };
  } else if (event.shiftKey) {
    const active = activeZone();
    if (S.level !== 3 || !active) return toast('Velg en L3-sone først');
    if (isLocked(active)) return toast(`${active.name} er låst`, true);
    map.dragPan.disable();
    S.gesture = { kind: 'paint', changes: new Map() };
    paintStroke(stagePoint(event));
  }
}, true);
function paintStroke(point) {
  const active = activeZone();
  const key = keyAt([point.x, point.y]);
  if (!key || S.gesture.changes.has(key)) return;
  const [movableKey] = movable([key], active.id);
  if (!movableKey) return;
  const from = S.assign.get(key) ?? null;
  S.gesture.changes.set(key, from);
  applyAssign([[key, from, active.id]], 1);
}
window.addEventListener('mousemove', event => {
  const gesture = S.gesture;
  if (!gesture) return;
  const point = stagePoint(event);
  if (gesture.kind === 'paint') paintStroke(point);
  else if (gesture.kind === 'lasso') {
    gesture.points.push(point);
    drawLasso(gesture.points);
  } else if (gesture.kind === 'rect') {
    gesture.end = point;
    const { start: a } = gesture;
    drawLasso([a, { x: point.x, y: a.y }, point, { x: a.x, y: point.y }]);
  }
});
window.addEventListener('mouseup', () => {
  const gesture = S.gesture;
  if (!gesture) return;
  S.gesture = null;
  map.dragPan.enable();
  drawLasso([]);
  S.ignoreClick = true;
  setTimeout(() => { S.ignoreClick = false; }, 50);
  if (gesture.kind === 'paint') {
    const active = activeZone();
    const changes = [...gesture.changes].map(([key, from]) => [key, from, active.id]);
    if (changes.length) commit({ t: 'assign', changes });
  } else if (gesture.kind === 'lasso' && gesture.points.length > 4) {
    const active = activeZone();
    if (isLocked(active)) return toast(`${active.name} er låst`, true);
    const inside = [];
    for (const [key, cell] of S.cells) {
      const p = map.project([cell.x, cell.y]);
      if (pointInPolygon(p, gesture.points)) inside.push(key);
    }
    const moved = assignCells(movable(inside, active.id), active.id);
    if (moved) toast(`${moved} celler flyttet til ${active.name}`);
  } else if (gesture.kind === 'rect' && gesture.end) {
    finishRectangle(gesture.start, gesture.end);
  }
});

let hoverFrame = 0;
map.on('mousemove', event => {
  S.lastPointer = { point: event.point, event: event.originalEvent };
  if (S.gesture) return;
  cancelAnimationFrame(hoverFrame);
  hoverFrame = requestAnimationFrame(() => hoverAt(event.point, event.originalEvent));
});
map.getCanvas().addEventListener('mouseleave', () => {
  setHover(new Set());
  $('tooltip').hidden = true;
});
map.on('click', event => {
  if (S.ignoreClick) return;
  if (S.cut) return addCutPoint(event.lngLat);
  if (S.pick?.kind === 'poi') return placePoi(event);
  if (!S.pick) clickAt(event);
});
map.on('contextmenu', () => { if (S.cut) removeCutPoint(); });
map.on('move', () => { for (const [id, node] of labelNodes) {
  const stat = S.stats.get(id);
  if (stat?.point) {
    const point = map.project(stat.point);
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
  }
} });
map.on('moveend', renderLabels);

// ------------------------------------------------------------ smart cut

function setCutData() {
  const points = S.cut?.points ?? [];
  map.getSource('cut-points').setData({ type: 'FeatureCollection', features: points.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} })) });
  map.getSource('cut-line').setData(S.cut?.line ? { type: 'Feature', geometry: S.cut.line, properties: {} } : { type: 'FeatureCollection', features: [] });
}
function startCut() {
  if (S.cut) return cancelCut();
  if (S.mode === 'content') return toast('Smart kutt finnes i Grenser-modus');
  cancelPick();
  S.cut = { points: [], line: null, request: 0 };
  $('stage').classList.add('cutting');
  $('tool-cut').classList.add('on');
  $('cut-bar').hidden = false;
  $('cut-apply').disabled = true;
  $('cut-message').textContent = 'Klikk ved kanten av cellen du vil dele';
  setHover(new Set());
  setCutData();
}
function cancelCut() {
  if (!S.cut) return;
  S.cut = null;
  $('stage').classList.remove('cutting');
  $('tool-cut').classList.remove('on');
  $('cut-bar').hidden = true;
  setCutData();
}
function addCutPoint(lngLat) {
  S.cut.points.push([lngLat.lng, lngLat.lat]);
  updateRoute();
}
function removeCutPoint() {
  if (!S.cut?.points.length) return;
  S.cut.points.pop();
  updateRoute();
}
async function updateRoute() {
  const cut = S.cut;
  const request = ++cut.request;
  cut.line = null;
  setCutData();
  $('cut-apply').disabled = true;
  if (cut.points.length < 2) {
    $('cut-message').textContent = cut.points.length ? 'Klikk der kuttet skal ende' : 'Klikk ved kanten av cellen du vil dele';
    return;
  }
  $('cut-message').textContent = 'Finner beste trasé …';
  try {
    const result = await api('/api/route', { points: cut.points });
    if (S.cut !== cut || request !== cut.request) return;
    cut.line = result.line;
    cut.exact = result.exact;
    setCutData();
    $('cut-apply').disabled = !result.splits;
    const parts = result.pieces.map(a => `${hectares(a)} ha`).join(' + ');
    $('cut-message').textContent = result.splits
      ? `${number(result.lengthM)} m, deler ${result.splits} ${result.splits === 1 ? 'celle' : 'celler'}: ${parts}. Klikk et punkt til for å styre traseen.`
      : `${number(result.lengthM)} m, men deler ingen celle. Linja må gå fra kant til kant.`;
  } catch (error) {
    if (S.cut === cut && request === cut.request) $('cut-message').textContent = error.message;
  }
}
function applyCutDelta(results, assignments) {
  for (const result of results) {
    const removed = result.removed;
    const edgesRemoved = result.edgesRemoved;
    for (const id of edgesRemoved) removeEdgeRecord(id);
    for (const key of removed) {
      removeCellRecord(key);
      S.assign.delete(key);
    }
    for (const feature of result.added) addCellRecord(feature);
    for (const feature of result.edgesAdded) addEdgeRecord(feature, `edges-${result.area}`);
    refreshAreaSources(result.area);
  }
  for (const [key, zone] of Object.entries(assignments)) {
    if (zone) S.assign.set(key, zone); else S.assign.delete(key);
  }
  repaintCutChanges(results);
}
function repaintCutChanges(results) {
  for (const result of results) {
    for (const feature of result.added) {
      S.cells.get(feature.properties.k).paint = null;
      paintCell(feature.properties.k);
    }
    for (const feature of result.edgesAdded) {
      const edge = S.edges.get(feature.properties.i);
      edge.w = 0;
      paintEdge(edge);
    }
  }
  paintActiveOutline();
}
async function performCut(line, command) {
  await flushSave();
  S.busyCut = true;
  try {
    const result = await api('/api/cut', { exact: line });
    S.rev = result.rev;
    applyCutDelta(result.cuts, result.assignments);
    command.cuts = result.cuts.map(c => ({ area: c.area, id: c.id }));
    for (const area of new Set(result.cuts.map(c => c.area))) loadCellStats(area).then(scheduleDerived);
    S.dirty = false;
    scheduleDerived();
    setStatus('Lagret');
  } finally { S.busyCut = false; }
}
async function performCutUndo(command) {
  await flushSave();
  S.busyCut = true;
  try {
    const result = await api('/api/cut/undo', { cuts: command.cuts });
    S.rev = result.rev;
    applyCutDelta(result.cuts, result.assignments);
    for (const area of new Set(result.cuts.map(c => c.area))) loadCellStats(area).then(scheduleDerived);
    S.dirty = false;
    scheduleDerived();
    setStatus('Lagret');
  } finally { S.busyCut = false; }
}
async function applyCut() {
  if (!S.cut?.line) return;
  const command = { t: 'cut', line: S.cut.exact, cuts: [] };
  $('cut-apply').disabled = true;
  $('cut-message').textContent = 'Deler …';
  try {
    await performCut(command.line, command);
    S.undo.push(command);
    S.redo = [];
    $('undo').disabled = false;
    $('redo').disabled = true;
    toast('Cellen er delt. Nå kan du male bitene hver for seg.');
    cancelCut();
  } catch (error) {
    $('cut-message').textContent = error.message;
  }
}

// ------------------------------------------------------------ dialogs and zone actions

function dialog(title, body, okLabel = 'OK') {
  return new Promise(resolve => {
    const node = $('dialog');
    $('dialog-title').textContent = title;
    $('dialog-body').innerHTML = body;
    $('dialog-ok').textContent = okLabel;
    node.querySelector('menu button[value=cancel]').hidden = okLabel === 'Lukk';
    node.addEventListener('close', () => resolve(node.returnValue === 'ok'), { once: true });
    node.returnValue = '';
    node.showModal();
  });
}
function toast(message, error = false) {
  const node = $('toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.hidden = false;
  clearTimeout(node.timer);
  node.timer = setTimeout(() => { node.hidden = true; }, error ? 5000 : 3000);
}
function newZone() {
  const level = S.level;
  const id = freshZoneId(level);
  const parentLevel = level - 1;
  const fromActive = S.zones.get(S.active[level])?.parentId;
  const parent = level === 1 ? undefined : S.active[parentLevel] ?? fromActive ?? zonesOf(parentLevel)[0]?.id;
  structural(() => {
    S.zones.set(id, { id, name: level === 3 ? 'Ny sone' : `Nytt ${LEVEL_NAME[level]}-område`, level, parentId: parent, locked: false });
  });
  S.active[level] = id;
  refreshDerived();
  $('active-name').focus();
  $('active-name').select();
}
function deleteActive() {
  const zone = activeZone();
  if (!zone || isLocked(zone)) return;
  structural(() => {
    S.zones.delete(zone.id);
    for (const child of childrenOf(zone.id)) child.parentId = undefined;
    if (zone.level !== 3) return [];
    return cellsOfZone3(zone.id).map(key => [key, zone.id, null]);
  });
  S.active[zone.level] = null;
  toast(zone.level === 3 ? `${zone.name} slettet. Cellene er uten sone.` : `${zone.name} slettet.`);
  refreshDerived();
}
function cellsOfZone3(id) {
  return [...S.assign].filter(([key, value]) => value === id && S.cells.has(key)).map(([key]) => key);
}
async function mergeActive() {
  const zone = activeZone();
  if (!zone || isLocked(zone)) return;
  const scores = new Map();
  for (const key of cellsOfZone(zone.id)) {
    for (const edge of S.neighbours.get(key) ?? []) {
      const other = zoneAt(edge.a === key ? edge.b : edge.a, zone.level);
      if (other && other.id !== zone.id && !isLocked(other)) scores.set(other.id, (scores.get(other.id) ?? 0) + edge.l);
    }
  }
  const options = [...scores].sort((a, b) => b[1] - a[1]);
  const others = zonesOf(zone.level).filter(z => z.id !== zone.id && !scores.has(z.id) && !isLocked(z));
  if (!options.length && !others.length) return toast('Ingen sone å slå sammen med');
  const html = `<label>Slå ${esc(zone.name)} sammen med<select id="merge-target">
    ${options.map(([id, l]) => `<option value="${esc(id)}">${esc(S.zones.get(id).name)} (${number(l)} m felles grense)</option>`).join('')}
    ${others.map(z => `<option value="${esc(z.id)}">${esc(z.name)}</option>`).join('')}</select></label>`;
  if (!await dialog('Slå sammen soner', html, 'Slå sammen')) return;
  const target = $('merge-target').value;
  structural(() => {
    for (const child of childrenOf(zone.id)) child.parentId = target;
    S.zones.delete(zone.id);
    return zone.level === 3 ? cellsOfZone3(zone.id).map(key => [key, zone.id, target]) : [];
  });
  S.active[zone.level] = target;
  refreshDerived();
}
async function proposeInside() {
  const zone = activeZone();
  if (!zone || zone.level !== 2) return;
  const stat = S.stats.get(zone.id);
  const suggested = Math.max(1, Math.round((stat.buildings + stat.area / 8000) / (S.settings.targetBuildings ?? 266)));
  const html = `<p>Lager nye L3-soner for alle ulåste soner i ${esc(zone.name)}. Du kan angre med Ctrl+Z.</p>
    <label>Antall L3-soner<input type="number" id="propose-count" min="1" max="99" value="${suggested}"></label>`;
  if (!await dialog('Foreslå inndeling', html, 'Lag forslag')) return;
  await flushSave();
  try {
    const before = api('/api/propose', { parent: zone.id, count: Number($('propose-count').value) });
    await before;
    await pullOutsideChanges(false);
  } catch (error) { toast(error.message, true); }
}

// ------------------------------------------------------------ pick modes

function cancelPick() {
  if (!S.pick) return;
  S.pick = null;
  $('stage').classList.remove('picking');
  $('pick-bar').hidden = true;
  drawLasso([]);
}
function startAreaPick() {
  $('areas-pop').hidden = true;
  $('tool-areas').setAttribute('aria-expanded', 'false');
  cancelCut();
  S.pick = { kind: 'rect' };
  $('stage').classList.add('picking');
  $('pick-bar').hidden = false;
  $('pick-message').textContent = 'Dra en ramme rundt det nye området';
}
async function finishRectangle(a, b) {
  cancelPick();
  const w = map.unproject([Math.min(a.x, b.x), Math.max(a.y, b.y)]);
  const e = map.unproject([Math.max(a.x, b.x), Math.min(a.y, b.y)]);
  const bbox = [w.lng, w.lat, e.lng, e.lat].map(v => Number(v.toFixed(5)));
  const widthKm = (bbox[2] - bbox[0]) * 57.3, heightKm = (bbox[3] - bbox[1]) * 111;
  const l1s = zonesOf(1);
  const html = `<p>Rammen er ca. ${widthKm.toFixed(1).replace('.', ',')} × ${heightKm.toFixed(1).replace('.', ',')} km. Land som allerede er med, blir ikke endret. Grensen følger tomtene ved rammen.</p>
    <label>Navn<input type="text" id="area-name" required></label>
    <label>Legg under L1<select id="area-parent">${l1s.map(z => `<option value="${esc(z.id)}">${esc(z.name)}</option>`).join('')}</select></label>
    <label class="inline"><input type="checkbox" id="area-center"> Bare øya eller landet midt i rammen</label>`;
  if (!await dialog('Legg til område', html, 'Hent og bygg')) return;
  const name = $('area-name').value.trim();
  if (!name) return toast('Området trenger et navn', true);
  try {
    await flushSave();
    await api('/api/areas', { name, bbox, parentL1: $('area-parent').value, onlyCenterLand: $('area-center').checked });
    watchJob();
  } catch (error) { toast(error.message, true); }
}
function watchJob() {
  $('job-bar').hidden = false;
  const poll = async () => {
    const job = await api('/api/job');
    $('job-message').textContent = job.log.at(-1) ?? 'Starter …';
    if (job.running) return setTimeout(poll, 1000);
    $('job-bar').hidden = true;
    if (job.error) return dialog('Klarte ikke å bygge området', `<pre>${esc(job.error)}</pre>`, 'Lukk');
    await pullOutsideChanges(false);
    const area = S.areas.find(a => a.id === job.area);
    if (area?.bounds) map.fitBounds([[area.bounds[0], area.bounds[1]], [area.bounds[2], area.bounds[3]]], { padding: 60 });
    toast(`${area?.name ?? 'Området'} er lagt til med et første forslag`);
  };
  poll();
}
async function exportWorld() {
  $('tool-export').disabled = true;
  $('tool-export').textContent = 'Eksporterer …';
  try {
    await flushSave();
    const result = await api('/api/export', {});
    const check = result.validation;
    const own = result.check;
    const ownVerdict = own.valid ? 'Geometrien er kontrollert: ingen overlapp, ingen soner utenfor sin overordnede sone og ingen steder utenfor sonene.'
      : `Kontrollen fant ${own.issueCount} feil:<pre>${own.issues.map(esc).join('\n')}</pre>`;
    const verdict = check.skipped ? `${ownVerdict} ${esc(check.message)}`
      : !check.ran ? `${ownVerdict} Spillets kontroll kunne ikke kjøres: ${esc(check.message)}`
        : check.valid ? 'Verdensfilen består spillets kontroll.'
          : `Spillets kontroll fant ${check.issueCount} feil:<pre>${check.issues.map(i => esc(`${i.code} ${i.id}: ${i.message}`)).join('\n')}</pre>`;
    await dialog('Eksportert utkast', `<p>${verdict}</p>
      <p>${result.zones[3] ?? 0} L3, ${result.zones[2] ?? 0} L2 og ${result.zones[1] ?? 0} L1.${result.unassignedCells ? ` ${result.unassignedCells} celler uten sone er utelatt.` : ''}${result.droppedPois.length ? ` ${result.droppedPois.length} steder falt utenfor.` : ''}</p>
      <p>${result.edges} forbindelser, hvorav ${result.addedRoadEdges} nye forslag fra veinettet. ${result.droppedEdges.length} gamle forbindelser havnet inni én sone og er tatt bort.</p>
      <pre>${esc(result.path)}</pre><p class="hint">Filen er et utkast. Spillet endres ikke før du selv tar den i bruk.</p>`, 'Lukk');
  } catch (error) { toast(error.message, true); }
  $('tool-export').disabled = false;
  $('tool-export').textContent = 'Eksporter';
}

// ------------------------------------------------------------ content: what each zone is

// Filled from packages/world-data/data/content-catalog.json at start, the same file the game reads.
let CAT = null;
let ZONE_TYPES = [];
const POTENTIALS = [['bolig', 'Bolig'], ['dyrking', 'Dyrking'], ['skog', 'Skog'], ['industri', 'Industri'], ['transport', 'Transport'], ['forsvar', 'Forsvar']];
const POTENTIAL_LEVELS = ['–', 'Lav', 'Middels', 'Høy'];
const POI_KINDS = [['supplies', 'Butikk og lager'], ['medical', 'Helse'], ['school', 'Skole'], ['sports', 'Idrett og hall'],
  ['industrial', 'Industri'], ['power', 'Kraft'], ['water', 'Vannverk'], ['fuel', 'Drivstoff'], ['port', 'Havn'],
  ['transport', 'Transportpunkt'], ['junction', 'Veikryss'], ['comms', 'Samband'], ['police', 'Politi og beredskap'],
  ['military', 'Militært'], ['farm', 'Gård'], ['other', 'Annet']];
const ROLES = [['', 'Vanlig sted'], ['hq', 'HQ'], ['outpost', 'Utpost'], ['facility', 'Strategisk anlegg'], ['resource', 'Ressurssted']];
const ROLE_COLORS = { '': '#ffffff', hq: '#f2c14e', outpost: '#6fd0a8', facility: '#9fb4ff', resource: '#e39a63' };
const TYPE_FIELD = { hq: 'hqType', outpost: 'hqType', facility: 'facilityType', resource: 'siteType' };
// The game itself refers to these places by id, so the editor will not delete them.
const GAME_POIS = new Set(['poi-001']);
const label = (list, key) => list.find(([k]) => k === key)?.[1] ?? key;
const typeLabel = type => type ? label(ZONE_TYPES, type) : 'Type ikke satt';
const catName = (list, id) => list?.find(x => x.id === id)?.name ?? id;
const resourceName = id => catName(CAT?.resources, id);
const poiTypeName = poi => {
  const field = TYPE_FIELD[poi.role];
  const list = { hqType: CAT?.hqTypes, facilityType: CAT?.facilityTypes, siteType: CAT?.siteTypes }[field];
  return field && poi[field] ? catName(list, poi[field]) : '';
};
const decimal = (n, digits = 1) => n.toLocaleString('nb-NO', { maximumFractionDigits: digits });

async function loadCatalog() {
  CAT = await api('/api/catalog');
  ZONE_TYPES = CAT.zoneTypes;
}

// Measured land use per cell, summed live while zones are repainted.
async function loadCellStats(areaId) {
  try {
    const data = await api(`/api/areas/${areaId}/stats`);
    for (const [key, row] of Object.entries(data.cells)) S.cellStats.set(key, row);
    S.statFields = data.fields;
  } catch (error) { toast(`Fant ikke arealtall for ${areaId}: ${error.message}`, true); }
}
function measuresOf(zoneId) {
  const zone = S.zones.get(zoneId);
  if (!zone) return null;
  const fields = S.statFields ?? [];
  const m = { m2: 0, coastM: 0, landEdgeM: 0, buildings: 0 };
  for (const f of fields) m[f] = 0;
  const keys = new Set(cellsOfZone(zoneId));
  for (const key of keys) {
    const cell = S.cells.get(key);
    if (!cell) continue;
    m.m2 += cell.a;
    m.buildings += cell.n;
    const row = S.cellStats.get(key);
    if (row) fields.forEach((f, i) => { m[f] += row[i]; });
  }
  m.coastM = m.coast ?? 0;
  // AR5 (NIBIO) maps all land, so it replaces OpenStreetMap's farmland and forest where it was read.
  if ((m.arFull ?? 0) + (m.arSurface ?? 0) + (m.arPasture ?? 0) + (m.arForest ?? 0) + (m.arBog ?? 0) + (m.arRock ?? 0) + (m.arBuilt ?? 0) > 0) {
    m.farm = m.arFull + m.arSurface;
    m.forest = m.arForest;
    m.pasture = m.arPasture; m.bog = m.arBog; m.rock = m.arRock; m.built = m.arBuilt;
  } else { m.pasture = m.bog = m.rock = m.built = 0; }
  for (const key of keys) for (const edge of S.neighbours.get(key) ?? []) {
    const other = edge.a === key ? edge.b : edge.a;
    if (!keys.has(other) && S.assign.get(other)) m.landEdgeM += edge.l;
  }
  return m;
}
function capacity(m) {
  const y = CAT.yields;
  const edge = m.coastM + m.landEdgeM;
  return {
    housing: Math.round(m.floor / y.floorM2PerPerson),
    fieldFood: m.farm / 1e4 * y.fieldFoodPerHaYear,
    gardens: Math.max(m.open, m.built * y.gardenShareOfBuilt),
    openFood: (m.pasture * y.pastureFoodPerHaYear + Math.max(m.open, m.built * y.gardenShareOfBuilt) * y.openLandFoodPerHaYear) / 1e4,
    greenhouseFood: m.greenhouse * y.greenhouseFoodPerM2Year,
    fish: m.coastM >= 100 ? y.fishFoodPerBoatDay : 0,
    waterEdge: edge ? m.coastM / edge : 0,
  };
}
const fed = food => Math.floor(food / 365);
function measureBlock(m) {
  if (!m || !CAT) return '';
  const c = capacity(m);
  const rows = [
    ['Areal', `${hectares(m.m2)} ha`],
    ['Husrom', c.housing ? `ca. ${number(c.housing)} personer` : 'Ingen'],
    ['Jord i drift', `${hectares(m.farm)} ha`],
    ['Beite', `${hectares(m.pasture)} ha <span class="muted">kan pløyes</span>`],
    ['Hager og plener', `${hectares(c.gardens)} ha <span class="muted">kan dyrkes</span>`],
    ['Skog', `${hectares(m.forest)} ha`],
    ['Myr og fjell', `${hectares(m.bog + m.rock)} ha`],
    ['Kyst og vann', m.coastM ? `${decimal(m.coastM / 1000)} km, ${Math.round(c.waterEdge * 100)} % av grensen` : 'Ingen'],
    ['Industri', `${hectares(m.industry)} ha`],
  ];
  const foodNow = c.fieldFood + c.greenhouseFood;
  const foodAll = foodNow + c.openFood;
  return `<div class="measures">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}
    <span>Mat i året</span><b>${fed(foodNow)} personer fra jorda i drift, ${fed(foodAll)} om beite, hager og plener dyrkes</b>
    ${c.fish ? `<span>Fiske</span><b>${c.fish} mat per båt og dag <span class="muted">(1 mat = én persons dagsbehov)</span></b>` : ''}</div>
    <p class="muted">Det finnes langt flere hus enn overlevende. Husrom viser hva som kan rives eller tas i bruk, ikke hvor mange som bor her.</p>`;
}
function takeover(m) {
  const r = CAT.takeover;
  const residents = Math.round(m.floor / r.residentFloorM2);
  const zombies = Math.round(residents * r.zombieShare);
  const search = m.floor / r.searchFloorM2PerHour + Math.max(0, m.buildings - m.homes) * r.otherBuildingHours;
  const clear = zombies * r.hoursPerZombie;
  const sweep = m.m2 / 1e4 * r.sweepHoursPerHa;
  const hours = Math.round(search + clear + sweep);
  return { residents, zombies, search, clear, sweep, hours, posts: Math.ceil(m.landEdgeM / r.guardMetersPerPost),
    level: r.levels.find(([limit]) => hours <= limit)?.[1] ?? r.levels.at(-1)[1] };
}
function takeoverBlock(m) {
  if (!m || !CAT?.takeover) return '';
  const t = takeover(m);
  return `<div class="measures">
    <span>Vanskelighet</span><b>${esc(t.level)}, ca. ${number(t.hours)} arbeidstimer</b>
    <span>Zombier</span><b>ca. ${number(t.zombies)} <span class="muted">av ${number(t.residents)} som bodde her</span></b>
    <span>Søke gjennom</span><b>${number(m.buildings)} bygg, ${number(t.search)} t</b>
    <span>Rydde</span><b>${number(t.clear)} t</b>
    <span>Gå over området</span><b>${number(t.sweep)} t</b>
    <span>Holde grensen</span><b>${t.posts ? `${t.posts} vaktposter mot land` : 'Bare vann rundt'}</b></div>
    <p class="muted">Anslag til balansering. En enebolig tar om lag én time å søke gjennom, som i spillet.</p>`;
}
function chokeBlock(poi) {
  if (!['bridge', 'tunnel'].includes(poi.facilityType)) return '';
  const sides = (poi.ends ?? []).map(([lon, lat]) => poiZone({ lon, lat, cell: null }, 3)?.name ?? 'utenfor kartet');
  return `<div class="measures">
      <span>Lengde</span><b>${number(poi.lengthM ?? 0)} m</b>
      ${sides.length === 2 ? `<span>Forbinder</span><b>${esc(sides[0])} og ${esc(sides[1])}</b>` : ''}
    </div>
    <ul class="plain">${CAT.chokepointActions.map(a => `<li><b>${esc(a.name)}:</b> ${esc(a.effect)} <span class="muted">${esc(a.costs)}</span></li>`).join('')}</ul>`;
}
function upgradeList(m, level) {
  if (!m || !CAT) return '';
  const c = capacity(m);
  const ok = CAT.upgrades.filter(u => u.level === level && Object.entries(u.requires).every(([k, v]) =>
    k === 'openHa' ? (m.open + m.farm + m.pasture + c.gardens) / 1e4 >= v : k === 'housing' ? c.housing >= v : k === 'coastM' ? m.coastM >= v : k === 'network'));
  return `<ul class="plain">${ok.map(u => `<li><b>${esc(u.name)}</b> ${esc(u.gives)}${u.requires.network ? ` <span class="muted">Krever ${esc(catName(CAT.networks, u.requires.network).toLowerCase())}nett.</span>` : ''}${u.needs.length ? ` <span class="muted">Trenger ${u.needs.map(r => esc(resourceName(r).toLowerCase())).join(', ')}.</span>` : ''}</li>`).join('')}</ul>`;
}
function hqAdvantages(poi) {
  const type = CAT?.hqTypes.find(t => t.id === poi.hqType);
  const zone = poiZone(poi, 3);
  const district = poiZone(poi, 2);
  const rows = [];
  if (type) {
    rows.push(['Har fra start', type.startsWith.map(id => catName(CAT.modules, id)).join(', ')]);
    rows.push(['Unik mulighet', `${catName(CAT.modules, type.unique)}: ${CAT.modules.find(m => m.id === type.unique)?.effect ?? ''}`]);
  }
  const own = zone ? measuresOf(zone.id) : null;
  const area = district ? measuresOf(district.id) : own;
  if (own) {
    const c = capacity(own);
    if (c.housing) rows.push(['Husrom i HQ-sonen', `ca. ${number(c.housing)} personer`]);
  }
  if (area) {
    const c = capacity(area);
    const name = district ? district.name : 'sonen';
    if (c.fieldFood) rows.push([`Mat fra jord i drift i ${name}`, `${fed(c.fieldFood + c.greenhouseFood)} personer i året`]);
    const food = c.fieldFood + c.openFood + c.greenhouseFood;
    if (food > c.fieldFood) rows.push([`Mat ved full dyrking i ${name}`, `${fed(food)} personer i året`]);
    if (c.fish) rows.push(['Fiske', `${c.fish} mat per båt og dag`]);
    if (c.waterEdge >= .5) rows.push(['Omgitt av vann', `${Math.round(c.waterEdge * 100)} % av grensen rundt ${name}`]);
  }
  if (own) {
    const c = capacity(own);
    if (c.waterEdge >= .25) rows.push(['Vann rundt HQ-sonen', `${Math.round(c.waterEdge * 100)} % av grensen`]);
  }
  if (district) {
    const facilities = [...S.pois.values()].filter(p => p.role === 'facility' && poiZone(p, 2)?.id === district.id);
    if (facilities.length) rows.push(['Anlegg i området', facilities.map(p => p.name).join(', ')]);
  }
  return `<div class="measures">${rows.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>
    <p class="muted">Det som mangler her, er svakheten. Ingen HQ-type har trekk bare for typens skyld.</p>`;
}

function featureBox(key) {
  let box = S.featureBoxes.get(key);
  if (!box) {
    let w = 180, e = -180, s = 90, n = -90;
    const walk = a => {
      if (typeof a[0] === 'number') { w = Math.min(w, a[0]); e = Math.max(e, a[0]); s = Math.min(s, a[1]); n = Math.max(n, a[1]); }
      else a.forEach(walk);
    };
    walk(S.features.get(key).geometry.coordinates);
    box = [w, s, e, n];
    S.featureBoxes.set(key, box);
  }
  return box;
}
function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
function featureContains(feature, x, y) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.some(([outer, ...holes]) => ringContains(outer, x, y) && !holes.some(h => ringContains(h, x, y)));
}
/** The cell a place lies in. Found again by position after a cut has replaced the cell. */
function poiCell(poi) {
  if (S.cells.has(poi.cell)) return poi.cell;
  for (const key of S.features.keys()) {
    const [w, s, e, n] = featureBox(key);
    if (poi.lon >= w && poi.lon <= e && poi.lat >= s && poi.lat <= n && featureContains(S.features.get(key), poi.lon, poi.lat)) {
      poi.cell = key;
      return key;
    }
  }
  return null;
}
const poiZone = (poi, level = 3) => { const key = poiCell(poi); return key ? zoneAt(key, level) : null; };
function poisIn(zoneId) {
  const zone = S.zones.get(zoneId);
  return zone ? [...S.pois.values()].filter(p => poiZone(p, zone.level)?.id === zoneId) : [];
}
const hqCount = zoneId => poisIn(zoneId).filter(p => p.role === 'hq').length;
function contentFlag(zone) {
  if (hqCount(zone.id)) return '<span class="flags hq" title="Har HQ-kandidat">★</span>';
  if (zone.level !== 3) return '<span class="flags"></span>';
  if (zone.type && zone.suggested) return '<span class="flags suggested" title="Forslag, ikke sett over">◐</span>';
  return zone.type ? '<span class="flags done" title="Satt opp">✓</span>' : '<span class="flags" title="Ikke definert">○</span>';
}

function setMode(mode) {
  if (S.mode === mode) return;
  S.mode = mode;
  cancelCut();
  cancelPick();
  S.activePoi = null;
  for (const button of $('modes').children) button.classList.toggle('on', button.dataset.mode === mode);
  document.body.classList.toggle('content-mode', mode === 'content');
  setHover(new Set());
  $('tooltip').hidden = true;
  renderList();
  renderActive();
  renderLabels();
  renderPois();
}
function stepZone(direction) {
  const rows = [...$('zone-list').querySelectorAll('[data-zone]')].map(b => b.dataset.zone);
  if (!rows.length) return;
  const index = rows.indexOf(S.active[S.level]);
  const next = rows[(index + direction + rows.length) % rows.length];
  S.activePoi = null;
  setActive(next);
  fitKeys(cellsOfZone(next), 16);
  $('zone-list').querySelector(`[data-zone="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
}
function contentHover(point) {
  const poi = map.queryRenderedFeatures(point, { layers: ['poi-dot'] })[0];
  if (poi) {
    const p = S.pois.get(poi.properties.id);
    setHover(new Set());
    return tooltipAt(point, `<b>${esc(p.name)}</b><small>${esc(label(ROLES, p.role ?? ''))}${poiTypeName(p) ? ` · ${esc(poiTypeName(p))}` : ''}</small>`);
  }
  const key = keyAt(point);
  const zone = key ? zoneAt(key) : null;
  if (!zone) { setHover(new Set()); return tooltipAt(point, null); }
  setHover(zone.id === S.active[S.level] ? new Set() : new Set(cellsOfZone(zone.id)));
  tooltipAt(point, `<b>${esc(zone.name)}</b><small>${zone.level === 3 ? esc(typeLabel(zone.type)) : `${LEVEL_NAME[zone.level]}-område`}</small>`);
}
function contentClick(event) {
  const hit = map.queryRenderedFeatures(event.point, { layers: ['poi-dot'] })[0];
  if (hit) return selectPoi(hit.properties.id);
  const key = keyAt(event.point);
  const zone = key ? zoneAt(key) : null;
  S.activePoi = null;
  setActive(zone?.id ?? null);
}
function selectPoi(id) {
  const poi = S.pois.get(id);
  if (!poi) return;
  if (S.level !== 3) setLevel(3);
  S.activePoi = id;
  setActive(poiZone(poi)?.id ?? null);
  renderPois();
}

// Any edit by hand makes the zone yours: later suggestion runs leave it alone.
function editZone(id, patch) {
  structural(() => {
    const zone = S.zones.get(id);
    Object.assign(zone, patch);
    if (!('name' in patch)) delete zone.suggested;
    if ('notes' in patch) delete zone.notesSuggested;
  });
}
function editPoi(id, patch) {
  structural(() => { const poi = S.pois.get(id); Object.assign(poi, patch); delete poi.suggested; });
}
function freshPoiId() {
  let n = S.pois.size + 1;
  while (S.pois.has(`poi-${String(n).padStart(3, '0')}`)) n++;
  return `poi-${String(n).padStart(3, '0')}`;
}
function startPoiPick(moveId = null) {
  cancelCut();
  S.pick = { kind: 'poi', moveId };
  $('stage').classList.add('picking');
  $('pick-bar').hidden = false;
  $('pick-message').textContent = moveId ? 'Klikk der stedet egentlig ligger' : 'Klikk der det nye stedet ligger';
}
function placePoi(event) {
  const key = keyAt(event.point);
  if (!key) return toast('Klikk på land som hører til en celle', true);
  const { lng, lat } = event.lngLat;
  const moveId = S.pick.moveId;
  cancelPick();
  const id = moveId ?? freshPoiId();
  structural(() => {
    const position = { lon: Number(lng.toFixed(7)), lat: Number(lat.toFixed(7)), cell: key };
    if (moveId) Object.assign(S.pois.get(id), position);
    else S.pois.set(id, { id, name: 'Nytt sted', kind: 'other', role: '', resources: [], ...position });
  });
  selectPoi(id);
  if (!moveId) setTimeout(() => { const input = $('sheet').querySelector('[data-poi-field="name"]'); input?.focus(); input?.select(); }, 30);
}

function chips(list, selected, attribute) {
  const set = new Set(selected ?? []);
  return `<div class="chips">${list.map(([key, text]) => `<button type="button" class="chip ${set.has(key) ? 'on' : ''}" ${attribute}="${esc(key)}" aria-pressed="${set.has(key)}">${esc(text)}</button>`).join('')}</div>`;
}
const resourceChips = (layers, selected, attribute) =>
  chips(CAT.resources.filter(r => layers.includes(r.layer)).map(r => [r.id, r.name]), selected, attribute);
function descendantsAtL3(zone) {
  return zonesOf(3).filter(z => { let p = z; while (p && p.level > zone.level) p = S.zones.get(p.parentId); return p?.id === zone.id; });
}
function zoneResources(zone, field) {
  const result = new Set();
  for (const z of zone.level === 3 ? [zone] : descendantsAtL3(zone)) for (const r of z[field] ?? []) result.add(r);
  return [...result];
}
function typeSelect(poi) {
  const field = TYPE_FIELD[poi.role];
  if (!field) return '';
  const list = { hqType: CAT.hqTypes, facilityType: CAT.facilityTypes, siteType: CAT.siteTypes }[field];
  const title = { hq: 'HQ-type', outpost: 'Utpost av typen', facility: 'Anlegg', resource: 'Ressurssted' }[poi.role];
  return `<label>${title}<select data-poi-field="${field}"><option value="">Velg</option>${list.map(t => `<option value="${t.id}" ${poi[field] === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`;
}
function poiEditor(poi) {
  const role = poi.role ?? '';
  const known = POI_KINDS.some(([k]) => k === poi.kind);
  const site = role === 'resource' ? CAT.siteTypes.find(t => t.id === poi.siteType) : null;
  const facility = role === 'facility' ? CAT.facilityTypes.find(t => t.id === poi.facilityType) : null;
  const hq = (role === 'hq' || role === 'outpost') ? CAT.hqTypes.find(t => t.id === poi.hqType) : null;
  return `<div class="poi-editor">
    ${poi.suggested ? '<p class="suggested-note">Forslag fra kartdata. Endre noe, så er stedet ditt.</p>' : ''}
    <label>Navn<input data-poi-field="name" value="${esc(poi.name)}"></label>
    <div class="two">
      <label>Rolle<select data-poi-field="role">${ROLES.map(([k, t]) => `<option value="${k}" ${role === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      ${typeSelect(poi) || `<label>Type sted<select data-poi-field="kind">${POI_KINDS.map(([k, t]) => `<option value="${k}" ${poi.kind === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}${known ? '' : `<option value="${esc(poi.kind)}" selected>${esc(poi.kind)}</option>`}</select></label>`}
    </div>
    ${hq ? `<p class="muted">${esc(hq.summary)}</p>${role === 'hq' ? hqAdvantages(poi) : ''}` : ''}
    ${facility ? `<p class="muted">${esc(facility.summary)}</p>${chokeBlock(poi)}` : ''}
    ${site ? `<p class="muted">${site.finds ? `Kan finnes her: ${site.finds.map(r => esc(resourceName(r).toLowerCase())).join(', ')}. Tømmes etter hvert.` : ''} ${site.produces ? `Kan produsere: ${site.produces.map(r => esc(resourceName(r).toLowerCase())).join(', ')}.` : ''}</p>` : ''}
    ${poi.hqProfile ? `<p class="muted">Gammel profil: ${esc(poi.hqProfile)}</p>` : ''}
    <label>Notat<textarea data-poi-field="notes" rows="2" placeholder="Innganger, risiko, ideer">${esc(poi.notes ?? '')}</textarea></label>
    <div class="row wrap">
      <button type="button" data-action="poi-move">Flytt</button>
      <button type="button" data-action="poi-delete" class="danger" ${GAME_POIS.has(poi.id) ? 'disabled title="Spillet bruker dette stedet"' : ''}>Slett</button>
      <button type="button" data-action="poi-close">Lukk</button>
    </div>
  </div>`;
}
function poiRows(list) {
  if (!list.length) return '<p class="hint">Ingen steder registrert.</p>';
  const order = { hq: 0, outpost: 1, facility: 2, resource: 3, '': 4 };
  return `<div class="poi-list">${[...list].sort((a, b) => order[a.role ?? ''] - order[b.role ?? ''] || a.name.localeCompare(b.name, 'nb'))
    .map(p => `<button type="button" class="poi-row ${S.activePoi === p.id ? 'on' : ''}" data-poi="${esc(p.id)}">
      <span class="dot" style="background:${ROLE_COLORS[p.role ?? ''] ?? '#fff'}"></span><span class="name">${esc(p.name)}</span>
      <span class="muted">${esc(poiTypeName(p) || (p.role ? label(ROLES, p.role) : label(POI_KINDS, p.kind)))}</span></button>`).join('')}</div>`;
}
function networkBlock(zone) {
  const facilities = poisIn(zone.id).filter(p => p.role === 'facility');
  return `<div class="measures">${CAT.networks.map(n => {
    const via = facilities.filter(p => CAT.facilityTypes.find(t => t.id === p.facilityType)?.network === n.id).map(p => p.name);
    return `<span>${esc(n.name)}</span><b>${via.length ? esc(via.join(', ')) : `<span class="muted">${esc(n.needs)}</span>`}</b>`;
  }).join('')}</div>`;
}
function renderSheet() {
  const sheet = $('sheet');
  if (S.mode !== 'content') { sheet.hidden = true; return; }
  sheet.hidden = false;
  const focused = document.activeElement?.closest?.('#sheet') ? document.activeElement : null;
  if (focused?.matches('input, textarea')) return;
  if (!CAT) { sheet.innerHTML = '<p class="hint">Laster katalog …</p>'; return; }
  const zone = activeZone();
  if (!zone) {
    const l3 = zonesOf(3);
    const typed = l3.filter(z => z.type).length;
    const own = l3.filter(z => z.type && !z.suggested).length;
    const hqs = [...S.pois.values()].filter(p => p.role === 'hq');
    sheet.innerHTML = `<h2>Innhold</h2>
      <p class="hint">Klikk en sone på kartet eller i lista. Bla videre med pil opp og ned.</p>
      <div class="progress"><span style="width:${l3.length ? 100 * typed / l3.length : 0}%"></span></div>
      <p class="muted">${typed} av ${l3.length} L3-soner har innhold. ${own} er satt eller sett over av deg (✓), ${typed - own} er forslag (◐).</p>
      <button type="button" data-action="suggest" class="primary wide">Foreslå innhold</button>
      <p class="muted">Fyller soner og steder fra kartdata: arealbruk, kyst, boliger og steder fra OpenStreetMap. Det du har satt selv, blir ikke rørt.</p>
      <div class="field-label">HQ-kandidater (${hqs.length})</div>${poiRows(hqs)}`;
    return;
  }
  const stat = S.stats.get(zone.id) ?? { buildings: 0, area: 0 };
  const parent = S.zones.get(zone.parentId);
  const m = measuresOf(zone.id);
  const head = `<div class="sheet-head">
      <span class="swatch" style="background:${S.colors.get(zone.id) ?? UNASSIGNED}"></span>
      <input data-zone-field="name" value="${esc(zone.name)}" aria-label="Navn">
      <button type="button" class="icon" data-action="prev" title="Forrige (pil opp)" aria-label="Forrige sone">‹</button>
      <button type="button" class="icon" data-action="next" title="Neste (pil ned)" aria-label="Neste sone">›</button>
    </div>
    <p class="muted">${LEVEL_NAME[zone.level]} · ${number(stat.buildings)} bygg · ${hectares(stat.area)} ha${parent ? ` · i ${esc(parent.name)}` : ''}</p>`;
  const pois = poisIn(zone.id);
  const active = S.pois.get(S.activePoi);
  if (zone.level === 3) {
    const potential = zone.potential ?? {};
    const legacy = (zone.resources ?? []).filter(r => !CAT.resources.some(x => x.id === r));
    sheet.innerHTML = `${head}
      ${zone.suggested ? `<div class="suggested-note row-between"><span>Forslag fra kartdata</span><button type="button" data-action="accept">Godta</button></div>` : ''}
      <div class="field-label">Type sone</div>${chips(ZONE_TYPES, zone.type ? [zone.type] : [], 'data-type')}
      <details class="fold" open><summary class="field-label">Målt fra kartet</summary>${measureBlock(m)}</details>
      <details class="fold"><summary class="field-label">Å ta over sonen</summary>${takeoverBlock(m)}</details>
      <div class="field-label">Potensial</div>
      <div class="potential">${POTENTIALS.map(([key, text]) => `<span>${esc(text)}</span><div class="scale">${POTENTIAL_LEVELS.map((l, i) => `<button type="button" class="${(potential[key] ?? 0) === i ? 'on' : ''}" data-pot="${key}" data-val="${i}">${l}</button>`).join('')}</div>`).join('')}</div>
      <div class="field-label">Kan finnes her <span class="muted">tømmes</span></div>${resourceChips(['consumable', 'material', 'component'], zone.finds, 'data-find')}
      <div class="field-label">Kan produseres her <span class="muted">fornybart</span></div>${resourceChips(['capacity'], zone.produces, 'data-produce')}
      ${legacy.length ? `<p class="muted">Gamle ressurser: ${legacy.map(esc).join(', ')}</p>` : ''}
      <details class="fold"><summary class="field-label">Kan bygges ut med</summary>${upgradeList(m, 3)}</details>
      <div class="field-label row-between"><span>Steder (${pois.length})</span><button type="button" data-action="poi-add" title="Nytt sted (P)">+ Sted</button></div>
      ${poiRows(pois)}
      ${active && poiZone(active)?.id === zone.id ? poiEditor(active) : ''}
      <label class="notes">Notat<textarea data-zone-field="notes" rows="3" placeholder="Hva er spesielt her?">${esc(zone.notes ?? '')}</textarea></label>`;
  } else {
    const children = descendantsAtL3(zone);
    const types = new Map();
    for (const child of children) types.set(typeLabel(child.type), (types.get(typeLabel(child.type)) ?? 0) + 1);
    const finds = zoneResources(zone, 'finds');
    const produces = zoneResources(zone, 'produces');
    sheet.innerHTML = `${head}
      <div class="field-label">L3-soner (${children.length})</div>
      <p class="muted">${[...types].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${esc(t)}: ${n}`).join(' · ') || 'Ingen'}</p>
      <details class="fold" open><summary class="field-label">Målt fra kartet</summary>${measureBlock(m)}</details>
      <details class="fold"><summary class="field-label">Å ta over hele området</summary>${takeoverBlock(m)}</details>
      ${zone.level === 2 ? `<div class="field-label">Nett som kan bygges ut</div>${networkBlock(zone)}` : ''}
      <div class="field-label">Kan finnes</div><p class="muted">${finds.map(r => esc(resourceName(r))).join(', ') || 'Ingen registrert'}</p>
      <div class="field-label">Kan produseres</div><p class="muted">${produces.map(r => esc(resourceName(r))).join(', ') || 'Ingen registrert'}</p>
      <div class="field-label">Steder med rolle</div>${poiRows(pois.filter(p => p.role && p.role !== 'resource'))}
      <label class="notes">Notat<textarea data-zone-field="notes" rows="3">${esc(zone.notes ?? '')}</textarea></label>`;
  }
}
async function runSuggest() {
  const ok = await dialog('Foreslå innhold', `<p>Soner og steder fylles ut fra kartdata. Soner du har satt opp selv, og steder du har endret, blir ikke rørt.</p>
    <p>Alt kommer som ett steg, så Ctrl+Z angrer hele forslaget.</p>`, 'Foreslå');
  if (!ok) return;
  await flushSave();
  setStatus('Lager forslag …');
  try {
    const result = await api('/api/suggest', { baseRev: S.rev });
    await pullOutsideChanges(false, `${result.summary.zones} soner fikk forslag, og ${result.summary.places} nye steder ble lagt til. Ctrl+Z angrer.`);
  } catch (error) {
    if (error.status === 409) { await pullOutsideChanges(true); toast('Prosjektet var endret. Prøv igjen.', true); }
    else { setStatus('Lagret'); toast(error.message, true); }
  }
}
function addPoiLayers() {
  map.addSource('pois', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'poi-halo', type: 'circle', source: 'pois', filter: ['==', ['get', 'role'], 'hq'],
    paint: { 'circle-radius': 13, 'circle-color': '#f2c14e', 'circle-opacity': .3 } });
  map.addLayer({ id: 'poi-dot', type: 'circle', source: 'pois',
    // Resource sites are many, so they appear when zoomed in.
    filter: ['any', ['!=', ['get', 'role'], 'resource'], ['>=', ['zoom'], 14], ['get', 'on']],
    paint: {
      'circle-radius': ['case', ['get', 'on'], 9, ['==', ['get', 'role'], ''], 5, ['==', ['get', 'role'], 'resource'], 5, 7],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': ['case', ['get', 'on'], '#d92b6a', '#14232a'],
      'circle-stroke-width': ['case', ['get', 'on'], 3, 1.6],
    } });
}
function renderPois() {
  const source = map.getSource('pois');
  if (!source) return;
  source.setData({ type: 'FeatureCollection', features: [...S.pois.values()].map(p => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { id: p.id, role: p.role ?? '', color: ROLE_COLORS[p.role ?? ''] ?? '#fff', on: p.id === S.activePoi },
  })) });
}
$('modes').addEventListener('click', event => { if (event.target.dataset.mode) setMode(event.target.dataset.mode); });
$('sheet').addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  const zone = activeZone();
  const action = target.dataset.action;
  if (action === 'prev') return stepZone(-1);
  if (action === 'next') return stepZone(1);
  if (action === 'suggest') return runSuggest();
  if (action === 'poi-add') return startPoiPick();
  if (action === 'poi-close') { S.activePoi = null; renderSheet(); return renderPois(); }
  if (action === 'poi-move') return startPoiPick(S.activePoi);
  if (action === 'poi-delete') {
    const id = S.activePoi;
    S.activePoi = null;
    structural(() => { S.pois.delete(id); });
    return toast('Stedet er slettet. Ctrl+Z angrer.');
  }
  if (target.dataset.poi) return selectPoi(target.dataset.poi);
  if (!zone) return;
  if (action === 'accept') return editZone(zone.id, {});
  if (target.dataset.type) return editZone(zone.id, { type: zone.type === target.dataset.type ? undefined : target.dataset.type });
  if (target.dataset.pot) return editZone(zone.id, { potential: { ...(zone.potential ?? {}), [target.dataset.pot]: Number(target.dataset.val) } });
  for (const [attribute, field] of [['find', 'finds'], ['produce', 'produces']]) {
    const id = target.dataset[attribute];
    if (!id) continue;
    const set = new Set(zone[field] ?? []);
    if (set.has(id)) set.delete(id); else set.add(id);
    return editZone(zone.id, { [field]: [...set] });
  }
});
$('sheet').addEventListener('change', event => {
  const field = event.target.dataset.zoneField;
  const poiField = event.target.dataset.poiField;
  const value = event.target.value.trim();
  event.target.blur();
  if (field && activeZone()) {
    if (field === 'name' && !value) return renderSheet();
    editZone(activeZone().id, { [field]: value || undefined });
  } else if (poiField && S.activePoi) {
    if (poiField === 'name' && !value) return renderSheet();
    editPoi(S.activePoi, { [poiField]: value || (poiField === 'role' ? '' : undefined) });
  }
});
$('sheet').addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('input')) event.target.blur();
});

// ------------------------------------------------------------ wiring

$('levels').addEventListener('click', event => {
  const level = Number(event.target.dataset.level);
  if (level) setLevel(level);
});
$('undo').addEventListener('click', () => undoRedo(-1));
$('redo').addEventListener('click', () => undoRedo(1));
$('search').addEventListener('input', event => { S.search = event.target.value; renderList(); });
$('new-zone').addEventListener('click', newZone);
$('zone-list').addEventListener('click', event => {
  const row = event.target.closest('[data-zone]');
  if (row) setActive(row.dataset.zone === S.active[S.level] ? null : row.dataset.zone);
});
$('zone-list').addEventListener('dblclick', event => {
  const row = event.target.closest('[data-zone]');
  if (!row) return;
  setActive(row.dataset.zone);
  fitKeys(cellsOfZone(row.dataset.zone));
});
$('active-name').addEventListener('change', event => {
  const zone = activeZone();
  const name = event.target.value.trim();
  if (zone && name && name !== zone.name) structural(() => { S.zones.get(zone.id).name = name; });
});
$('active-name').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });
$('active-lock').addEventListener('click', toggleLock);
function toggleLock() {
  const zone = activeZone();
  if (zone) structural(() => { S.zones.get(zone.id).locked = !zone.locked; });
}
$('active-focus').addEventListener('click', () => { const z = activeZone(); if (z) fitKeys(cellsOfZone(z.id)); });
$('active-delete').addEventListener('click', deleteActive);
$('active-merge').addEventListener('click', mergeActive);
$('tool-game').addEventListener('click', async () => {
  await flushSave();
  setStatus('Skriver spillverden …');
  try {
    const result = await api('/api/game-world', {});
    setStatus('Lagret');
    toast(`Spillverdenen er oppdatert: ${result.starts} startområder. Start en ny gjennomspilling for å bruke den.`);
    window.open('http://127.0.0.1:3000/', '_blank');
  } catch (error) { setStatus('Lagret'); toast(error.message, true); }
});
$('active-propose').addEventListener('click', proposeInside);
$('warnings-toggle').addEventListener('click', event => {
  const button = event.currentTarget;
  button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true'));
  renderWarnings();
});
$('warning-list').addEventListener('click', event => {
  const fix = event.target.closest('[data-fix]');
  if (fix) {
    const { fix: action } = S.warnings[Number(fix.dataset.fix)];
    if (action.dissolve) return dissolveZone(action.dissolve);
    const changes = action.keys.map(key => [key, S.assign.get(key) ?? null, action.target]);
    if (action.removeZone) {
      structural(() => { S.zones.delete(action.removeZone); return changes; });
    } else {
      const command = { t: 'assign', changes };
      runCommand(command, 1);
      commit(command);
    }
    return;
  }
  const item = event.target.closest('[data-warning]');
  if (!item) return;
  const warning = S.warnings[Number(item.dataset.warning)];
  if (warning.zone && S.level === 3) setActive(warning.zone);
  fitKeys(warning.keys.length ? warning.keys : cellsOfZone(warning.zone ?? ''));
});
function togglePopover(button, pop) {
  const open = pop.hidden;
  for (const [b, p] of [[$('tool-layers'), $('layers-pop')], [$('tool-areas'), $('areas-pop')]]) {
    p.hidden = true;
    b.setAttribute('aria-expanded', 'false');
  }
  pop.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}
$('tool-layers').addEventListener('click', () => togglePopover($('tool-layers'), $('layers-pop')));
$('tool-areas').addEventListener('click', () => togglePopover($('tool-areas'), $('areas-pop')));
$('tool-cut').addEventListener('click', startCut);
$('tool-export').addEventListener('click', exportWorld);
$('cut-apply').addEventListener('click', applyCut);
$('cut-cancel').addEventListener('click', cancelCut);
$('pick-cancel').addEventListener('click', cancelPick);
$('area-add').addEventListener('click', startAreaPick);
$('area-list').addEventListener('click', event => {
  const id = event.target.dataset.area;
  const area = S.areas.find(a => a.id === id);
  if (area?.bounds) map.fitBounds([[area.bounds[0], area.bounds[1]], [area.bounds[2], area.bounds[3]]], { padding: 60 });
});
function setLayerVisibility(prefix, visible) {
  for (const id of S.loaded) map.setLayoutProperty(`${prefix}-${id}`, 'visibility', visible ? 'visible' : 'none');
}
$('layer-basemap').addEventListener('change', event => {
  map.setLayoutProperty('topo', 'visibility', event.target.checked ? 'visible' : 'none');
  setLayerVisibility('roads', !event.target.checked);
});
$('layer-buildings').addEventListener('change', event => setLayerVisibility('buildings', event.target.checked));
$('layer-cells').addEventListener('change', event => setLayerVisibility('cell-line', event.target.checked));
$('layer-labels').addEventListener('change', event => { S.showLabels = event.target.checked; renderLabels(); });
$('layer-opacity').addEventListener('input', event => {
  S.opacity = Number(event.target.value) / 100;
  const paint = fillPaint();
  for (const id of S.loaded) map.setPaintProperty(`fill-${id}`, 'fill-opacity', paint['fill-opacity']);
});
window.addEventListener('keydown', event => {
  const typing = event.target.matches('input, select, textarea') || $('dialog').open;
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl && event.key.toLowerCase() === 'z' && !typing) {
    event.preventDefault();
    return undoRedo(event.shiftKey ? 1 : -1);
  }
  if (ctrl && event.key.toLowerCase() === 'y' && !typing) {
    event.preventDefault();
    return undoRedo(1);
  }
  if (typing || ctrl) return;
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    if (S.cut) cancelCut();
    else if (S.pick) cancelPick();
    else if (S.activePoi) { S.activePoi = null; renderSheet(); renderPois(); }
    else if (activeZone()) setActive(null);
  } else if (key === 'enter' && S.cut) applyCut();
  else if (key === 'backspace' && S.cut) { event.preventDefault(); removeCutPoint(); }
  else if (key === 'k') startCut();
  else if (key === 'g') setMode('edit');
  else if (key === 'i') setMode('content');
  else if ((key === ']' || key === 'arrowdown') && S.mode === 'content') { event.preventDefault(); stepZone(1); }
  else if ((key === '[' || key === 'arrowup') && S.mode === 'content') { event.preventDefault(); stepZone(-1); }
  else if (key === 'n') { event.preventDefault(); newZone(); }
  else if (key === 'l') toggleLock();
  else if (key === 'f') { const z = activeZone(); if (z) fitKeys(cellsOfZone(z.id)); }
  else if (key === '/') { event.preventDefault(); $('search').focus(); }
  else if (['1', '2', '3'].includes(key)) setLevel(Number(key));
  else if (key === 'p' && S.mode === 'content') startPoiPick();
  else return;
});
window.addEventListener('beforeunload', event => {
  if (S.dirty) { save(); event.preventDefault(); }
});

// ------------------------------------------------------------ start

map.once('style.load', async () => {
  map.addSource('cut-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('cut-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'cut-line', type: 'line', source: 'cut-line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5 } });
  map.addLayer({ id: 'cut-line-core', type: 'line', source: 'cut-line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#d92b6a', 'line-width': 2.5 } });
  addPoiLayers();
  map.addLayer({ id: 'cut-points', type: 'circle', source: 'cut-points', paint: { 'circle-radius': 5, 'circle-color': '#d92b6a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
  await loadCatalog();
  const state = await api('/api/state');
  S.rev = state.rev;
  S.settings = state.project.settings;
  S.areas = state.project.areas;
  S.zones = new Map(state.project.zones.map(z => [z.id, z]));
  S.assign = new Map(Object.entries(state.project.assignments));
  S.pois = new Map((state.project.pois ?? []).map(p => [p.id, p]));
  for (const area of S.areas.filter(a => a.status === 'ready')) await loadArea(area);
  setLevel(3);
  refreshDerived();
  if (S.areas[0]?.bounds) {
    const all = S.areas.filter(a => a.bounds).map(a => a.bounds);
    map.fitBounds([[Math.min(...all.map(b => b[0])), Math.min(...all.map(b => b[1]))], [Math.max(...all.map(b => b[2])), Math.max(...all.map(b => b[3]))]], { padding: 40, duration: 0 });
  }
  renderAreas();
  $('undo').disabled = true;
  $('redo').disabled = true;
  setStatus('Lagret');
  $('warnings-toggle').setAttribute('aria-expanded', 'true');
  window.__zoneEditor = { S, map, assignCells, setActive, setLevel, cellsOfZone, selectPoi };
  map.once('idle', () => { window.__zoneEditorReady = true; });
});
