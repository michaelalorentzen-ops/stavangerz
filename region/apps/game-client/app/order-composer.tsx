'use client';

import { useId, useMemo } from 'react';
import type { RegionOrder, RegionState, RegionWorld, Stock } from '../../../packages/gameplay/src/region/types';
import { fatigueWorkMultiplier, prepareGearPlan, previewOrder, resourceName } from '../../../packages/gameplay/src/region/engine';
import { ACTIONS, R } from '../../../packages/gameplay/src/region/rules';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { localStock, missionLoad, missionPreview, routeBetween } from '../../../packages/gameplay/src/region/mobility';
import type { GearPlan } from '../../../packages/gameplay/src/region/gear';
import CrewEquipment, { CompactCrewGear, equipmentDraftOrders } from './crew-equipment';
import { MissionOptions } from './mission-controls';
import { HudIcon } from './hud-icons';
import './command-panels.css';

export const commandNumber = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
export const commandStock = (stock: Stock) => Object.entries(stock).filter(([, n]) => n > 0).map(([id, n]) => `${commandNumber(n)} ${resourceName(id).toLocaleLowerCase('nb-NO')}`).join(' · ') || 'Ingen';
export const commandZone = (world: RegionWorld, id?: string) => world.zones.find(z => z.id === id)?.name ?? 'Ukjent sted';
export const activeMissions = (state: RegionState) => Object.values(state.crewMissions ?? {}).filter(m => !['complete', 'failed'].includes(m.status));

/** Mirror only the planner's resource ledger, so the manifest respects earlier reservations. */
export function commandOrderPreview(state: RegionState, world: RegionWorld, orders: RegionOrder[], order: RegionOrder, plan: GearPlan) {
  const budget: RegionState = { ...state, gear: plan.gear, stock: { ...state.stock }, mobility: state.mobility ? { ...state.mobility, depots: Object.fromEntries(Object.entries(state.mobility.depots).map(([id, stock]) => [id, { ...stock }])) } : undefined };
  for (const previous of orders) {
    if (previous.id === order.id) break;
    if (plan.orders.find(p => p.orderId === previous.id)?.errors.length) continue;
    const preview = previewOrder(budget, world, previous, { gearPrepared: true });
    const movement = missionPreview(budget, world, previous, preview.costs);
    if (!preview.valid || !movement.valid) continue;
    const source = movement.originZoneId === state.homeZoneId ? budget.stock : budget.mobility?.depots[movement.originZoneId];
    if (!source) continue;
    for (const [id, amount] of Object.entries(missionLoad(budget, previous, preview.costs).reservations)) source[id] = (source[id] ?? 0) - amount;
    if (movement.boatRequired) source.boat = Math.max(0, (source.boat ?? 0) - 1);
  }
  const preview = previewOrder(budget, world, order, { gearPrepared: true });
  const movement = missionPreview(budget, world, order, preview.costs);
  const load = missionLoad(budget, order, preview.costs);
  return { budget, preview, movement, radioReserved: load.radio, reservations: load.reservations };
}

/** Presentation only: planned homecoming is conditional on the mission succeeding. */
export function plannedHqCrew(state: RegionState, world: RegionWorld, orders: RegionOrder[]) {
  const plan = prepareGearPlan(state, world, orders);
  return state.survivors.filter(person => {
    if (!person.alive || person.left || person.health <= 0) return false;
    if (activeMissions(state).some(m => m.survivorIds.includes(person.id))) return false;
    const order = orders.find(o => o.survivorIds.includes(person.id) && !plan.orders.find(p => p.orderId === o.id)?.errors.length);
    if (order) {
      const { movement } = commandOrderPreview(state, world, orders, order, plan);
      return movement.valid && movement.returnsToday && movement.returnZoneId === state.homeZoneId;
    }
    const position = crewPositionFor(state, person.id);
    return position?.kind === 'zone' && position.zoneId === state.homeZoneId && !(person.awayUntil && person.awayUntil > state.day);
  });
}

export function CrewPortrait({ name }: { name: string }) {
  const portrait = name.toLocaleLowerCase('nb-NO');
  return ['ingrid', 'marius', 'leila', 'tor'].includes(portrait)
    ? <img className="cmd-portrait" src={`/art/crew/${portrait}.webp`} alt="" />
    : <span className="cmd-portrait cmd-initial" aria-hidden="true">{name.slice(0, 1)}</span>;
}

export interface OrderComposerProps {
  state: RegionState; world: RegionWorld; orders: RegionOrder[]; draft: RegionOrder;
  targetOptions?: { id: string; label: string }[];
  onChange: (order: RegionOrder) => void; onConfirm: (order: RegionOrder) => void;
  onCancel: () => void; onPickTarget: () => void; onHelp?: (topic: string) => void;
}

export function OrderComposer({ state, world, orders, draft, targetOptions, onChange, onConfirm, onCancel, onPickTarget, onHelp }: OrderComposerProps) {
  const id = useId();
  const planned = useMemo(() => equipmentDraftOrders(orders, draft), [orders, draft]);
  const plan = useMemo(() => prepareGearPlan(state, world, planned), [state, world, planned]);
  const ownPlan = plan.orders.find(o => o.orderId === draft.id);
  const { budget, preview, movement, reservations } = commandOrderPreview(state, world, planned, draft, plan);
  const allowSea = (localStock(budget, movement.originZoneId).boat ?? 0) >= 1;
  const returnRoute = routeBetween(budget, world, draft.zoneId, movement.returnZoneId, allowSea);
  const returnHours = returnRoute ? Math.max(0, returnRoute.length - 1) * R.hopHours : undefined;
  const errors = [...new Set([...preview.errors, ...movement.errors, ...(ownPlan?.errors ?? [])])];
  const valid = !errors.length && !!draft.survivorIds.length;
  const home = plannedHqCrew(state, world, planned);
  const editing = orders.some(o => o.id === draft.id);
  const baseLabel = state.hq ? 'HQ' : 'leiren';
  const reservedManifest = commandStock(reservations);
  const hasCrew = draft.survivorIds.length > 0;
  const zoneIntel = state.zones[draft.zoneId];
  const risk = !hasCrew || (!zoneIntel?.intel && zoneIntel?.status !== 'controlled') ? 'Ukjent' : String(preview.risk);
  const riskClass = risk === 'Høy' ? 'high' : risk === 'Middels' ? 'medium' : risk === 'Lav' ? 'low' : 'unknown';
  const selectedOrigin = draft.survivorIds.map(personId => crewPositionFor(state, personId)).find(p => p?.kind === 'zone');
  const remainingOrders = orders.filter(o => o.id !== draft.id);
  const toggle = (personId: string) => {
    const selected = draft.survivorIds.includes(personId);
    const survivorIds = selected ? draft.survivorIds.filter(p => p !== personId) : [...draft.survivorIds, personId];
    onChange({ ...draft, survivorIds, communication: draft.communication ? { ...draft.communication, leaderId: survivorIds.includes(draft.communication.leaderId ?? '') ? draft.communication.leaderId : survivorIds[0] } : undefined });
  };

  return <div className="cmd-composer">
    <header className="cmd-intro cmd-composer-heading">
      <p className="cmd-kicker">{editing ? 'JUSTER DAGENS PLAN' : 'NY ORDRE'} / DAG {state.day}</p>
      <div className="cmd-heading-main"><div><h2>{ACTIONS[draft.action].label}<span className={`cmd-risk cmd-risk-${riskClass}`}>{risk} risiko</span></h2><p className="cmd-heading-place"><HudIcon name="location" size={16} />{commandZone(world, draft.zoneId)}</p></div><button type="button" onClick={onPickTarget}>Velg på kartet <HudIcon name="map" size={16} /></button>{onHelp && <button type="button" className="cmd-help" aria-label="Hjelp om oppdrag" onClick={() => onHelp(draft.action)}><HudIcon name="book" size={18} /></button>}</div>
    </header>
    <div className="cmd-scroll">
      <section className="cmd-mission-brief" aria-label="Oppdrag og tidsplan">
        {!!targetOptions?.length && <label className="cmd-target">Velg mål<select value={draft.target ?? ''} onChange={event => onChange({ ...draft, target: event.target.value })}><option value="" disabled>Velg et mål</option>{targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
        <div className="cmd-mission-result"><p aria-live="polite">{hasCrew ? `${draft.survivorIds.length} ${draft.survivorIds.length === 1 ? 'person' : 'personer'} · ${preview.text}` : 'Velg folk'}</p></div>
        <ol className="cmd-timeline" aria-label="Planlagt reise, arbeid og retur">
          <li className={movement.travelHours === 0 ? 'is-local' : ''}><span><HudIcon name="route" size={15} />Reise</span><b>{!hasCrew ? '—' : movement.travelHours ? `${commandNumber(movement.travelHours)} t` : 'På stedet'}</b></li>
          <li><span><HudIcon name="work" size={15} />Arbeid</span><b>{hasCrew ? `${commandNumber(movement.workHours)} t` : '—'}</b></li>
          <li className={returnHours === 0 ? 'is-local' : ''}><span><HudIcon name="navigation" size={15} />Retur</span><b>{!hasCrew ? '—' : returnHours === undefined ? 'Ukjent rute' : returnHours ? `${commandNumber(returnHours)} t` : 'Samme sted'}</b></li>
        </ol>
        <p className="cmd-return-plan">{hasCrew ? <>Fra {commandZone(world, movement.originZoneId)} → {commandZone(world, movement.returnZoneId)} · {movement.returnsToday ? 'planlagt før natt' : returnHours === undefined ? 'returtid ukjent' : `ca. ${Math.max(1, Math.ceil((movement.travelHours + movement.workHours + returnHours) / 15))} døgn, laget er bundet`}</> : 'Velg mannskap for å beregne reise og retur.'}</p>
      </section>
      <section className="cmd-crew-section" aria-labelledby={`${id}-crew`}><header><HudIcon name="crew" /><h3 id={`${id}-crew`}>Folk</h3><span>{draft.survivorIds.length} valgt</span></header><div className="cmd-crew-list">{state.survivors.filter(p => p.alive && !p.left).map(person => {
        const selected = draft.survivorIds.includes(person.id);
        const position = crewPositionFor(state, person.id);
        const bound = activeMissions(state).find(m => m.survivorIds.includes(person.id));
        const reserved = remainingOrders.find(o => o.survivorIds.includes(person.id));
        // Ask the canonical reservation planner about this person, rather than guessing from HQ presence.
        const probe = selected ? undefined : prepareGearPlan(state, world, equipmentDraftOrders(orders, { ...draft, survivorIds: [person.id], gear: undefined })).orders.find(o => o.orderId === draft.id)?.crew[0];
        const unavailable = bound ? 'Bundet til pågående oppdrag' : reserved ? 'Reservert i en annen ordre' : position?.kind === 'away-unknown' ? 'Eldre oppdrag · posisjon ukjent' : !position ? 'Posisjon mangler' : position.kind === 'transit' ? 'Underveis' : position.kind === 'area-duty' ? 'Bundet til områdevakt' : probe?.unavailable;
        const differentOrigin = !selected && selectedOrigin?.kind === 'zone' && position?.kind === 'zone' && position.zoneId !== selectedOrigin.zoneId;
        const reason = unavailable ?? (differentOrigin ? 'Et annet avreisested enn laget' : undefined);
        const place = position?.kind === 'zone' ? commandZone(world, position.zoneId) : reason ?? 'Ukjent sted';
        const gearPerson = ownPlan?.crew.find(p => p.survivorId === person.id) ?? probe;
        return <div key={person.id} className={`cmd-person ${selected ? 'is-selected' : ''} ${reason && !selected ? 'is-unavailable' : ''}`}><input id={`${id}-${person.id}`} aria-label={person.name} type="checkbox" checked={selected} disabled={!!reason && !selected} onChange={() => toggle(person.id)} /><CrewPortrait name={person.name} /><span className="cmd-person-identity"><label htmlFor={`${id}-${person.id}`}><strong>{person.name}</strong></label><small className={reason ? 'cmd-person-status' : 'cmd-person-location'}>{reason ?? place}</small></span><span className="cmd-person-condition"><span>Helse <b>{person.health}</b></span><span title={`Utmattelse ${Math.round(person.fatigue)} av 100`}>{fatigueWorkMultiplier(person.fatigue)<1?'−40 % innsats':'Klar'}</span></span>{gearPerson && <CompactCrewGear state={state} plan={plan} person={gearPerson} order={draft} disabled={!selected || !!reason} onChange={onChange} />}</div>;
      })}</div>
      </section>
      <details className="cmd-details"><summary><HudIcon name="settings" />Avansert <span>Auto equip, mandat, leder og retursted</span></summary><CrewEquipment state={state} world={world} orders={orders} draftOrder={draft} onChange={onChange} /><MissionOptions state={budget} world={world} order={draft} onChange={onChange} /></details>
      {hasCrew && !!errors.length && <div className="cmd-errors" id={`${id}-errors`} role="status"><strong>Ordren kan ikke legges i planen ennå</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    </div>
    <footer className="cmd-confirm"><div className="cmd-confirm-facts" aria-label="Planlagte konsekvenser ved vellykket retur"><div className="cmd-confirm-return" title={`Retur til ${commandZone(world, movement.returnZoneId)} · ${movement.returnsToday ? 'før natt' : 'flere døgn'}`}><HudIcon name="route" size={14} /><span>{hasCrew ? `Retur ${movement.returnsToday ? 'før natt' : 'flere døgn'} · ${commandZone(world, movement.returnZoneId)}` : 'Velg folk for å beregne reisen'}</span></div><div className="cmd-confirm-home"><HudIcon name="crew" size={15} /><span><b>Ved {baseLabel} til natten:</b> {home.map(p => p.name).join(', ') || 'Ingen navngitte folk'}<small>Planlagt ved vellykket retur · kan bli forsinket</small></span></div><div className="cmd-confirm-load"><HudIcon name="stock" size={14} /><span title={`Faktisk reservert last: ${reservedManifest}`}>Last: {reservedManifest}</span><b>{commandNumber(movement.availableCapacity)}/{commandNumber(movement.capacity)} ledig</b></div></div><div className="cmd-confirm-actions"><button type="button" onClick={onCancel}>Avbryt</button><button type="button" className="cmd-primary" disabled={!valid} aria-describedby={hasCrew && errors.length ? `${id}-errors` : undefined} onClick={() => { if (valid) onConfirm(draft); }}><HudIcon name="check" />{editing ? 'Oppdater ordren' : 'Legg i dagsplanen'}</button></div></footer>
  </div>;
}

export default OrderComposer;
