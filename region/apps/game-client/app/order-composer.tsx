'use client';

import { useId, useMemo } from 'react';
import type { RegionOrder, RegionState, RegionWorld, Stock } from '../../../packages/gameplay/src/region/types';
import { prepareGearPlan, previewOrder, resourceName } from '../../../packages/gameplay/src/region/engine';
import { ACTIONS, R } from '../../../packages/gameplay/src/region/rules';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { missionPreview, routeBetween } from '../../../packages/gameplay/src/region/mobility';
import { gearItemName, GEAR_SLOTS, type GearPlan } from '../../../packages/gameplay/src/region/gear';
import CrewEquipment, { equipmentDraftOrders } from './crew-equipment';
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
    for (const [id, amount] of Object.entries(movement.reservedCargo)) source[id] = (source[id] ?? 0) - amount;
    if (previous.communication?.radio) { source.radio = (source.radio ?? 0) - 1; source.batteries = (source.batteries ?? 0) - 1; }
    if (movement.boatRequired) source.boat = Math.max(0, (source.boat ?? 0) - 1);
  }
  const preview = previewOrder(budget, world, order, { gearPrepared: true });
  return { budget, preview, movement: missionPreview(budget, world, order, preview.costs) };
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
  onCancel: () => void; onPickTarget: () => void;
}

export function OrderComposer({ state, world, orders, draft, targetOptions, onChange, onConfirm, onCancel, onPickTarget }: OrderComposerProps) {
  const id = useId();
  const planned = useMemo(() => equipmentDraftOrders(orders, draft), [orders, draft]);
  const plan = useMemo(() => prepareGearPlan(state, world, planned), [state, world, planned]);
  const ownPlan = plan.orders.find(o => o.orderId === draft.id);
  const { budget, preview, movement } = commandOrderPreview(state, world, planned, draft, plan);
  const returnRoute = routeBetween(budget, world, draft.zoneId, movement.returnZoneId);
  const returnHours = returnRoute ? Math.max(0, returnRoute.length - 1) * R.hopHours : undefined;
  const errors = [...new Set([...preview.errors, ...movement.errors, ...(ownPlan?.errors ?? [])])];
  const valid = !errors.length && !!draft.survivorIds.length;
  const home = plannedHqCrew(state, world, planned);
  const editing = orders.some(o => o.id === draft.id);
  const selectedOrigin = draft.survivorIds.map(personId => crewPositionFor(state, personId)).find(p => p?.kind === 'zone');
  const remainingOrders = orders.filter(o => o.id !== draft.id);
  const toggle = (personId: string) => {
    const selected = draft.survivorIds.includes(personId);
    const survivorIds = selected ? draft.survivorIds.filter(p => p !== personId) : [...draft.survivorIds, personId];
    onChange({ ...draft, survivorIds, communication: draft.communication ? { ...draft.communication, leaderId: survivorIds.includes(draft.communication.leaderId ?? '') ? draft.communication.leaderId : survivorIds[0] } : undefined });
  };

  return <div className="cmd-composer">
    <div className="cmd-scroll">
      <header className="cmd-intro"><p className="cmd-kicker">{editing ? 'JUSTER DAGENS PLAN' : 'NY ORDRE'} / DAG {state.day}</p><h2>{ACTIONS[draft.action].label}</h2><p>Sett sammen laget. Se hva oppdraget binder før du bekrefter.</p></header>
      <section className="cmd-card" aria-labelledby={`${id}-zone`}><header><HudIcon name="location" /><h3 id={`${id}-zone`}>Sone</h3><button type="button" onClick={onPickTarget}>Velg på kartet <HudIcon name="map" size={15} /></button></header><strong className="cmd-zone-name">{commandZone(world, draft.zoneId)}</strong><p>Fra {commandZone(world, movement.originZoneId)}</p></section>
      <section className="cmd-card" aria-labelledby={`${id}-mission`}><header><HudIcon name="target" /><h3 id={`${id}-mission`}>Oppdrag</h3><span className={`cmd-risk cmd-risk-${preview.risk === 'Høy' ? 'high' : preview.risk === 'Middels' ? 'medium' : 'low'}`}>{preview.risk} risiko</span></header><p>{ACTIONS[draft.action].help}</p>{!!targetOptions?.length && <label className="cmd-target">Velg mål<select value={draft.target ?? ''} onChange={event => onChange({ ...draft, target: event.target.value })}><option value="" disabled>Velg et mål</option>{targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}<p>{preview.text}</p><div className="cmd-facts"><div><HudIcon name="route" /><span>Reise ut + retur<b>{commandNumber(movement.travelHours)} t + {returnHours === undefined ? 'ukjent' : `${commandNumber(returnHours)} t`}</b></span></div><div><HudIcon name="clock" /><span>Arbeid på stedet<b>{commandNumber(movement.workHours)} t</b></span></div><div><HudIcon name="navigation" /><span>Forventet retursted<b>{commandZone(world, movement.returnZoneId)}</b></span></div><div><HudIcon name="moon" /><span>Planlagt ankomst<b>{movement.returnsToday ? 'Før natt · innen kl. 22' : 'Flere døgn · laget er bundet'}</b></span></div></div><p className="cmd-note">{movement.returnZoneId !== state.homeZoneId ? 'Laget blir utenfor HQ etter oppdraget. ' : ''}Risiko gjelder oppdraget; forsinkelser og hendelser kan endre hjemkomsten.</p></section>
      <section className="cmd-card" aria-labelledby={`${id}-crew`}><header><HudIcon name="crew" /><h3 id={`${id}-crew`}>Folk</h3><span>{draft.survivorIds.length} valgt</span></header><p className="cmd-note">Velg folk fra samme faktiske avreisested. Ledige folk i felt kan også brukes.</p><div className="cmd-crew-list">{state.survivors.filter(p => p.alive && !p.left).map(person => {
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
        return <label key={person.id} className={`cmd-person ${selected ? 'is-selected' : ''} ${reason && !selected ? 'is-unavailable' : ''}`}><input type="checkbox" checked={selected} disabled={!!reason && !selected} onChange={() => toggle(person.id)} /><CrewPortrait name={person.name} /><span><strong>{person.name}</strong><small>{person.role} · {place}</small><small>{reason ?? `Helse ${person.health} · utmattelse ${person.fatigue}`}</small></span></label>;
      })}</div>
      {!!ownPlan?.crew.length && <div className="cmd-loadouts">{ownPlan.crew.map(person => <div key={person.survivorId}><strong>{state.survivors.find(p => p.id === person.survivorId)?.name}</strong><div className="cmd-slots">{GEAR_SLOTS.map(slot => <span key={slot}><HudIcon name={slot === 'protection' ? 'shield' : slot === 'weapon' ? 'weapon' : 'tool'} size={15} />{person.items[slot] ? gearItemName(person.items[slot]!) : 'Ingen'}</span>)}</div></div>)}</div>}</section>
      <section className="cmd-card cmd-consequences" aria-labelledby={`${id}-consequences`}><header><HudIcon name="plan" /><h3 id={`${id}-consequences`}>Dette binder planen</h3></header><dl><div><dt>Kostnad for oppdraget</dt><dd>{commandStock(preview.costs)}</dd></div><div><dt>Faktisk reservert avreiselast</dt><dd>{commandStock(movement.reservedCargo)}</dd></div>{!!draft.logistics?.gearIds?.length && <div><dt>Løst utstyr i leveransen</dt><dd>{draft.logistics.gearIds.map(id => state.gear?.items.find(item => item.id === id)).filter((item): item is NonNullable<typeof item> => !!item).map(gearItemName).join(' · ') || 'Ingen registrerte gjenstander'}</dd></div>}{draft.logistics?.passengers && <div><dt>Folk i transporten</dt><dd>{draft.logistics.passengers.adults} voksne · {draft.logistics.passengers.children} barn · {draft.logistics.passengers.elderly} eldre · {draft.logistics.passengers.sick} syke</dd></div>}{draft.communication?.radio && <div><dt>Sambandsutstyr i tillegg</dt><dd>1 radio · 1 batteri</dd></div>}{movement.boatRequired && <div><dt>Transport bundet</dt><dd>1 båt</dd></div>}<div><dt>Ledig bærekapasitet etter last</dt><dd>{commandNumber(movement.availableCapacity)} av {commandNumber(movement.capacity)}</dd></div><div><dt>Navngitte folk ved HQ til natten</dt><dd><b>{home.length}</b> · {home.map(p => p.name).join(', ') || 'Ingen'}</dd></div><div><dt>Feltmandat</dt><dd>{draft.communication?.mandate === 'cautious' ? 'Forsiktig' : draft.communication?.mandate === 'bold' ? 'Dristig' : 'Avveid'} · {draft.communication?.contactOnCritical ? 'Be om valg ved kritiske møter når samband finnes' : 'Feltlederen avgjør møter'}</dd></div></dl><p className="cmd-note">HQ-tallet gjelder navngitte folk og hele dagsplanen ved vellykket retur. Pågående oppdrag regnes som ute; forventet retur kan bli forsinket.</p></section>
      <details className="cmd-details"><summary><HudIcon name="gear" />Utstyr og mandat <span>Auto equip, manuelle låser, proviant og retur</span></summary><CrewEquipment state={state} world={world} orders={orders} draftOrder={draft} onChange={onChange} /><MissionOptions state={budget} world={world} order={draft} onChange={onChange} /></details>
      {!!errors.length && <div className="cmd-errors" id={`${id}-errors`} role="status"><strong>Ordren kan ikke legges i planen ennå</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    </div>
    <footer className="cmd-confirm"><button type="button" onClick={onCancel}>Avbryt</button><button type="button" className="cmd-primary" disabled={!valid} aria-describedby={errors.length ? `${id}-errors` : undefined} onClick={() => { if (valid) onConfirm(draft); }}><HudIcon name="check" />{editing ? 'Oppdater ordren' : 'Legg i dagsplanen'}</button></footer>
  </div>;
}

export default OrderComposer;
