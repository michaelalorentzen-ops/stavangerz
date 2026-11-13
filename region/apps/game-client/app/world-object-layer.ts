/** Local GLB strategy pieces. The placement register, never orders, owns positions. */
import type { Map as LibreMap, Marker, CustomLayerInterface } from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { crewPositionFor, knownCrewL3Zone } from '../../../packages/gameplay/src/region/location';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';

type Asset = { url: string; meters?: number | { height?: number }; scale?: number; animations?: string[] };
type Piece = { id: string; asset: string; at: [number, number]; title: string; animation: string; crew?: string; zone: string; offset?: number };
type Instance = { object: THREE.Group; mixer?: THREE.AnimationMixer; asset: string; animation: string };
export interface WorldObjectController { update(state: RegionState): void; destroy(): void }
export function attachWorldObjects(map: LibreMap, lib: typeof import('maplibre-gl'), world: RegionWorld, initial: RegionState, select: { onCrew(id: string, zoneId: string): void; onZone(id: string): void }): WorldObjectController {
  const id = 'stavangerz-world-objects';
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const loader = new GLTFLoader();
  const templates = new Map<string, { scene: THREE.Group; clips: THREE.AnimationClip[]; height: number }>();
  const instances = new Map<string, Instance>();
  const pending = new Set<string>();
  const journeys = new Map<string, { from: [number, number]; to: [number, number]; started: number }>();
  const markers = new Map<string, Marker>();
  const zones = new Map(world.zones.map(z => [z.id, z]));
  let assets: Record<string, Asset> = {}, pieces: Piece[] = [], state = initial, disposed = false, lost = false;
  let renderer: THREE.WebGLRenderer | undefined;
  const abort = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowPower = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2);
  const clock = new THREE.Clock();
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
      templates.set(assetId, { scene: gltf.scene, clips: gltf.animations, height: Math.max(.1, box.max.y - box.min.y) });
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
        visible.push({ id: person.id, asset: `crew-${identity}`, at, title: `${person.name} · ${zones.get(zoneId)?.name}`, animation: position?.kind === 'transit' ? 'Walk' : 'Idle', crew: person.id, zone: zoneId, offset });
      }
      const home = zones.get(state.homeZoneId)?.at;
      if (home && map.getBounds().contains(home)) {
        visible.push({ id: 'camp', asset: 'hq', at: home, title: 'Leiren', animation: 'Idle', zone: state.homeZoneId });
        if (Object.values(state.stock).some(n => n > 0)) visible.push({ id: 'camp-supplies', asset: 'supply-crates', at: home, title: 'Leirlager', animation: 'Idle', zone: state.homeZoneId, offset: -1 });
        if ((state.stock.boat ?? 0) > 0) visible.push({ id: 'camp-boat', asset: 'boat', at: home, title: 'Båt ved leiren', animation: 'Idle', zone: state.homeZoneId, offset: -2 });
      }
      for (const zone of world.zones) {
        const known = state.zones[zone.id];
        if (!zone.at || !known || !map.getBounds().contains(zone.at) || known.status === 'unknown') continue;
        if (known.status === 'controlled' && known.upgrades.some(u => /barricade|fence|wall|fort/i.test(u))) visible.push({ id: `defence-${zone.id}`, asset: 'barricade', at: zone.at, title: 'Forsvarsverk', animation: 'Idle', zone: zone.id });
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
        button.className = `rz-world-piece ${piece.crew ? 'rz-world-crew' : 'rz-world-prop'}`;
        button.title = piece.title; button.setAttribute('aria-label', piece.title);
        button.innerHTML = `<span class="rz-piece-fallback" aria-hidden="true">${piece.crew ? '●' : piece.asset === 'zombie' ? '⚠' : piece.asset === 'hq' ? '⌂' : '▥'}</span><span class="rz-piece-caption"></span>`;
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
    },
    render(_gl, options) {
      if (!renderer || disposed || lost || lowPower || map.getZoom() < 12) return;
      const projection = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix);
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
          if (clip && !motion.matches) instance.mixer?.clipAction(clip).play();
          instance.animation = piece.animation;
        }
        // Screen-space offset separates pieces sharing the same authoritative zone anchor.
        const journey = journeys.get(piece.id);
        let at = piece.at;
        if (journey && !motion.matches) {
          const progress = Math.min(1, (performance.now() - journey.started) / 650);
          at = [journey.from[0] + (journey.to[0] - journey.from[0]) * progress, journey.from[1] + (journey.to[1] - journey.from[1]) * progress];
          if (progress < 1) animate = true; else journeys.delete(piece.id);
          marker?.setLngLat(at);
        }
        const point = map.project(at);
        if (piece.crew) { point.x += 35 + (piece.offset ?? 0) * 42; point.y -= 8; } else { point.x += (piece.offset ?? 0) * 48; point.y += 8; }
        const lngLat = map.unproject(point);
        const anchor = lib.MercatorCoordinate.fromLngLat(lngLat, 0);
        const metersPerPixel = 40075016.686 * Math.cos(lngLat.lat * Math.PI / 180) / (512 * 2 ** map.getZoom());
        const scale = anchor.meterInMercatorCoordinateUnits() * metersPerPixel * (piece.crew ? 45 : piece.asset === 'hq' ? 64 : 36) / template.height;
        instance.object.matrixAutoUpdate = false;
        // glTF Y-up becomes map Z-up; reflection accounts for Mercator's south-positive Y.
        instance.object.matrix.makeTranslation(anchor.x, anchor.y, anchor.z).multiply(new THREE.Matrix4().makeScale(scale, -scale, scale)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        marker?.getElement().classList.add('has-model');
        if (instance.mixer && !motion.matches) { instance.mixer.update(delta); animate = true; }
      }
      camera.projectionMatrix.copy(projection);
      renderer.resetState(); renderer.render(scene, camera); renderer.resetState();
      if (animate) map.triggerRepaint();
    },
    onRemove() { renderer?.dispose(); renderer = undefined; },
  };
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
  }, destroy() {
    disposed = true; abort.abort(); journeys.clear(); map.off('moveend', refresh);
    map.getCanvas().removeEventListener('webglcontextlost', contextLost); map.getCanvas().removeEventListener('webglcontextrestored', contextRestored);
    markers.forEach(m => m.remove()); markers.clear();
    instances.forEach(instance => instance.mixer?.stopAllAction()); instances.clear();
    if (map.getLayer(id)) map.removeLayer(id);
    templates.forEach(template => disposeObject(template.scene)); templates.clear(); scene.clear();
  } };
}
