import type { Map as LibreMap } from 'maplibre-gl';

type Scene = { phase: number; knownZones: number; controlledZones: number };
type Target = { map: LibreMap; scene: () => Scene };
let target: Target | null = null;
let measurementRunning = false;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach(fn => fn());
export const subscribeBenchmarkMap = (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; };
export const hasBenchmarkMap = () => target !== null;
export function registerBenchmarkMap(map: LibreMap, scene: () => Scene) {
  const entry = { map, scene }; target = entry; notify();
  return () => { if (target === entry) { target = null; notify(); } };
}
export function classifyRenderer(renderer: string): 'software' | 'reported-gpu' | 'unknown' {
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render|lavapipe/i.test(renderer)) return 'software';
  if (!renderer || /^(WebKit WebGL|WebGL|ANGLE|unknown)$/i.test(renderer)) return 'unknown';
  return 'reported-gpu';
}
export function summarizeFrames(intervals: number[]) {
  const sorted = [...intervals].sort((a,b) => a-b);
  const averageMs = intervals.reduce((sum,n) => sum+n,0) / (intervals.length || 1);
  return { samples: intervals.length, averageMs, p95Ms: sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)] ?? 0, rafFps: averageMs ? 1000/averageMs : 0 };
}
function graphics(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) throw new Error('Kartets WebGL-kontekst er utilgjengelig.');
  if (gl.isContextLost()) throw new Error('Kartets grafikkontekst er tapt.');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  return { renderer, vendor: String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)), version: String(gl.getParameter(gl.VERSION)), classification: classifyRenderer(renderer) };
}
export type MapBenchmarkResult = {
  schema: 'stavangerz-map-benchmark-v1'; timestamp: string; durationMs: number; warmupMs: number;
  scene: Scene & { zoom: number; pitch: number; bearing: number };
  viewport: { width: number; height: number; dpr: number; canvasWidth: number; canvasHeight: number };
  graphics: ReturnType<typeof graphics>;
  assets: { styleLoaded: boolean; tilesLoaded: boolean; mapLoaded: boolean; modelMarkers: number };
  frames: ReturnType<typeof summarizeFrames> & { mapRenders: number; mapRendersPerSecond: number };
  limitations: string[];
};
/** Measures the existing public map scene. Never changes camera, game state or storage. */
export function runMapBenchmark(signal: AbortSignal, progress: (fraction: number) => void): Promise<MapBenchmarkResult> {
  const current = target;
  if (!current) return Promise.reject(new Error('Vent til kartet er klart.'));
  if (measurementRunning) return Promise.reject(new Error('En kartmåling pågår allerede.'));
  const { map } = current;
  const canvas = map.getCanvas();
  const durationMs = 10_000, warmupMs = 2_000;
  return new Promise((resolve,reject) => {
    measurementRunning = true;
    let raf = 0, start = 0, previous = 0, renders = 0, lastProgress = 0, measuring = false, settled = false;
    const intervals: number[] = [];
    const initialViewport = `${innerWidth}/${innerHeight}/${devicePixelRatio}`;
    let gpu: ReturnType<typeof graphics>;
    const cleanup = () => {
      measurementRunning = false; cancelAnimationFrame(raf); map.off('render', rendered); map.off('remove', removed);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', lost, true);
      window.removeEventListener('resize', resized); signal.removeEventListener('abort', aborted);
    };
    const fail = (message: string) => { if (settled) return; settled = true; cleanup(); reject(new Error(message)); };
    const rendered = () => { if (measuring) renders++; };
    const visibility = () => { if (document.hidden) fail('Målingen ble avbrutt fordi fanen ble skjult.'); };
    const lost = () => fail('Målingen ble avbrutt: grafikkonteksten gikk tapt.');
    const removed = () => fail('Målingen ble avbrutt fordi kartet ble lukket.');
    const resized = () => { if (`${innerWidth}/${innerHeight}/${devicePixelRatio}` !== initialViewport) fail('Målingen ble avbrutt fordi skjermstørrelsen endret seg.'); };
    const aborted = () => fail('Målingen ble avbrutt.');
    const tick = (now: number) => {
      try {
      if (settled) return;
      if (!start) start = now;
      if (target !== current) return removed();
      if (now-start >= warmupMs) {
        if (measuring && previous) intervals.push(now-previous);
        measuring = true; previous = now;
      }
      if (now-lastProgress >= 250) { progress(Math.min(1,(now-start)/(warmupMs+durationMs))); lastProgress = now; }
      if (now-start >= warmupMs+durationMs) {
        const measuredMs = now-start-warmupMs;
        const assets = { styleLoaded: !!map.isStyleLoaded(), tilesLoaded: map.areTilesLoaded(), mapLoaded: map.loaded(), modelMarkers: map.getContainer().querySelectorAll('.has-model').length };
        settled = true; cleanup();
        resolve({ schema:'stavangerz-map-benchmark-v1', timestamp:new Date().toISOString(), durationMs:measuredMs, warmupMs,
          scene:{...current.scene(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()},
          viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:canvas.width,canvasHeight:canvas.height}, graphics:gpu, assets,
          frames:{...summarizeFrames(intervals),mapRenders:renders,mapRendersPerSecond:renders/(measuredMs/1000)},
          limitations:['Foreground requestAnimationFrame intervals, not GPU timer queries.','Only the current scene and resolution; no camera movement.','Renderer strings are browser reports, not proof of physical hardware.','Tile/style readiness is reported; model marker count does not prove every asset loaded.'] });
        return;
      }
      map.triggerRepaint(); raf = requestAnimationFrame(tick);
      } catch { fail('Målingen ble avbrutt fordi kartet ikke lenger var tilgjengelig.'); }
    };
    try { gpu = graphics(canvas); } catch (error) { cleanup(); reject(error); return; }
    if (signal.aborted || document.hidden) { cleanup(); reject(new Error('Åpne kartet i en synlig fane før måling.')); return; }
    map.on('render',rendered); map.on('remove',removed);
    document.addEventListener('visibilitychange',visibility); canvas.addEventListener('webglcontextlost',lost,true);
    window.addEventListener('resize',resized); signal.addEventListener('abort',aborted);
    raf = requestAnimationFrame(tick);
  });
}
