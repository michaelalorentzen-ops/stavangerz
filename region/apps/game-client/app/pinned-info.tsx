'use client';
import { useState } from 'react';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import type { Flows } from '../../../packages/gameplay/src/region/economy';
import { campaignFor } from '../../../packages/gameplay/src/region/campaign';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
const MAX_PINS = 3; // UX hypothesis: keep the map visible on a phone.
export function usePinnedInfo(state: RegionState) {
  const key = `stavangerz-ui-pins:${campaignFor(state).id}`;
  const [pins, setPins] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && (id === 'supplies' || id.startsWith('crew:'))).slice(0, MAX_PINS) : []; }
    catch { return []; }
  });
  const toggle = (id: string) => {
    const next = pins.includes(id) ? pins.filter(p => p !== id) : pins.length < MAX_PINS ? [...pins, id] : pins;
    setPins(next);
    // Presentation preferences are deliberately outside the campaign save: pinning
    // does not change history or permit a Hardcore rewind.
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* The game save handles authoritative storage failures. */ }
  };
  return { pins, toggle };
}
export function PinChooser({ state, pins, toggle }: { state: RegionState; pins: string[]; toggle: (id: string) => void }) {
  const options = [{ id: 'supplies', name: 'Mat og vann' }, ...state.survivors.filter(p => !p.left).map(p => ({ id: `crew:${p.id}`, name: p.name }))];
  return <details className="rz-pin-chooser"><summary>Fest kort i kartet · {pins.length}/{MAX_PINS}</summary><p className="rz-small">Følg utvalgte folk eller forsyninger gjennom alle fasene. Løsne et kort for å velge et annet.</p><div>{options.map(item => <button key={item.id} aria-pressed={pins.includes(item.id)} disabled={pins.length >= MAX_PINS && !pins.includes(item.id)} onClick={() => toggle(item.id)}>{pins.includes(item.id) ? 'Løsne' : 'Fest'} {item.name}</button>)}</div></details>;
}
export function PinnedCards({ state, world, flows, pins, toggle, onCrew, onStock }: { state: RegionState; world: RegionWorld; flows: Flows; pins: string[]; toggle: (id: string) => void; onCrew: () => void; onStock: () => void }) {
  const place = (id: string) => world.zones.find(z => z.id === id)?.name ?? id;
  return pins.length ? <aside className="rz-pinned" aria-label="Festede kort">{pins.map(id => {
    const person = id.startsWith('crew:') ? state.survivors.find(p => p.id === id.slice(5)) : undefined;
    const position = person ? crewPositionFor(state, person.id) : undefined;
    const label = person?.name ?? 'Mat og vann';
    const location = person?.left ? 'Har forlatt gruppen' : !person?.alive ? 'Død' : position?.kind === 'zone' ? place(position.zoneId) : position?.kind === 'transit' ? `På vei mot ${place(position.toZoneId)}` : position?.kind === 'area-duty' ? `Områdevakt · ${place(position.areaZoneId)}` : 'Sted ikke rapportert';
    return <section className="rz-pinned-card" key={id}><button className="rz-pin-open" onClick={person ? onCrew : onStock}><strong>{label}</strong>{person ? <><span>{location}</span><small>Helse {Math.round(person.health)} · Utmattet {Math.round(person.fatigue)}</small></> : <><span>Mat {Math.round(state.stock.food ?? 0)} · Vann {Math.round(state.stock.water ?? 0)}</span><small>{flows.food.daysLeft === null ? 'Mat: dekker forbruket' : `Mat: ca. ${Math.floor(flows.food.daysLeft)} døgn`} · {flows.water.daysLeft === null ? 'vann i balanse' : `vann: ca. ${Math.floor(flows.water.daysLeft)} døgn`}</small></>}</button><button className="rz-pin-remove" aria-label={`Løsne ${label}`} onClick={() => toggle(id)}>×</button></section>;
  })}</aside> : null;
}
