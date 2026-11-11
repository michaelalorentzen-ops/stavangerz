'use client';

/** Stavanger Z, the region game: the whole Stavanger region from the zone editor, one day at a time. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LibreMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import {
  ACTIONS, MILESTONES, MODULE_COST, NETWORK_COST, SAVE_KEY_REGION, UPGRADE_COST, VALUE, WEAPONS,
  controlled, craftRecipes, dateText, endDay, hqModules, indexWorld, living, moduleName, moraleTarget, newRegionGame, previewOrder,
  reach, resolveEvent, resourceName, residents, searchHoursTotal, season, trade, tradeValue, upgradeName, upgradesFor,
  type ActionId, type RegionOrder, type RegionReport, type RegionState, type RegionWorld,
} from '../../../packages/gameplay/src/region/index';
import { CONTENT, takeoverEffort } from '../../../packages/world-data/src/content';
import './region.css';

const WORLD_URL = '/world/region-v1.json';
const ZONE_EDITOR_URL = 'http://127.0.0.1:5178/';
const CORE = ['food', 'water', 'medicine', 'fuel', 'ammo', 'building'];
const STATUS_LABEL = { unknown: 'Ukjent', scouted: 'Speidet', controlled: 'Deres' } as const;
const number = (n: number) => Math.round(n).toLocaleString('nb-NO');
const decimal = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });

type Modal = null | 'report' | 'trade' | 'goals' | 'menu' | 'stock';

function load(): RegionState | null {
  try { const raw = localStorage.getItem(SAVE_KEY_REGION); return raw ? JSON.parse(raw) as RegionState : null; } catch { return null; }
}
function persist(state: RegionState | null) {
  try { if (state) localStorage.setItem(SAVE_KEY_REGION, JSON.stringify(state)); else localStorage.removeItem(SAVE_KEY_REGION); } catch { /* private mode */ }
}

export default function RegionGame() {
  const [world, setWorld] = useState<RegionWorld | null>(null);
  const [state, setState] = useState<RegionState | null>(null);
  const [saved, setSaved] = useState<RegionState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(WORLD_URL).then(r => r.json()).then((w: RegionWorld) => { setWorld(w); setSaved(load()); }).catch(e => setError(`Fant ikke spillverdenen: ${e.message}`));
  }, []);
  useEffect(() => { if (state) persist(state); }, [state]);
  if (error) return <main className="rz-shell rz-center"><p>{error}</p></main>;
  if (!world) return <main className="rz-shell rz-center"><p>Laster kartet over Stavanger …</p></main>;
  if (!state) return <StartScreen world={world} saved={saved} onStart={s => { setState(s); setSaved(s); }} />;
  return <Play world={world} state={state} setState={setState} onQuit={() => { setState(null); setSaved(load()); }} />;
}

// ------------------------------------------------------------------ start

function StartScreen({ world, saved, onStart }: { world: RegionWorld; saved: RegionState | null; onStart: (s: RegionState) => void }) {
  const index = indexWorld(world);
  const [choice, setChoice] = useState(world.starts[0]?.zoneId ?? '');
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const options = world.starts.map(start => {
    const zone = index.byId.get(start.zoneId)!;
    const near = (index.adjacent.get(start.zoneId) ?? []).map(a => index.byId.get(a.to)!);
    const pressure = near.reduce((n, z) => n + residents(z), 0) * .12;
    const effort = zone.measures ? takeoverEffort(zone.measures) : null;
    const level = pressure > 900 ? 'Svært krevende' : pressure > 450 ? 'Krevende' : pressure > 150 ? 'Middels' : 'Rolig';
    return { start, zone, pressure, effort, level };
  });
  return <main className="rz-shell rz-start">
    <section className="rz-start-intro">
      <p className="rz-kicker">STAVANGER Z / ETTER DAG NULL</p>
      <h1>Hele regionen.<br />Ett døgn av gangen.</h1>
      <p>Fire overlevende må finne et sted å holde. Zombiene vandrer over grensene og følger lyden. Hver bru og tunnel er et valg. Hold, sperr eller spreng.</p>
      <p>Velg hvor dere starter. Tette byområder har mye å finne og mange døde. På landet er det jord og diesel, men lange avstander.</p>
      {saved && !saved.gameOver && <button className="rz-primary rz-wide" onClick={() => onStart(saved)}>Fortsett dag {saved.day} i {index.byId.get(saved.startZoneId)?.name} →</button>}
      <p className="rz-small">Spillet lagres automatisk i nettleseren. <a href="/fase1">Den første Buøy-prototypen</a> · <a href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Soneeditoren ↗</a></p>
    </section>
    <section className="rz-start-list" aria-label="Startområder">
      {options.map(o => <label key={o.start.zoneId} className={`rz-start-card ${choice === o.start.zoneId ? 'on' : ''}`}>
        <input type="radio" name="start" value={o.start.zoneId} checked={choice === o.start.zoneId} onChange={() => setChoice(o.start.zoneId)} />
        <strong>{o.start.name}</strong>
        <span>{o.start.district} · {CONTENT.zoneTypes.find(t => t[0] === o.zone.type)?.[1] ?? 'Ukjent type'} · {o.level}</span>
        {o.start.hqNearby.length > 0 && <small>HQ i nærheten: {o.start.hqNearby.join(', ')}</small>}
      </label>)}
      <div className="rz-start-go">
        <label>Frø <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 1)} /></label>
        <button className="rz-primary" data-testid="start-game" onClick={() => {
          if (saved && !saved.gameOver && !confirm('En ny gjennomspilling erstatter den lagrede. Fortsette?')) return;
          onStart(newRegionGame(world, choice, seed));
        }}>Start på dag 0 →</button>
      </div>
    </section>
  </main>;
}

// ------------------------------------------------------------------ play

function Play({ world, state, setState, onQuit }: { world: RegionWorld; state: RegionState; setState: (s: RegionState) => void; onQuit: () => void }) {
  const index = indexWorld(world);
  const [selected, setSelected] = useState(state.homeZoneId);
  const [crew, setCrew] = useState<string[]>([]);
  const [orders, setOrders] = useState<RegionOrder[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [report, setReport] = useState<RegionReport | null>(null);
  const [message, setMessage] = useState('');
  const hops = useMemo(() => reach(state, world), [state, world]);
  const busy = new Set(orders.flatMap(o => o.survivorIds));
  const people = living(state);
  const zone = index.byId.get(selected);

  const addOrder = (action: ActionId, target?: string) => {
    const order: RegionOrder = { id: `o${state.day}-${orders.length}-${Date.now() % 100000}`, action, zoneId: selected, survivorIds: crew, target };
    const p = previewOrder(state, world, order);
    if (!p.valid) { setMessage(p.errors.join(' ')); return; }
    setOrders([...orders, order]); setCrew([]); setMessage('');
  };
  const finishDay = () => {
    try {
      const result = endDay(state, world, orders);
      setState(result.state); setOrders([]); setCrew([]); setReport(result.report); setModal('report');
    } catch (e) { setMessage((e as Error).message); }
  };
  const choose = (choiceId: string) => {
    try { setState(resolveEvent(state, world, choiceId).state); } catch (e) { setMessage((e as Error).message); }
  };
  // For automated testers: the current state, world and plan, read-only.
  useEffect(() => { (window as unknown as { __szRegion?: unknown }).__szRegion = { state, world, orders, selected }; }, [state, world, orders, selected]);
  const s = season(state.day);
  return <main className="rz-shell rz-play">
    <header className="rz-top">
      <div className="rz-brand">STAVANGER Z<small>{index.byId.get(state.startZoneId)?.name}</small></div>
      <div className="rz-day"><strong>DAG {state.day}</strong><span>{dateText(state.day)} · {s.name}</span></div>
      <div className="rz-morale" title={`Moral trekker mot ${Math.round(moraleTarget(state))}`}><span>Moral</span><meter min={0} max={100} low={30} high={60} optimum={80} value={state.morale} /><b>{Math.round(state.morale)}</b></div>
      <div className="rz-stock">{CORE.map(id => <span key={id} className={(state.stock[id] ?? 0) < people.length * 3 && ['food', 'water'].includes(id) ? 'low' : ''}><b>{number(state.stock[id] ?? 0)}</b>{resourceName(id)}</span>)}
        <button onClick={() => setModal('stock')}>Lager</button></div>
      <nav className="rz-nav">
        <button onClick={() => setModal('goals')}>Mål {state.milestones.length}/{MILESTONES.length}</button>
        <button onClick={() => setModal('trade')}>Grupper {state.factions.filter(f => f.known).length}</button>
        <button onClick={() => { setReport(state.reports.at(-1) ?? null); setModal('report'); }} disabled={!state.reports.length}>Rapport</button>
        <button onClick={() => setModal('menu')}>Meny</button>
      </nav>
    </header>
    <aside className="rz-left" aria-label="Mannskap og dagsplan">
      <h2>Mannskap <small>velg folk, så en handling</small></h2>
      {people.map(p => <button key={p.id} className={`rz-person ${crew.includes(p.id) ? 'on' : ''} ${busy.has(p.id) ? 'busy' : ''}`} disabled={busy.has(p.id)}
        aria-pressed={crew.includes(p.id)} onClick={() => setCrew(crew.includes(p.id) ? crew.filter(x => x !== p.id) : [...crew, p.id])}>
        <strong>{p.name}</strong><span>{p.role} · {WEAPONS[p.weapon].label}</span>
        <i className="rz-bar"><b style={{ width: `${p.health}%` }} /></i>
        <small>Helse {Math.round(p.health)} · Utmattet {Math.round(p.fatigue)} · K{p.skills.combat} S{p.skills.scouting} H{p.skills.craft} M{p.skills.medical}</small>
      </button>)}
      <h2>Dagsplan</h2>
      {!orders.length && <p className="rz-small">Ingen oppdrag. Folk som ikke har oppdrag, hviler og forsvarer leiren.</p>}
      {orders.map(o => <div key={o.id} className="rz-order"><span><b>{ACTIONS[o.action].label}</b> {index.byId.get(o.zoneId)?.name}{o.target ? ` · ${targetName(world, o)}` : ''}<small>{o.survivorIds.map(id => state.survivors.find(p => p.id === id)?.name).join(', ')}</small></span>
        <button aria-label="Fjern oppdrag" onClick={() => setOrders(orders.filter(x => x.id !== o.id))}>×</button></div>)}
      <button className="rz-primary rz-end" data-testid="end-day" disabled={!!state.event || !!state.gameOver} onClick={finishDay}>Avslutt dag {state.day} →</button>
      {message && <p className="rz-message" role="alert">{message}</p>}
    </aside>
    <RegionMap world={world} state={state} selected={selected} hops={hops} onSelect={setSelected} />
    <aside className="rz-right" aria-label="Valgt sone">
      {zone && <ZonePanel world={world} state={state} zoneId={selected} crew={crew} hops={hops.get(selected)} onOrder={addOrder} />}
    </aside>
    {state.event && <div className="rz-overlay"><section className="rz-dialog rz-event" role="dialog" aria-label={state.event.title}>
      <p className="rz-kicker">HENDELSE · DAG {state.day}</p><h2>{state.event.title}</h2><p>{state.event.text}</p>
      {state.event.choices.map(c => <button key={c.id} disabled={!!c.disabled} onClick={() => choose(c.id)}><strong>{c.label}</strong><small>{c.disabled ?? c.detail}</small></button>)}
    </section></div>}
    {state.gameOver && <div className="rz-overlay"><section className="rz-dialog"><h2>Slutt etter {state.gameOver.day} dager</h2><p>{state.gameOver.reason}</p>
      <p>{controlled(state).length} soner, {state.milestones.length} milepæler, {state.counters.killed ?? 0} zombier drept.</p>
      <button className="rz-primary" onClick={() => { persist(null); onQuit(); }}>Ny gjennomspilling</button></section></div>}
    {modal && <div className="rz-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><section className="rz-dialog rz-wide-dialog">
      <button className="rz-close" aria-label="Lukk" onClick={() => setModal(null)}>×</button>
      {modal === 'report' && report && <ReportView world={world} report={report} onZone={id => { setSelected(id); setModal(null); }} />}
      {modal === 'trade' && <TradeView state={state} onTrade={(id, give, take) => { try { const r = trade(state, id, give, take); setState(r.state); setMessage(r.message); } catch (e) { setMessage((e as Error).message); } }} message={message} />}
      {modal === 'goals' && <><h2>Mål</h2><ol className="rz-goals">{MILESTONES.map(m => <li key={m.id} className={state.milestones.includes(m.id) ? 'done' : ''}><b>{m.title}</b> {m.text}</li>)}</ol></>}
      {modal === 'stock' && <><h2>Lager</h2><div className="rz-stock-grid">{CONTENT.resources.filter(r => r.layer !== 'capacity').map(r => <span key={r.id}><b>{number(state.stock[r.id] ?? 0)}</b>{r.name}</span>)}</div></>}
      {modal === 'menu' && <><h2>Meny</h2>
        <p>Frø {state.seed} · Regler {state.rulesVersion} · Verden {state.worldVersion}</p>
        <button onClick={() => { const blob = new Blob([JSON.stringify(state)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stavanger-z-dag-${state.day}.json`; a.click(); }}>Last ned lagring</button>
        <button onClick={() => { if (confirm('Avslutte og starte på nytt? Lagringen slettes.')) { persist(null); onQuit(); } }}>Ny gjennomspilling</button>
        <a className="rz-link" href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Åpne soneeditoren ↗</a></>}
    </section></div>}
  </main>;
}

function targetName(world: RegionWorld, o: RegionOrder) {
  if (!o.target) return '';
  if (o.action === 'build') return upgradeName(o.target);
  if (o.action === 'module') return moduleName(o.target);
  if (o.action === 'network') return CONTENT.networks.find(n => n.id === o.target)?.name ?? o.target;
  if (['hold', 'block', 'blow'].includes(o.action)) return world.links.find(l => l.id === o.target)?.name ?? o.target;
  return o.target;
}

// ------------------------------------------------------------------ zone panel and actions

function ZonePanel({ world, state, zoneId, crew, hops, onOrder }: { world: RegionWorld; state: RegionState; zoneId: string; crew: string[]; hops?: number; onOrder: (a: ActionId, target?: string) => void }) {
  const index = indexWorld(world);
  const zone = index.byId.get(zoneId)!;
  const z = state.zones[zoneId];
  const l2 = index.byId.get(zone.parentId ?? '');
  const l1 = index.byId.get(l2?.parentId ?? '');
  const faction = state.factions.find(f => f.zoneId === zoneId);
  const pois = index.poisByZone.get(zoneId) ?? [];
  const links = world.links.filter(l => l.a === zoneId || l.b === zoneId);
  const effort = zone.measures ? takeoverEffort(zone.measures) : null;
  const known = z.status !== 'unknown';
  const owned = z.status === 'controlled';
  const total = searchHoursTotal(zone);
  const actions: { action: ActionId; targets?: { id: string; name: string }[] }[] = [];
  if (!owned) actions.push({ action: 'scout' }, { action: 'clear' }, { action: 'search' }, { action: 'claim' });
  if (owned) {
    actions.push({ action: 'search' }, { action: 'clear' }, { action: 'guard' }, { action: 'fortify' });
    actions.push({ action: 'build', targets: upgradesFor(state, world, zoneId).map(u => ({ id: u.id, name: `${u.name} (${costLabel(UPGRADE_COST[u.id]?.cost)})` })) });
    if (!state.hq) actions.push({ action: 'establishHq' });
    actions.push({ action: 'network', targets: CONTENT.networks.filter(n => !(state.networks[zone.parentId ?? ''] ?? []).includes(n.id)).map(n => ({ id: n.id, name: `${n.name} (${costLabel(NETWORK_COST[n.id].cost)})` })) });
    if ((zone.measures?.farm ?? 0) > 0 || z.upgrades.includes('field') || z.upgrades.includes('demolishField')) actions.push({ action: 'farm' });
    if (index.coastal.has(zoneId)) actions.push({ action: 'fish' });
  }
  if (zoneId === state.homeZoneId) actions.push({ action: 'rest' }, { action: 'heal' });
  if (state.hq?.zoneId === zoneId) {
    actions.push({ action: 'module', targets: hqModules(state).map(m => ({ id: m, name: `${moduleName(m)} (${costLabel(MODULE_COST[m]?.cost)})` })) });
    const recipes = craftRecipes(state);
    if (recipes.length) actions.push({ action: 'craft', targets: recipes.map(r => ({ id: r.id, name: r.name })) });
  }
  if (links.length) for (const a of ['hold', 'block', 'blow'] as ActionId[]) actions.push({ action: a, targets: links.map(l => ({ id: l.id, name: `${l.name} (${state.chokepoints[l.id] === 'open' ? 'åpen' : chokeLabel(state.chokepoints[l.id])})` })) });
  return <div className="rz-zone">
    <p className="rz-kicker">{l1?.name} · {l2?.name}</p>
    <h1>{zone.name}</h1>
    <p className="rz-tags"><span className={`rz-status rz-${z.status}`}>{faction ? faction.name : STATUS_LABEL[z.status]}</span>
      <span>{CONTENT.zoneTypes.find(t => t[0] === zone.type)?.[1] ?? 'Ukjent type'}</span>
      {zoneId === state.homeZoneId && <span>★ Leiren</span>}
      {hops !== undefined ? <span>{hops ? `${hops} steg unna` : 'Her er dere'}</span> : <span>Utenfor rekkevidde</span>}</p>
    <dl className="rz-facts">
      <dt>Zombier</dt><dd>{z.intel ? `${z.intel.min}–${z.intel.max}${z.intel.day < state.day ? ` (dag ${z.intel.day})` : ''}` : 'Ukjent'}</dd>
      {effort && <><dt>Vanskelighet</dt><dd>{effort.level}, ca. {number(effort.hours)} arbeidstimer</dd></>}
      <dt>Gjennomsøkt</dt><dd>{Math.round(Math.min(100, z.searched / total * 100))} % av {number(total)} timer</dd>
      {zone.measures && <><dt>Husrom</dt><dd>ca. {number(zone.measures.floor / 30)} personer</dd>
        <dt>Jord</dt><dd>{decimal(zone.measures.farm / 1e4)} ha i drift, {decimal((zone.measures.pasture ?? 0) / 1e4)} ha beite</dd>
        <dt>Kyst</dt><dd>{zone.measures.coastM ? `${decimal(zone.measures.coastM / 1000)} km` : 'Ingen'}</dd></>}
      {known && <><dt>Kan finnes</dt><dd>{Object.entries(z.loot).filter(([, n]) => n >= 1).sort((a, b) => b[1] * (VALUE[b[0]] ?? 1) - a[1] * (VALUE[a[0]] ?? 1)).slice(0, 6).map(([id, n]) => `${number(n)} ${resourceName(id).toLowerCase()}`).join(', ') || 'Lite igjen'}</dd></>}
      {z.upgrades.length > 0 && <><dt>Bygget</dt><dd>{z.upgrades.map(upgradeName).join(', ')}</dd></>}
      {z.building && <><dt>Under bygging</dt><dd>{upgradeName(z.building.id)}, {Math.round(z.building.hours)} timer</dd></>}
      {state.hq?.zoneId === zoneId && <><dt>HQ</dt><dd>{CONTENT.hqTypes.find(t => t.id === state.hq!.type)?.name ?? 'Leir'}: {state.hq.modules.map(moduleName).join(', ') || 'ingen moduler'}</dd></>}
      {(state.networks[zone.parentId ?? ''] ?? []).length > 0 && <><dt>Nett i området</dt><dd>{state.networks[zone.parentId ?? ''].map(n => CONTENT.networks.find(x => x.id === n)?.name).join(', ')}</dd></>}
      {pois.filter(p => p.role && p.role !== 'resource').length > 0 && <><dt>Steder</dt><dd>{pois.filter(p => p.role && p.role !== 'resource').map(p => p.name).join(', ')}</dd></>}
      {links.length > 0 && <><dt>Bru og tunnel</dt><dd>{links.map(l => `${l.name}: ${chokeLabel(state.chokepoints[l.id])}`).join(', ')}</dd></>}
    </dl>
    {faction && <p className="rz-small">{faction.about} {faction.known ? 'Dere har kontakt. Handle under Grupper.' : 'Speid i nærheten for å få kontakt.'}</p>}
    {!faction && <>
      <h2>Handlinger {crew.length ? <small>{crew.length} valgt</small> : <small>velg folk til venstre først</small>}</h2>
      <div className="rz-actions">{actions.filter(a => !a.targets || a.targets.length).map(a => <ActionRow key={a.action} world={world} state={state} zoneId={zoneId} crew={crew} action={a.action} targets={a.targets} onOrder={onOrder} />)}</div>
    </>}
  </div>;
}
const chokeLabel = (s: string) => ({ open: 'åpen', held: 'holdes', blocked: 'sperret', blown: 'sprengt', flooded: 'under vann' } as Record<string, string>)[s] ?? s;
const costLabel = (cost?: Record<string, number>) => cost && Object.keys(cost).length ? Object.entries(cost).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(', ') : 'gratis';

function ActionRow({ world, state, zoneId, crew, action, targets, onOrder }: { world: RegionWorld; state: RegionState; zoneId: string; crew: string[]; action: ActionId; targets?: { id: string; name: string }[]; onOrder: (a: ActionId, t?: string) => void }) {
  const [target, setTarget] = useState(targets?.[0]?.id);
  useEffect(() => { if (targets && !targets.some(t => t.id === target)) setTarget(targets[0]?.id); }, [targets, target]);
  const preview = crew.length ? previewOrder(state, world, { action, zoneId, survivorIds: crew, target }) : null;
  return <div className={`rz-action ${preview?.valid ? 'ok' : ''}`}>
    <div><b>{ACTIONS[action].label}</b><small>{ACTIONS[action].help}</small>
      {targets && <select aria-label={`Velg for ${ACTIONS[action].label}`} value={target} onChange={e => setTarget(e.target.value)}>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
      {preview && <small className={preview.valid ? 'rz-preview' : 'rz-errors'}>{preview.valid ? `${preview.text} ${preview.hours} timer. Risiko: ${preview.risk}.${Object.keys(preview.costs).length ? ` Koster ${costLabel(preview.costs)}.` : ''}` : preview.errors.join(' ')}</small>}
    </div>
    <button disabled={!preview?.valid} onClick={() => onOrder(action, target)}>Legg til</button>
  </div>;
}

// ------------------------------------------------------------------ report and trade

function ReportView({ world, report, onZone }: { world: RegionWorld; report: RegionReport; onZone: (id: string) => void }) {
  void world;
  return <><p className="rz-kicker">RAPPORT · DAG {report.day}</p><h2>Natten er over</h2>
    <p className="rz-small">Mat: +{report.food.produced} / −{report.food.eaten} · Vann: +{report.water.produced} / −{report.water.drunk} · {report.killed} zombier drept · {report.zombiesMoved} zombier flyttet seg i regionen</p>
    <ul className="rz-report">{report.lines.map((l, i) => <li key={i} className={`rz-${l.tone}`}><b>{l.title}</b> {l.text}{l.zoneId && <button className="rz-link" onClick={() => onZone(l.zoneId!)}>Vis</button>}</li>)}</ul></>;
}

function TradeView({ state, onTrade, message }: { state: RegionState; onTrade: (id: string, give: Record<string, number>, take: Record<string, number>) => void; message: string }) {
  const known = state.factions.filter(f => f.known);
  const [fid, setFid] = useState(known[0]?.id);
  const [give, setGive] = useState<Record<string, number>>({});
  const [take, setTake] = useState<Record<string, number>>({});
  const f = known.find(x => x.id === fid);
  if (!known.length) return <><h2>Grupper</h2><p>Dere har ikke kontakt med noen ennå. Speid rundt, finn en radio eller vent på hendelser.</p></>;
  const v = f ? tradeValue(state, f, give, take) : null;
  const ourItems = Object.keys(state.stock).filter(id => (state.stock[id] ?? 0) >= 1 && VALUE[id]);
  const step = (set: typeof setGive, obj: Record<string, number>, id: string, d: number, max: number) => set({ ...obj, [id]: Math.max(0, Math.min(max, (obj[id] ?? 0) + d)) });
  return <><h2>Grupper</h2>
    <div className="rz-tabs">{known.map(x => <button key={x.id} className={x.id === fid ? 'on' : ''} onClick={() => { setFid(x.id); setGive({}); setTake({}); }}>{x.name}</button>)}</div>
    {f && <><p>{f.about} Forhold: <b>{f.relation}</b>. De vil ha {f.wants.map(w => resourceName(w).toLowerCase()).join(', ')}.</p>
      <div className="rz-trade">
        <div><h3>Dere gir</h3>{ourItems.map(id => <div key={id} className="rz-trade-row"><span>{resourceName(id)} <small>({number(state.stock[id])})</small></span>
          <button onClick={() => step(setGive, give, id, -5, state.stock[id])}>−</button><b>{give[id] ?? 0}</b><button onClick={() => step(setGive, give, id, 5, state.stock[id])}>+</button></div>)}</div>
        <div><h3>Dere får</h3>{Object.keys(f.stock).filter(id => f.stock[id] >= 1).map(id => <div key={id} className="rz-trade-row"><span>{resourceName(id)} <small>({number(f.stock[id])})</small></span>
          <button onClick={() => step(setTake, take, id, -1, f.stock[id])}>−</button><b>{take[id] ?? 0}</b><button onClick={() => step(setTake, take, id, 1, f.stock[id])}>+</button></div>)}</div>
      </div>
      {v && <p className={v.fair ? 'rz-good' : 'rz-errors'}>Verdien dere gir: {v.worthGive}. Verdien dere får: {v.worthTake}. {v.fair ? 'De går med på det.' : 'De vil ha mer.'}</p>}
      <button className="rz-primary" disabled={!v?.fair} onClick={() => { onTrade(f.id, Object.fromEntries(Object.entries(give).filter(([, n]) => n > 0)), Object.fromEntries(Object.entries(take).filter(([, n]) => n > 0))); setGive({}); setTake({}); }}>Bytt</button>
      {message && <p className="rz-small">{message}</p>}</>}
  </>;
}

// ------------------------------------------------------------------ map

function RegionMap({ world, state, selected, hops, onSelect }: { world: RegionWorld; state: RegionState; selected: string; hops: Map<string, number>; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const index = indexWorld(world);
  useEffect(() => {
    let map: LibreMap | null = null;
    let cancelled = false;
    import('maplibre-gl').then(lib => {
      if (cancelled || !ref.current) return;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const home = index.byId.get(state.homeZoneId)?.at ?? [5.73, 58.97];
      map = new lib.Map({
        container: ref.current, center: home, zoom: 14, minZoom: 9, maxZoom: 18, dragRotate: false, pitchWithRotate: false, attributionControl: false,
        style: { version: 8, sources: { topo: { type: 'raster', tileSize: 256, maxzoom: 18, attribution: '© Kartverket',
          tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'] } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0f1a1c' } },
          { id: 'topo', type: 'raster', source: 'topo', paint: { 'raster-opacity': .55, 'raster-saturation': -.85, 'raster-brightness-max': .55, 'raster-contrast': .1 } }] },
      });
      map.addControl(new lib.AttributionControl({ compact: true, customAttribution: world.sources.join(' · ') }));
      map.on('load', () => {
        const l3 = world.zones.filter(z => z.level === 3 && z.geometry).map(z => ({ type: 'Feature' as const, id: z.id, properties: { id: z.id }, geometry: z.geometry as GeoJSON.Geometry }));
        const outlines = (level: number) => world.zones.filter(z => z.level === level && z.geometry).map(z => ({ type: 'Feature' as const, properties: { id: z.id }, geometry: z.geometry as GeoJSON.Geometry }));
        map!.addSource('l3', { type: 'geojson', data: { type: 'FeatureCollection', features: l3 }, promoteId: 'id' });
        map!.addSource('l2', { type: 'geojson', data: { type: 'FeatureCollection', features: outlines(2) } });
        map!.addSource('l1', { type: 'geojson', data: { type: 'FeatureCollection', features: outlines(1) } });
        const links = world.links.map(l => ({ type: 'Feature' as const, properties: { id: l.id, kind: l.kind }, geometry: { type: 'LineString' as const, coordinates: [index.byId.get(l.a)!.at!, index.byId.get(l.b)!.at!] } }));
        map!.addSource('links', { type: 'geojson', data: { type: 'FeatureCollection', features: links }, promoteId: 'id' });
        map!.addSource('marks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map!.addLayer({ id: 'l3-fill', type: 'fill', source: 'l3', paint: {
          'fill-color': ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled', '#4f9a6b', 'faction', '#8a6fc4', 'scouted',
            ['interpolate', ['linear'], ['coalesce', ['feature-state', 'z'], 0], 0, '#7f8f5a', 20, '#b39046', 80, '#b4553f', 300, '#7c2230'], '#1d2a2c'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'reach'], false], .62, .38] } });
        map!.addLayer({ id: 'l3-line', type: 'line', source: 'l3', paint: { 'line-color': '#0c1416', 'line-width': .6, 'line-opacity': .7 } });
        map!.addLayer({ id: 'l2-line', type: 'line', source: 'l2', paint: { 'line-color': '#d9d2b0', 'line-width': 1.2, 'line-opacity': .45 } });
        map!.addLayer({ id: 'l1-line', type: 'line', source: 'l1', paint: { 'line-color': '#f2e2a0', 'line-width': 2.6, 'line-opacity': .6 } });
        map!.addLayer({ id: 'links', type: 'line', source: 'links', paint: {
          'line-color': ['match', ['coalesce', ['feature-state', 'c'], 'open'], 'blown', '#e05a4a', 'flooded', '#4a8ee0', 'blocked', '#e0a64a', 'held', '#6fd08a', '#e8e1c4'],
          'line-width': 3, 'line-dasharray': [2, 1.5] } });
        map!.addLayer({ id: 'l3-selected', type: 'line', source: 'l3', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#ffe08a', 'line-width': 3 } });
        map!.addLayer({ id: 'marks', type: 'circle', source: 'marks', paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'c'], 'circle-stroke-color': '#0c1416', 'circle-stroke-width': 1.5 } });
        map!.on('click', 'l3-fill', (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id as string | undefined; if (id) onSelect(id); });
        map!.on('mousemove', 'l3-fill', (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (!id) return;
          const z = stateRef.current.zones[id];
          const name = index.byId.get(id)?.name ?? '';
          setHover({ x: e.point.x, y: e.point.y, text: `${name} · ${z.owner ? 'Annen gruppe' : STATUS_LABEL[z.status]}${z.intel ? ` · ${z.intel.min}–${z.intel.max} zombier` : ''}` });
          map!.getCanvas().style.cursor = 'pointer';
        });
        map!.on('mouseleave', 'l3-fill', () => { setHover(null); map!.getCanvas().style.cursor = ''; });
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
    // The map is created once; state is pushed through feature-state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const zone of index.l3) {
      const z = state.zones[zone.id];
      const s = z.owner ? 'faction' : z.status;
      map.setFeatureState({ source: 'l3', id: zone.id }, { s, z: z.intel ? (z.intel.min + z.intel.max) / 2 : 0, reach: hops.has(zone.id) });
    }
    for (const l of world.links) map.setFeatureState({ source: 'links', id: l.id }, { c: state.chokepoints[l.id] });
    const marks = [
      { at: index.byId.get(state.homeZoneId)!.at!, r: 8, c: '#ffe08a' },
      ...state.factions.filter(f => f.known).map(f => ({ at: index.byId.get(f.zoneId)!.at!, r: 6, c: '#b9a0f0' })),
      ...world.pois.filter(p => p.role === 'hq' && state.zones[p.zoneId]?.status !== 'unknown').map(p => ({ at: p.at, r: 4, c: '#f2c14e' })),
    ];
    (map.getSource('marks') as GeoJSONSource).setData({ type: 'FeatureCollection', features: marks.map(m => ({ type: 'Feature', properties: { r: m.r, c: m.c }, geometry: { type: 'Point', coordinates: m.at } })) });
  }, [state, ready, hops, world, index]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter('l3-selected', ['==', ['get', 'id'], selected]);
  }, [selected, ready]);
  return <section className="rz-map" aria-label="Kart over regionen">
    <div ref={ref} className="rz-map-canvas" />
    {hover && <div className="rz-tip" style={{ left: hover.x + 14, top: hover.y + 10 }}>{hover.text}</div>}
    <div className="rz-legend"><span><i style={{ background: '#4f9a6b' }} />Deres</span><span><i style={{ background: '#b39046' }} />Speidet, få</span><span><i style={{ background: '#b4553f' }} />Mange zombier</span><span><i style={{ background: '#8a6fc4' }} />Annen gruppe</span><span><i style={{ background: '#1d2a2c' }} />Ukjent</span><span>Sterkere farge: innen rekkevidde</span></div>
    <button className="rz-home" onClick={() => { const at = index.byId.get(state.homeZoneId)?.at; if (at) mapRef.current?.flyTo({ center: at, zoom: 14 }); onSelect(state.homeZoneId); }}>Til leiren</button>
  </section>;
}
