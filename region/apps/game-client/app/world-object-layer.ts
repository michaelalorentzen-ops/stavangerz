/** Local GLB strategy pieces. The placement register, never orders, owns positions. */
import type { Map as LibreMap, Marker, CustomLayerInterface } from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { indexWorld } from '../../../packages/gameplay/src/region/engine';
import { crewPositionFor, knownCrewL3Zone } from '../../../packages/gameplay/src/region/location';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';

type Asset = { url: string; meters?: number | { height?: number }; scale?: number; animations?: string[] };
type Piece = { id: string; asset: string; at: [number, number]; title: string; animation: string; crew?: string; zone: string; offset?: number };
type Instance = { object: THREE.Group; mixer?: THREE.AnimationMixer; asset: string; animation: string; layout?: { view: number; lng: number; lat: number; offset: number } };
export interface WorldObjectController { update(state: RegionState): void; setReducedMotion(value: boolean): void; destroy(): void }
export function attachWorldObjects(map: LibreMap, lib: typeof import('maplibre-gl'), world: RegionWorld, initial: RegionState, select: { onCrew(id: string, zoneId: string): void; onZone(id: string): void }): WorldObjectController {
  const id = 'stavangerz-world-objects';
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const loader = new GLTFLoader();
  const templates = new Map<string, { scene: THREE.Group; clips: THREE.AnimationClip[]; height: number; span: number }>();
  const instances = new Map<string, Instance>();
  const pending = new Set<string>();
  const journeys = new Map<string, { from: [number, number]; to: [number, number]; started: number }>();
  const markers = new Map<string, Marker>();
  const index = indexWorld(world);
  const zones = index.byId;
  let assets: Record<string, Asset> = {}, pieces: Piece[] = [], state = initial, disposed = false, lost = false;
  let renderer: THREE.WebGLRenderer | undefined;
  const abort = new AbortController();
  let reducedMotion: boolean | undefined;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowPower = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2);
  const clock = new THREE.Clock();
  // Camera and anchor geometry is static during idle animation. Reuse matrices
  // and only project a piece again after the camera or its reported position moves.
  const projection = new THREE.Matrix4(), translation = new THREE.Matrix4(), scaling = new THREE.Matrix4();
  const rotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  let viewRevision = 0, previousView: number[] = [];
  scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x394b33, 2.3));
  const sun = new THREE.DirectionalLight(0xffe1af, 3.2); sun.position.set(-30, -60, 100); scene.add(sun);
  const disposeObject = (object: THREE.Object3D) => object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; for (const material of materials) { for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose(); material.dispose(); } } });
  const load = (assetId: string) => {
    const asset = assets[assetId];
    if (!asset || templates.has(assetId) || pending.has(assetId) || !asset.url.startsWith('/models/')) return;
    pending.add(assetId);
    loader.load(asset.url, gltf => {
      pending.delete(assetId);
      if (disposed) { disposeObject(gltf.scene); return; }
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      templates.set(assetId, { scene: gltf.scene, clips: gltf.animations, height: Math.max(.1, size.y), span: Math.max(.1, size.x, size.y, size.z) });
      map.triggerRepaint();
    }, undefined, () => { pending.delete(assetId); });
  };
  const refresh = () => {
    if (disposed) return;
    const detailed = map.getZoom() >= 12;
    const visible: Piece[] = [];
    if (detailed) {
      const perZone = new Map<string, number>();
      for (const person of state.survivors) {
        const position = crewPositionFor(state, person.id);
        const zoneId = position && knownCrewL3Zone(position), at = zoneId ? zones.get(zoneId)?.at : undefined;
        if (!at || !zoneId || !map.getBounds().contains(at)) continue;
        const offset = perZone.get(zoneId) ?? 0; perZone.set(zoneId, offset + 1);
        const identity = ['ingrid', 'marius', 'leila', 'tor'].find(name => `${person.id} ${person.name}`.toLowerCase().includes(name)) ?? 'ingrid';
        visible.push({ id: person.id, asset: `crew-${identity}`, at, title: `${person.name} · ${zones.get(zoneId)?.name}`, animation: position?.kind === 'transit' ? 'Walk' : Object.values(state.crewMissions ?? {}).some(m => m.survivorIds.includes(person.id) && m.status === 'working' && ['guard', 'hold'].includes(m.action)) ? 'Guard' : 'Idle', crew: person.id, zone: zoneId, offset });
      }
      const home = zones.get(state.homeZoneId)?.at;
      if (home && map.getBounds().contains(home)) {
        if (Object.values(state.stock).some(n => n > 0)) visible.push({ id: 'camp-supplies', asset: 'supply-crates', at: home, title: 'Leirlager', animation: 'Idle', zone: state.homeZoneId, offset: -1 });
        if ((state.stock.boat ?? 0) > 0) visible.push({ id: 'camp-boat', asset: 'boat', at: home, title: 'Båt ved leiren', animation: 'Idle', zone: state.homeZoneId, offset: -2 });
      }
      const hqAt = state.hq ? zones.get(state.hq.zoneId)?.at : undefined;
      if (state.hq && hqAt && map.getBounds().contains(hqAt)) visible.push({ id: 'headquarters', asset: 'hq', at: hqAt, title: 'Hovedkvarter', animation: 'Idle', zone: state.hq.zoneId });
      for (const zone of world.zones) {
        const known = state.zones[zone.id];
        if (!zone.at || !known || !map.getBounds().contains(zone.at) || known.status === 'unknown') continue;
        if (known.status === 'controlled' && (known.upgrades.some(u => /barricade|fence|wall|fort/i.test(u)) || (index.adjacent.get(zone.id) ?? []).some(edge => (state.barricades[edge.connId] ?? 0) > 0))) visible.push({ id: `defence-${zone.id}`, asset: 'barricade', at: zone.at, title: 'Forsvarsverk', animation: 'Idle', zone: zone.id, offset: 1 });
        // One representative per reported threat, independent of secret counts.
        if (known.status !== 'controlled' && known.intel && known.intel.max > 0) visible.push({ id: `threat-${zone.id}`, asset: 'zombie', at: zone.at, title: `Rapportert trussel · ${known.intel.min}–${known.intel.max}`, animation: 'Idle', zone: zone.id });
      }
    }
    pieces = visible.slice(0, 28);
    const wanted = new Set(pieces.map(p => p.id));
    for (const [key, marker] of markers) if (!wanted.has(key)) { marker.remove(); markers.delete(key); }
    for (const [key, instance] of instances) if (!wanted.has(key)) { instance.mixer?.stopAllAction(); scene.remove(instance.object); instances.delete(key); }
    for (const piece of pieces) {
      if (!markers.has(piece.id)) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = `rz-world-piece ${piece.crew ? 'rz-world-crew' : 'rz-world-prop'} ${piece.asset === 'zombie' ? 'rz-world-threat' : ''}`;
        button.dataset.asset = piece.asset;
        button.title = piece.title; button.setAttribute('aria-label', piece.title);
        const silhouette = piece.crew ? '<circle cx="16" cy="8" r="4"/><path d="M11 15h10l3 10h-5v7h-6v-7H8z"/>' : piece.asset === 'zombie' ? '<path d="M16 4 30 30H2z"/><path d="M16 12v8m0 4v2" stroke="#17302c" stroke-width="3"/>' : piece.asset === 'hq' ? '<path d="m2 16 14-12 14 12h-4v16H6V16zm11 7v9h6v-9z"/>' : '<path d="M3 10h26v20H3zM3 10l8-6h12l6 6M16 10v20" stroke="currentColor" stroke-width="2" fill="none"/>';
        button.innerHTML = `<span class="rz-piece-fallback" aria-hidden="true"><svg viewBox="0 0 32 36" width="26" height="30" fill="currentColor">${silhouette}</svg></span><span class="rz-piece-caption"></span>`;
        button.querySelector('.rz-piece-caption')!.textContent = piece.crew ? piece.title.split(' ')[0] : '';
        button.onclick = event => { event.stopPropagation(); const current = pieces.find(p => p.id === piece.id); if (!current) return; if (current.crew) select.onCrew(current.crew, current.zone); else select.onZone(current.zone); };
        markers.set(piece.id, new lib.Marker({ element: button, anchor: 'bottom', offset: [piece.crew ? 35 + (piece.offset ?? 0) * 42 : (piece.offset ?? 0) * 48, piece.crew ? -8 : 8] }).setLngLat(piece.at).addTo(map));
      } else markers.get(piece.id)!.setLngLat(piece.at);
      if (!lowPower && !lost) load(piece.asset);
    }
    map.triggerRepaint();
  };
  const layer: CustomLayerInterface = {
    id, type: 'custom', renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    },
    render(_gl, options) {
      if (!renderer || disposed || lost || lowPower || map.getZoom() < 12 || map.getPitch() < 15) {
        markers.forEach(marker => marker.getElement().classList.remove('has-model'));
        return;
      }
      projection.fromArray(options.defaultProjectionData.mainMatrix);
      // Keep GPU coordinates near zero; global Mercator floats jitter at street zoom.
      const center = map.getCenter(), canvas = map.getCanvas();
      const view = [center.lng, center.lat, map.getZoom(), map.getPitch(), map.getBearing(), canvas.width, canvas.height];
      if (view.some((value, i) => value !== previousView[i])) { previousView = view; viewRevision++; }
      const origin = lib.MercatorCoordinate.fromLngLat(center, 0);
      const delta = Math.min(clock.getDelta(), .05);
      let animate = false;
      for (const piece of pieces) {
        const template = templates.get(piece.asset);
        const marker = markers.get(piece.id);
        if (!template) { marker?.getElement().classList.remove('has-model'); continue; }
        let instance = instances.get(piece.id);
        if (!instance) {
          const object = clone(template.scene) as THREE.Group;
          const mixer = template.clips.length ? new THREE.AnimationMixer(object) : undefined;
          instance = { object, mixer, asset: piece.asset, animation: '' }; instances.set(piece.id, instance); scene.add(object);
        }
        if (instance.animation !== piece.animation) {
          instance.mixer?.stopAllAction();
          const clip = template.clips.find(c => c.name.toLowerCase() === piece.animation.toLowerCase());
          if (clip && !(reducedMotion ?? motion.matches)) instance.mixer?.clipAction(clip).play();
          instance.animation = piece.animation;
        }
        // Screen-space offset separates pieces sharing the same authoritative zone anchor.
        const journey = journeys.get(piece.id);
        let at = piece.at;
        if (journey && !(reducedMotion ?? motion.matches)) {
          const progress = Math.min(1, (performance.now() - journey.started) / 650);
          at = [journey.from[0] + (journey.to[0] - journey.from[0]) * progress, journey.from[1] + (journey.to[1] - journey.from[1]) * progress];
          if (progress < 1) animate = true; else journeys.delete(piece.id);
          marker?.setLngLat(at);
        }
        const offset = piece.offset ?? 0;
        if (!instance.layout || instance.layout.view !== viewRevision || instance.layout.lng !== at[0] || instance.layout.lat !== at[1] || instance.layout.offset !== offset) {
          const point = map.project(at);
          if (piece.crew) { point.x += 35 + offset * 42; point.y -= 8; } else { point.x += offset * 48; point.y += 8; }
          const lngLat = map.unproject(point);
          const anchor = lib.MercatorCoordinate.fromLngLat(lngLat, 0);
          const metersPerPixel = 40075016.686 * Math.cos(lngLat.lat * Math.PI / 180) / (512 * 2 ** map.getZoom());
          const upright = !!piece.crew || piece.asset === 'zombie';
          const targetSize = piece.crew ? 43 : piece.asset === 'zombie' ? 34 : piece.asset === 'hq' ? 64 : 42;
          const modelSize = upright ? template.height * Math.max(.25, Math.sin(map.getPitch() * Math.PI / 180)) : template.span;
          const scale = anchor.meterInMercatorCoordinateUnits() * metersPerPixel * targetSize / modelSize;
          instance.object.matrixAutoUpdate = false;
          // glTF Y-up becomes map Z-up; reflection accounts for Mercator's south-positive Y.
          instance.object.matrix.makeTranslation(anchor.x - origin.x, anchor.y - origin.y, anchor.z - origin.z).multiply(scaling.makeScale(scale, -scale, scale)).multiply(rotation);
          instance.layout = { view: viewRevision, lng: at[0], lat: at[1], offset };
        }
        marker?.getElement().classList.add('has-model');
        if (instance.mixer && !(reducedMotion ?? motion.matches)) { instance.mixer.update(delta); animate = true; }
      }
      camera.projectionMatrix.copy(projection).multiply(translation.makeTranslation(origin.x, origin.y, origin.z));
      renderer.resetState(); renderer.render(scene, camera); renderer.resetState();
      if (animate) map.triggerRepaint();
    },
    onRemove() { renderer?.dispose(); renderer = undefined; },
  };
  const restoreLayer = () => {
    if (disposed) return;
    if (!map.getLayer(id)) map.addLayer(layer);
    refresh();
  };
  map.on('style.load', restoreLayer);
  const contextLost = () => { lost = true; markers.forEach(m => m.getElement().classList.remove('has-model')); };
  const contextRestored = () => { lost = false; map.triggerRepaint(); };
  map.getCanvas().addEventListener('webglcontextlost', contextLost);
  map.getCanvas().addEventListener('webglcontextrestored', contextRestored);
  map.addLayer(layer);
  map.on('moveend', refresh);
  fetch('/models/stavangerz/manifest.json', { signal: abort.signal }).then(r => r.json()).then(manifest => { if (!disposed) { assets = manifest.assets ?? {}; refresh(); } }).catch(() => undefined);
  refresh();
  return { update(next) {
    // Only interpolate a reported advance on the same persistent route. Never
    // infer a journey from a queued order, area assignment or unknown position.
    for (const person of next.survivors) {
      const before = crewPositionFor(state, person.id), after = crewPositionFor(next, person.id);
      if (before?.kind !== 'transit' || after?.kind !== 'transit' || before.routeZoneIds.join('|') !== after.routeZoneIds.join('|') || after.atIndex !== before.atIndex + 1) continue;
      const from = zones.get(before.routeZoneIds[before.atIndex])?.at, to = zones.get(after.routeZoneIds[after.atIndex])?.at;
      if (from && to && map.getZoom() >= 12 && map.getBounds().contains(to)) journeys.set(person.id, { from, to, started: performance.now() });
    }
    state = next; refresh();
  }, setReducedMotion(value) { reducedMotion = value; journeys.clear(); for(const instance of instances.values()) { instance.mixer?.stopAllAction(); instance.animation = ''; } map.triggerRepaint(); }, destroy() {
    disposed = true; abort.abort(); journeys.clear(); map.off('moveend', refresh); map.off('style.load', restoreLayer);
    map.getCanvas().removeEventListener('webglcontextlost', contextLost); map.getCanvas().removeEventListener('webglcontextrestored', contextRestored);
    markers.forEach(m => m.remove()); markers.clear();
    instances.forEach(instance => instance.mixer?.stopAllAction()); instances.clear();
    if (map.getLayer(id)) map.removeLayer(id);
    templates.forEach(template => disposeObject(template.scene)); templates.clear(); scene.clear();
  } };
}
