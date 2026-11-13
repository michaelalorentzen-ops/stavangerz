'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { hasBenchmarkMap, runMapBenchmark, subscribeBenchmarkMap, type MapBenchmarkResult } from './map-benchmark';
import './performance-benchmark.css';

export default function PerformanceBenchmark() {
  const available = useSyncExternalStore(subscribeBenchmarkMap,hasBenchmarkMap,()=>false);
  const [running,setRunning] = useState(false);
  const [progress,setProgress] = useState(0);
  const [result,setResult] = useState<MapBenchmarkResult | null>(null);
  const [message,setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { const active = controller.current; controller.current = null; active?.abort(); document.documentElement.classList.remove('sz-benchmark-running'); },[]);
  useEffect(() => {
    if (!running) return;
    const overlays = [...document.querySelectorAll<HTMLElement>('.sz-game > .rz-overlay')];
    const previous = overlays.map(el=>el.inert);
    overlays.forEach(el=>{el.inert=true;});
    document.documentElement.classList.add('sz-benchmark-running');
    const key = (event: KeyboardEvent) => { event.stopImmediatePropagation(); if(event.key==='Escape') {event.preventDefault();controller.current?.abort();} };
    window.addEventListener('keydown',key,true);
    return () => { document.documentElement.classList.remove('sz-benchmark-running'); overlays.forEach((el,i)=>{el.inert=previous[i];}); window.removeEventListener('keydown',key,true); startButton.current?.focus(); };
  },[running]);
  async function start() {
    const abort = new AbortController(); controller.current = abort;
    setRunning(true); setResult(null); setMessage(''); setProgress(0);
    // Let React hide the blurred settings dialog before the warmup starts.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    try { const measured = await runMapBenchmark(abort.signal,setProgress); if(controller.current===abort) setResult(measured); }
    catch(error) { if(controller.current===abort) setMessage(error instanceof Error ? error.message : 'Målingen mislyktes.'); }
    finally { if(controller.current===abort) {controller.current=null;setRunning(false);} }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(JSON.stringify(result,null,2)); setMessage('Målingen er kopiert.'); }
    catch { setMessage('Kopiering er ikke tilgjengelig. Last ned JSON i stedet.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='stavangerz-map-benchmark.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const label = result?.graphics.classification==='software' ? 'Programvarerendering' : result?.graphics.classification==='reported-gpu' ? 'GPU rapportert av nettleseren' : 'Ukjent renderer';
  return <section className="sz-benchmark" aria-label="Kartytelse">
    <h3>Kartytelse</h3>
    <p>Mål dette kartutsnittet i 12 sekunder. Spillet står stille. Hold fanen synlig og skjermstørrelsen uendret.</p>
    <button ref={startButton} type="button" disabled={!available || running} onClick={start}>Mål kartytelse</button>
    {!available && <small>Venter på kartet.</small>}
    {result && <div className="sz-benchmark-result">
      <strong>{result.frames.mapRendersPerSecond.toFixed(1)} kartbilder/s · {label}</strong>
      <span>RAF-bildetid {result.frames.averageMs.toFixed(1)} ms · p95 {result.frames.p95Ms.toFixed(1)} ms</span>
      <span>{result.viewport.width} × {result.viewport.height} · DPR {result.viewport.dpr}</span>
      <small>{result.frames.mapRenders} kartbilder målt · {result.frames.rafFps.toFixed(1)} RAF/s</small>
      <small>{result.graphics.renderer}</small>
      <small>{result.assets.styleLoaded && result.assets.tilesLoaded ? 'Kartstil og kartfliser klare.' : 'Kartressurser var fortsatt under lasting.'} {result.assets.modelMarkers} modellmarkører.</small>
      <small>Gjelder bare dette utsnittet. Nettleserens GPU-navn bekrefter ikke fysisk maskinvare.</small>
      <div><button type="button" onClick={copy}>Kopier JSON</button><button type="button" onClick={download}>Last ned JSON</button></div>
    </div>}
    <p role="status">{message}</p>
    {running && createPortal(<div className="sz-benchmark-shield" role="dialog" aria-modal="true" aria-label="Måler kartytelse"><div className="sz-benchmark-running-hud"><strong>Måler kartytelse · {Math.ceil(12*(1-progress))} s</strong><progress value={progress} max={1}/><button type="button" autoFocus onClick={()=>controller.current?.abort()}>Avbryt (Esc)</button></div></div>,document.body)}
  </section>;
}
