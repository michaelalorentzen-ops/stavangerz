'use client';

import { useId } from 'react';
import {
  GEAR_CATALOG, availableGear, gearItemName, gearStateFor,
  type GearCrewPlan, type GearOrderPlan, type GearPlan, type GearPreference, type GearSlot,
} from '../../../packages/gameplay/src/region/gear';
import { prepareGearPlan } from '../../../packages/gameplay/src/region/engine';
import type { RegionOrder, RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import './crew-equipment.css';

const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'Våpen', protection: 'Beskyttelse', tool: 'Oppdragsverktøy',
};
const SLOTS: GearSlot[] = ['weapon', 'protection', 'tool'];
const PORTRAITS = new Set(['ingrid', 'marius', 'leila', 'tor']);

/** Replace the edited order without changing its reservation priority. */
export function equipmentDraftOrders(orders: RegionOrder[], draftOrder: RegionOrder): RegionOrder[] {
  return orders.some(order => order.id === draftOrder.id)
    ? orders.map(order => order.id === draftOrder.id ? draftOrder : order)
    : [...orders, draftOrder];
}

export default function CrewEquipment({ state, world, orders, draftOrder, onChange }: {
  state: RegionState;
  world: RegionWorld;
  orders: RegionOrder[];
  draftOrder: RegionOrder;
  onChange: (order: RegionOrder) => void;
}) {
  const editorId = useId();
  const plan = prepareGearPlan(state, world, equipmentDraftOrders(orders, draftOrder));
  const inventory = gearStateFor(state).items;
  const orderPlan = plan.orders.find(order => order.orderId === draftOrder.id);
  const crew = orderPlan?.crew ?? [];
  const allAuto = crew.length > 0 && crew.every(person => person.preference.autoEquip !== false);
  const mixedAuto = !allAuto && crew.some(person => person.preference.autoEquip !== false);
  const errors = [...new Set([...(orderPlan?.errors ?? []), ...plan.errors])];
  const preferenceFor = (person: GearCrewPlan): GearPreference => draftOrder.gear?.[person.survivorId] ?? person.preference;
  const setPreference = (person: GearCrewPlan, preference: GearPreference) => onChange({
    ...draftOrder, gear: { ...draftOrder.gear, [person.survivorId]: preference },
  });
  const setLock = (person: GearCrewPlan, slot: GearSlot, itemId: string | null | undefined) => {
    const preference = preferenceFor(person);
    const locks = { ...preference.locks };
    if (itemId === undefined) delete locks[slot];
    else locks[slot] = itemId;
    setPreference(person, { ...preference, locks });
  };
  const setAuto = (autoEquip: boolean) => {
    const gear = { ...draftOrder.gear };
    for (const person of crew) gear[person.survivorId] = { ...preferenceFor(person), autoEquip };
    onChange({ ...draftOrder, gear });
  };
  const reservedCount = Object.keys(plan.reservations).length;
  const carriedCount = inventory.filter(item => item.location.kind === 'carried').length;
  const freeForCrew = new Set(crew.flatMap(person => person.available
    .filter(item => !plan.reservations[item.id])
    .map(item => item.id))).size;

  return <section className="ce" aria-label="Utstyr til oppdraget">
    <div className="ce-header">
      <div><p className="ce-kicker">DAGSPLAN / UTSTYR</p><h3>Rust laget for oppdraget</h3></div>
      <label className="ce-auto"><span>Auto equip</span><input type="checkbox" checked={allAuto} disabled={!crew.length}
        ref={element => { if (element) element.indeterminate = mixedAuto; }}
        onChange={event => setAuto(event.target.checked)} /></label>
    </div>
    <p className="ce-help">Automatikken velger tilgjengelig utstyr til oppdraget. Et manuelt valg låser bare den kategorien; resten kan fortsatt foreslås automatisk.</p>
    <div className="ce-plan-status" aria-label="Utstyrets tilgjengelighet">
      <span><b>{freeForCrew}</b> ledige for laget</span><span><b>{reservedCount}</b> reservert i dagsplanen</span><span><b>{carriedCount}</b> båret av personer</span>
    </div>
    {!crew.length && <p className="ce-empty">Ingen personer er knyttet til dette oppdraget.</p>}
    <div className="ce-people">{crew.map(person => {
      const survivor = state.survivors.find(candidate => candidate.id === person.survivorId);
      const name = survivor?.name ?? person.survivorId;
      const portrait = name.toLocaleLowerCase('nb-NO');
      const preference = preferenceFor(person);
      return <article className="ce-person" key={person.survivorId}>
        <header className="ce-person-header">
          {PORTRAITS.has(portrait) ? <img src={`/art/crew/${portrait}.webp`} alt={`Portrett av ${name}`} />
            : <span className="ce-initial" aria-hidden="true">{name.slice(0, 1)}</span>}
          <div><strong>{name}</strong><small>{survivor?.role ?? 'Mannskap'}</small></div>
          <span className="ce-person-status">{person.unavailable ? 'Ikke tilgjengelig' : preference.autoEquip === false ? 'Manuelt utstyr' : Object.keys(preference.locks ?? {}).length ? 'Automatisk + låste valg' : 'Automatisk'}</span>
        </header>
        {person.unavailable && <p className="ce-help">{person.unavailable}</p>}
        <div className="ce-slots">{SLOTS.map(slot => {
          const item = person.items[slot];
          const locked = Object.prototype.hasOwnProperty.call(preference.locks ?? {}, slot);
          const selectedItemId = locked ? preference.locks?.[slot] ?? '' : item?.id ?? '';
          const eligible = person.available.filter(candidate => GEAR_CATALOG[candidate.kind]?.slot === slot);
          const options = [...eligible];
          // Keep already-reserved alternatives visible, while the engine's
          // sequential candidate snapshot remains the sole eligibility rule.
          for (const candidate of availableGear(state, person.survivorId, slot)) {
            if (!options.some(option => option.id === candidate.id)) options.push(candidate);
          }
          const selectedItem = plan.items.find(candidate => candidate.id === selectedItemId);
          if (selectedItem && !options.some(candidate => candidate.id === selectedItem.id)) options.push(selectedItem);
          const labelId = `${editorId}-${person.survivorId}-${slot}`;
          const description = item ? GEAR_CATALOG[item.kind]?.description ?? 'Utstyr registrert uten beskrivelse.' : 'Ingen gjenstand valgt i denne kategorien.';
          return <div className="ce-slot" key={slot}>
            <label className="ce-field" htmlFor={labelId}>
              <span className="ce-label">{SLOT_LABEL[slot]}{locked && <small>Låst valg</small>}</span>
              <select id={labelId} value={selectedItemId} disabled={!!person.unavailable} aria-describedby={`${labelId}-detail`}
                aria-label={`${SLOT_LABEL[slot]} for ${name}`} onChange={event => setLock(person, slot, event.target.value || null)}>
                <option value="">Ingen</option>
                {selectedItemId && !selectedItem && <option value={selectedItemId} disabled>Utstyret er ikke tilgjengelig</option>}
                {options.map(candidate => {
                  const reserved = plan.reservations[candidate.id];
                  const takenElsewhere = !!reserved && (reserved.orderId !== draftOrder.id || reserved.survivorId !== person.survivorId);
                  const unavailable = !eligible.some(available => available.id === candidate.id);
                  return <option key={candidate.id} value={candidate.id} disabled={takenElsewhere || unavailable}>
                    {gearItemName(candidate)}{takenElsewhere ? ' · reservert av andre' : unavailable ? ' · utilgjengelig' : candidate.location.kind === 'carried' ? ' · medbrakt' : ''}
                  </option>;
                })}
              </select>
            </label>
            <button type="button" className="ce-lock" aria-pressed={locked} disabled={!!person.unavailable}
              aria-label={`${locked ? 'Lås opp' : 'Lås'} ${SLOT_LABEL[slot].toLowerCase()} for ${name}`}
              onClick={() => setLock(person, slot, locked ? undefined : item?.id ?? null)}>
              <span aria-hidden="true">{locked ? '●' : '○'}</span>{locked ? 'Låst' : 'Lås valg'}
            </button>
            <p className="ce-slot-detail" id={`${labelId}-detail`}>{item && <b>{gearItemName(item)}. </b>}{description}</p>
          </div>;
        })}</div>
      </article>;
    })}</div>
    {errors.length > 0 && <ul className="ce-issues" aria-live="polite" aria-label="Utstyr som må avklares">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <GearInventory state={state} world={world} plan={plan} />
    <p className="ce-footer">Dagsplanens rekkefølge avgjør hvem som får førstevalget. Låste valg beholdes når du endrer de automatiske forslagene. Lagre eller avbryt for å gå tilbake til planen.</p>
  </section>;
}

/** Physical inventory is visible even before the player creates a daily order. */
export function GearInventory({ state, world, plan, open }: {
  state: RegionState;
  world: RegionWorld;
  plan?: GearPlan;
  open?: boolean;
}) {
  const inventory = gearStateFor(state).items;
  const zoneName = (zoneId: string) => world.zones.find(zone => zone.id === zoneId)?.name ?? 'ukjent område';
  const personName = (survivorId: string) => state.survivors.find(person => person.id === survivorId)?.name ?? 'ukjent person';
  return <div className="ce"><details className="ce-stock" open={open}>
    <summary>Lager, reservasjoner og båret utstyr</summary>
    {inventory.length ? <ul className="ce-stock-grid">{inventory.map(item => {
      const reservation = plan?.reservations[item.id];
      const location = item.location;
      const physicalPlace = location.kind === 'stored' ? `Lager: ${zoneName(location.zoneId)}`
        : location.kind === 'carried' ? `Bæres av ${personName(location.survivorId)}`
          : `Tapt dag ${location.day}${location.zoneId ? ` · Sist registrert ved ${zoneName(location.zoneId)}` : ''}`;
      return <li key={item.id}><strong>{gearItemName(item)}</strong>
        <span>{location.kind === 'carried' ? 'Båret' : location.kind === 'lost' ? 'Tapt' : 'På lager'}</span>
        <small>{physicalPlace}</small>
        {location.kind === 'carried' && location.missionId && <small>Bundet til oppdrag{location.targetZoneId ? ` · Oppdragsmål: ${zoneName(location.targetZoneId)}` : ''}
          {location.returnDay !== undefined ? ` · Forventet tilbake dag ${location.returnDay}` : ''}
          {location.returnToZoneId ? ` · Leveres til ${zoneName(location.returnToZoneId)}` : ''}</small>}
        {reservation && <small>Reservert i dagsplanen til {personName(reservation.survivorId)}</small>}
      </li>;
    })}</ul> : <p className="ce-help">Ingen gjenstander registrert.</p>}
  </details></div>;
}

/** Show the same authoritative reservation snapshot on the parent's order card. */
export function OrderGearSummary({ state, plan }: { state: RegionState; plan: GearOrderPlan }) {
  return <ul className="ce-snapshot" aria-label="Planlagt utstyr">{plan.crew.map(person => {
    const name = state.survivors.find(survivor => survivor.id === person.survivorId)?.name ?? person.survivorId;
    const names = SLOTS.flatMap(slot => person.items[slot] ? [gearItemName(person.items[slot]!)] : []);
    const locked = Object.keys(person.preference.locks ?? {}).length > 0;
    return <li key={person.survivorId}><strong>{name}:</strong> {names.join(' · ') || 'Ingen gjenstander'}{locked && <span className="ce-snapshot-lock">● låste valg</span>}</li>;
  })}{plan.errors.length > 0 && <li className="ce-snapshot-error">{plan.errors[0]}{plan.errors.length > 1 ? ` (+${plan.errors.length - 1})` : ''}</li>}</ul>;
}
