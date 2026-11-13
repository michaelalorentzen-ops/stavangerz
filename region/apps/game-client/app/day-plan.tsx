'use client';

import { useState } from 'react';
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
const PAGE_SIZE = 4;

export function DayPlan({ state, world, orders, onEdit, onRemove, onLocate, onRedirect }: DayPlanProps) {
  const plan = prepareGearPlan(state, world, orders);
  const home = plannedHqCrew(state, world, orders);
  const missions = activeMissions(state);
  const [view, setView] = useState<'new' | 'active'>(() => !orders.length && missions.length ? 'active' : 'new');
  const [requestedPage, setPage] = useState(0);
  const total = view === 'new' ? orders.length : missions.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages - 1);
  const offset = page * PAGE_SIZE;
  const baseLabel = state.hq ? 'HQ' : 'leiren';
  const stock: Record<string, number> = {};
  for (const order of orders) {
    if (plan.orders.find(p => p.orderId === order.id)?.errors.length) continue;
    const { movement, reservations } = commandOrderPreview(state, world, orders, order, plan);
    for (const [key, amount] of Object.entries(reservations)) stock[key] = (stock[key] ?? 0) + amount;
    if (movement.boatRequired) stock.boat = (stock.boat ?? 0) + 1;
  }
  const portraits = (ids: string[]) => <div className="cmd-plan-crew">{ids.map(personId => {
    const person = state.survivors.find(p => p.id === personId);
    return <span key={personId}><CrewPortrait name={person?.name ?? '?'} /><span>{person?.name ?? 'Ukjent person'}</span></span>;
  })}</div>;

  return <div className="cmd-day-plan cmd-day-plan-compact">
    <header className="cmd-intro"><p className="cmd-kicker">DAG {state.day} / KL. 07:00</p><h2>Dagsplanen</h2></header>
    <section className="cmd-plan-summary" aria-label="Planens samlede konsekvenser">
      <div className="cmd-plan-stats"><div><HudIcon name="plan" /><b>{orders.length}</b><span>nye ordre</span></div><div><HudIcon name="route" /><b>{missions.length}</b><span>pågående</span></div><div><HudIcon name="crew" /><b>{home.length}</b><span>ved {baseLabel} i natt*</span></div></div>
      <details className="cmd-plan-details"><summary>Planens konsekvenser</summary><dl><div><dt>Total reservert avreiselast · alle avreisesteder</dt><dd>{commandStock(stock)}</dd></div><div><dt>Navngitte folk ved {baseLabel} i natt*</dt><dd>{home.map(p => p.name).join(', ') || 'Ingen'}</dd></div></dl><p className="cmd-note">*Planlagt ved vellykket retur. Pågående oppdrag regnes som ute. Hendelser og forsinkelser kan endre hjemkomsten.</p></details>
    </section>
    <nav className="cmd-plan-views" aria-label="Oppdragslister">
      <button type="button" aria-pressed={view === 'new'} onClick={() => { setView('new'); setPage(0); }}><HudIcon name="plan" size={16} />Nye ordre <b>{orders.length}</b></button>
      <button type="button" aria-pressed={view === 'active'} onClick={() => { setView('active'); setPage(0); }}><HudIcon name="route" size={16} />Pågående oppdrag <b>{missions.length}</b></button>
    </nav>
    <section aria-label={view === 'new' ? 'Nye ordre' : 'Pågående oppdrag'}>
      {!total && <div className="cmd-empty"><HudIcon name="compass" size={24} /><strong>{view === 'new' ? 'Ingen nye ordre' : 'Ingen pågående oppdrag'}</strong><p>{view === 'new' ? 'Velg folk eller en sone på kartet for å planlegge et oppdrag.' : 'Ingen lag er bundet til et oppdrag nå.'}</p></div>}
      <div className="cmd-order-list">
        {view === 'new' && orders.slice(offset, offset + PAGE_SIZE).map((order, index) => {
          const orderPlan = plan.orders.find(p => p.orderId === order.id);
          const { preview, movement, reservations } = commandOrderPreview(state, world, orders, order, plan);
          const errors = [...new Set([...(orderPlan?.errors ?? []), ...preview.errors, ...movement.errors])];
          const gear = orderPlan?.crew.flatMap(p => Object.values(p.items).map(gearItemName)) ?? [];
          const known = state.zones[order.zoneId];
          const risk = !known?.intel && known?.status !== 'controlled' ? 'Ukjent' : String(preview.risk);
          return <article className={`cmd-order ${errors.length ? 'has-errors' : ''}`} key={order.id}>
            <header><h4>{ACTIONS[order.action].label}</h4><span className={`cmd-risk ${risk === 'Ukjent' ? 'cmd-risk-unknown' : ''}`}>{risk} risiko</span></header>
            <button type="button" className="cmd-locate" onClick={() => onLocate(order.zoneId)}><HudIcon name="location" size={14} />{commandZone(world, order.zoneId)}</button>
            {portraits(order.survivorIds)}
            <p className="cmd-order-return">Retur: {commandZone(world, movement.returnZoneId)} · {movement.returnsToday ? 'før natt' : 'flere døgn'}</p>
            {!!errors.length && <p className="cmd-order-invalid" role="status">Må avklares før avreise</p>}
            <div className="cmd-order-bottom">
              <details className="cmd-order-details"><summary>Detaljer</summary><div><p>{preview.text}</p><p>{commandNumber(movement.travelHours)} t reise ut · {commandNumber(movement.workHours)} t arbeid</p><p>Utstyr: {[...new Set(gear)].join(' · ') || 'Ingen valgt'}</p><p>Avreiselast: {commandStock(reservations)}</p>{!!errors.length && <p className="cmd-errors">{errors.join(' ')}</p>}</div></details>
              <div className="cmd-order-actions"><button type="button" onClick={() => onEdit(order.id)}><HudIcon name="edit" size={15} />Rediger</button><button type="button" onClick={() => onRemove(order.id)} aria-label={`Fjern ${ACTIONS[order.action].label}, ordre ${offset + index + 1}`}><HudIcon name="remove" size={15} />Fjern</button></div>
            </div>
          </article>;
        })}
        {view === 'active' && missions.slice(offset, offset + PAGE_SIZE).map(mission => {
          const gear = (state.gear?.items ?? []).filter(item => item.reported !== false && item.location.kind === 'carried' && mission.survivorIds.includes(item.location.survivorId));
          return <article className="cmd-order cmd-active" key={mission.id}>
            <header><h4>{ACTIONS[mission.action].label}</h4><span className="cmd-active-status">{mission.status === 'returning' ? 'På retur' : mission.status === 'working' ? 'Arbeider' : mission.status === 'reserved' ? 'Reservert' : 'Underveis'}</span></header>
            <button type="button" className="cmd-locate" onClick={() => onLocate(mission.targetZoneId)}><HudIcon name="location" size={14} />{commandZone(world, mission.targetZoneId)}</button>
            {portraits(mission.survivorIds)}
            <p className="cmd-order-return">Retur: {commandZone(world, mission.returnZoneId)} · {mission.expectedReturnDay === undefined ? 'tid ukjent' : `forventet dag ${mission.expectedReturnDay}`}</p>
            <div className="cmd-order-bottom"><details className="cmd-order-details"><summary>Detaljer</summary><div><p>Utstyr: {gear.map(gearItemName).join(' · ') || 'Ingen registrert'}</p><p>Last: {commandStock(mission.cargo ?? {})}</p></div></details>{onRedirect && <div className="cmd-order-actions"><button type="button" onClick={() => onRedirect(mission.id)}><HudIcon name="navigation" size={15} />Omdiriger laget</button></div>}</div>
          </article>;
        })}
      </div>
    </section>
    {pages > 1 && <nav className="cmd-plan-pagination" aria-label="Sider i oppdragslisten"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Forrige</button><span aria-live="polite">Side {page + 1} av {pages} · {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} av {total}</span><button type="button" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>Neste</button></nav>}
  </div>;
}

export default DayPlan;
