'use client';

import type { RegionOrder, RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import { prepareGearPlan } from '../../../packages/gameplay/src/region/engine';
import { ACTIONS } from '../../../packages/gameplay/src/region/rules';
import { gearItemName } from '../../../packages/gameplay/src/region/gear';
import { HudIcon } from './hud-icons';
import { activeMissions, commandOrderPreview, commandNumber, commandStock, commandZone, CrewPortrait, plannedHqCrew } from './order-composer';
import './command-panels.css';

export interface DayPlanProps {
  state: RegionState; world: RegionWorld; orders: RegionOrder[];
  onEdit: (id: string) => void; onRemove: (id: string) => void; onLocate: (zoneId: string) => void;
  onRedirect?: (missionId: string) => void;
}

export function DayPlan({ state, world, orders, onEdit, onRemove, onLocate, onRedirect }: DayPlanProps) {
  const plan = prepareGearPlan(state, world, orders);
  const home = plannedHqCrew(state, world, orders);
  const missions = activeMissions(state);
  const baseLabel = state.hq ? 'HQ' : 'leiren';
  const stock: Record<string, number> = {};
  for (const order of orders) {
    if (plan.orders.find(p => p.orderId === order.id)?.errors.length) continue;
    const { movement, radioReserved } = commandOrderPreview(state, world, orders, order, plan);
    for (const [id, amount] of Object.entries(movement.reservedCargo)) stock[id] = (stock[id] ?? 0) + amount;
    if (radioReserved) { stock.radio = (stock.radio ?? 0) + 1; stock.batteries = (stock.batteries ?? 0) + 1; }
    if (movement.boatRequired) stock.boat = (stock.boat ?? 0) + 1;
  }
  const portraits = (ids: string[]) => <div className="cmd-plan-crew">{ids.map(id => { const person = state.survivors.find(p => p.id === id); return <span key={id}><CrewPortrait name={person?.name ?? '?'} /><span>{person?.name ?? 'Ukjent person'}</span></span>; })}</div>;

  return <div className="cmd-day-plan">
    <header className="cmd-intro"><p className="cmd-kicker">DAG {state.day} / KL. 07:00</p><h2>Dagsplanen</h2><p>Nye ordre starter når døgnet går. Pågående oppdrag fortsetter.</p></header>
    <section className="cmd-card cmd-consequences cmd-plan-summary" aria-label="Planens samlede konsekvenser"><div className="cmd-plan-stats"><div><HudIcon name="plan" /><b>{orders.length}</b><span>nye ordre</span></div><div><HudIcon name="route" /><b>{missions.length}</b><span>pågående</span></div><div><HudIcon name="shield" /><b>{home.length}</b><span>ved {baseLabel} i natt*</span></div></div><details className="cmd-plan-details"><summary>Last og nattforsvar</summary><dl><div><dt>Reservert avreiselast · alle avreisesteder</dt><dd>{commandStock(stock)}</dd></div><div><dt>Navngitte folk ved {baseLabel} i natt*</dt><dd>{home.map(p => p.name).join(', ') || 'Ingen'}</dd></div></dl><p className="cmd-note">*Planlagt ved vellykket retur. Pågående oppdrag regnes som ute. Hendelser og forsinkelser kan endre hjemkomsten.</p></details></section>
    <section aria-labelledby="cmd-new-orders"><div className="cmd-section-title"><HudIcon name="plan" /><h3 id="cmd-new-orders">Nye ordre</h3><span>{orders.length}</span></div>
      {!orders.length && <div className="cmd-empty"><HudIcon name="compass" size={28} /><strong>En ny dag ligger foran dere</strong><p>Velg folk eller en sone på kartet for å planlegge et oppdrag.</p></div>}
      <div className="cmd-order-list">{orders.map((order, index) => {
        const orderPlan = plan.orders.find(p => p.orderId === order.id);
        const { preview, movement } = commandOrderPreview(state, world, orders, order, plan);
        const errors = [...new Set([...(orderPlan?.errors ?? []), ...preview.errors, ...movement.errors])];
        const gear = orderPlan?.crew.flatMap(p => Object.values(p.items).map(gearItemName)) ?? [];
        return <article className={`cmd-card cmd-order ${errors.length ? 'has-errors' : ''}`} key={order.id}><header><span className="cmd-order-number">{String(index + 1).padStart(2, '0')}</span><div><h4>{ACTIONS[order.action].label}</h4><button type="button" className="cmd-locate" onClick={() => onLocate(order.zoneId)}><HudIcon name="location" size={14} />{commandZone(world, order.zoneId)}</button></div><span className="cmd-risk">{preview.risk} risiko</span></header>{portraits(order.survivorIds)}<p className="cmd-order-route"><HudIcon name="route" size={15} />{commandNumber(movement.travelHours)} t ut · retur til {commandZone(world, movement.returnZoneId)}{movement.returnsToday ? ' før natt' : ' over flere døgn'}</p><p className="cmd-note">{gear.length ? [...new Set(gear)].join(' · ') : 'Ingen utstyr valgt'}</p><p className="cmd-note">Avreiselast: {commandStock(movement.reservedCargo)}</p>{!!errors.length && <p className="cmd-errors" role="status">Må avklares: {errors.join(' ')}</p>}<div className="cmd-order-actions"><button type="button" onClick={() => onEdit(order.id)}><HudIcon name="edit" size={15} />Rediger</button><button type="button" onClick={() => onRemove(order.id)} aria-label={`Fjern ${ACTIONS[order.action].label}, ordre ${index + 1}`}><HudIcon name="remove" size={15} />Fjern</button></div></article>;
      })}</div>
    </section>
    <section aria-labelledby="cmd-active-orders"><div className="cmd-section-title"><HudIcon name="route" /><h3 id="cmd-active-orders">Pågående oppdrag</h3><span>{missions.length}</span></div>{!missions.length && <p className="cmd-note">Ingen er ute på et pågående oppdrag.</p>}<div className="cmd-order-list">{missions.map(mission => {
      const gear = (state.gear?.items ?? []).filter(item => item.reported !== false && item.location.kind === 'carried' && mission.survivorIds.includes(item.location.survivorId));
      return <article className="cmd-card cmd-order cmd-active" key={mission.id}><header><HudIcon name="route" /><div><h4>{ACTIONS[mission.action].label}</h4><button type="button" className="cmd-locate" onClick={() => onLocate(mission.targetZoneId)}><HudIcon name="location" size={14} />{commandZone(world, mission.targetZoneId)}</button></div><span className="cmd-active-status">{mission.status === 'returning' ? 'På retur' : mission.status === 'working' ? 'Arbeider' : mission.status === 'reserved' ? 'Reservert' : 'Underveis'}</span></header>{portraits(mission.survivorIds)}<p>Retur: {commandZone(world, mission.returnZoneId)} · {mission.expectedReturnDay === undefined ? 'tid ukjent' : `forventet dag ${mission.expectedReturnDay}`}</p><p className="cmd-note">{gear.map(gearItemName).join(' · ') || 'Ingen registrert utstyr'}{Object.keys(mission.cargo ?? {}).length ? ` · Last: ${commandStock(mission.cargo ?? {})}` : ''}</p>{onRedirect && <div className="cmd-order-actions"><button type="button" onClick={() => onRedirect(mission.id)}><HudIcon name="navigation" size={15} />Omdiriger laget</button></div>}</article>;
    })}</div></section>
  </div>;
}

export default DayPlan;
