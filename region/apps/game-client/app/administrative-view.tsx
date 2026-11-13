'use client';

import { useId, useState } from 'react';
import type { Population, RegionState, RegionWorld, Stock } from '../../../packages/gameplay/src/region/types';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import {
  administrations, administrationCommandError, regionalL1, regionalMandate, regionalStock, regionalSupplyRequest,
  REGIONAL_POLICIES, type AdministrationCommand, type AdministrationGame, type RegionalPolicy,
} from '../../../packages/gameplay/src/region/administration';
import './administrative-view.css';

type Props = {
  state: RegionState; world: RegionWorld; enabled?: boolean;
  onCommand: (command: AdministrationCommand) => void;
  onSupplyRequest: (destinationZoneId: string, cargo: Stock) => void;
  onSelectZone?: (zoneId: string) => void;
};
const POP_LABELS: Record<keyof Population, string> = { adults: 'Voksne', children: 'Barn', elderly: 'Eldre', sick: 'Syke' };
const stockText = (stock: Stock) => Object.entries(stock).filter(([, n]) => n > .01).map(([id, n]) => `${Math.round(n * 10) / 10} ${id === 'food' ? 'mat' : id === 'water' ? 'vann' : id === 'medicine' ? 'medisin' : id}`).join(' · ') || 'Tomt';

export function AdministrativeView({ state, world, enabled = false, onCommand, onSupplyRequest, onSelectZone }: Props) {
  const formId = useId();
  const regions = administrations(state);
  const candidates = world.zones.filter(z => z.level === 3 && z.id !== state.homeZoneId && state.zones[z.id]?.status === 'controlled' && regionalL1(world, z.id) && !regions.some(r => r.l1Id === regionalL1(world, z.id)));
  const [hq, setHq] = useState(''); const [leader, setLeader] = useState('');
  const selectedHq = candidates.some(z => z.id === hq) ? hq : candidates[0]?.id ?? '';
  const locals = (zoneId: string) => state.survivors.filter(s => { const p = crewPositionFor(state, s.id); return s.alive && !s.left && p?.kind === 'zone' && p.zoneId === zoneId; });
  const selectedLeader = locals(selectedHq).some(s => s.id === leader) ? leader : locals(selectedHq)[0]?.id ?? '';
  const establish: AdministrationCommand = { kind: 'establish', hqZoneId: selectedHq, leaderId: selectedLeader };
  const establishError = administrationCommandError(state, world, establish);
  const locked = !enabled || Boolean(state.turnCheckpoint || state.event || state.gameOver);
  return <section className="regional-admin" aria-label="Regional styring">
    <header><span className="regional-kicker">Én organisasjon · lokale forsyninger</span><h2>Regionale ledere</h2><p>Gi lokale rutiner et mandat. Folk, utstyr og forsyninger må reise til regionen; krig, diplomati og lover avgjør du.</p></header>
    <p className="regional-mandate">{regionalMandate(state).description}</p>
    {state.phase < 4 ? <p>Åpner i fase 4. Inntil da styrer hoved-HQ samfunnet.</p> : <>
      <form className="regional-establish" onSubmit={event => { event.preventDefault(); if (!establishError) onCommand(establish); }}>
        <h3>Etabler regionalt HQ</h3>
        <label htmlFor={`${formId}-hq`}>Kontrollert sone</label><select id={`${formId}-hq`} value={selectedHq} onChange={event => setHq(event.target.value)} disabled={locked || !candidates.length}>{!candidates.length && <option value="">Ingen ledig region</option>}{candidates.map(z => <option value={z.id} key={z.id}>{z.name}</option>)}</select>
        <label htmlFor={`${formId}-leader`}>Leder på stedet</label><select id={`${formId}-leader`} value={selectedLeader} onChange={event => setLeader(event.target.value)} disabled={locked || !locals(selectedHq).length}>{!locals(selectedHq).length && <option value="">Send en overlevende hit først</option>}{locals(selectedHq).map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}</select>
        <button disabled={locked || Boolean(establishError)}>Etabler HQ</button>{!enabled ? <small>Forhåndsvisning: regionalt mandat venter på godkjenning.</small> : establishError && <small>{establishError}</small>}
      </form>
      <div className="regional-list">{regions.map(region => {
        const stock = regionalStock(state, region); const pending = (state as AdministrationGame).mobility?.depotResidents?.[region.hqZoneId];
        const request = regionalSupplyRequest(state, region); const here = locals(region.hqZoneId);
        const current = state.survivors.find(s => s.id === region.leaderId);
        return <article className="regional-card" key={region.l1Id}>
          <header><h3>{world.zones.find(z => z.id === region.l1Id)?.name ?? region.l1Id}</h3><button type="button" onClick={() => onSelectZone?.(region.hqZoneId)}>Vis HQ på kartet</button></header>
          <p>{world.zones.find(z => z.id === region.hqZoneId)?.name} · {current?.alive ? current.name : 'Leder mangler'}</p>
          <label>Lokal leder<select value={region.leaderId ?? ''} disabled={locked} onChange={e => onCommand({ kind: 'leader', l1Id: region.l1Id, leaderId: e.target.value })}><option value="" disabled>Bekreft ny leder</option>{here.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Utpekt stedfortreder<select value={region.successorId ?? ''} disabled={locked} onChange={e => onCommand({ kind: 'successor', l1Id: region.l1Id, survivorId: e.target.value || undefined })}><option value="">Ingen utpekt</option>{here.filter(s => s.id !== region.leaderId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Mandat<select value={region.policy} disabled={locked} onChange={e => onCommand({ kind: 'policy', l1Id: region.l1Id, policy: e.target.value as RegionalPolicy })}>{Object.entries(REGIONAL_POLICIES).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}</select></label>
          <small>{REGIONAL_POLICIES[region.policy].text}</small>
          <dl><div><dt>Lokalt lager</dt><dd>{stockText(stock)}</dd></div><div><dt>Arbeid i dag</dt><dd>{Object.entries(region.work).filter(([, n]) => n).map(([id, n]) => `${n} ${id}`).join(' · ') || 'Ingen arbeidskraft'}</dd></div></dl>
          <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const residents = Object.fromEntries(Object.keys(POP_LABELS).map(key => [key, Number(data.get(key))])) as unknown as Population; onCommand({ kind: 'residents', l1Id: region.l1Id, residents }); }}>
            <fieldset disabled={locked}><legend>Lokale innbyggere</legend><p>Alloker leverte innbyggere. Frigjorte folk venter her på transport, og forsvinner ikke til hoved-HQ.</p><div className="regional-population">{(Object.keys(POP_LABELS) as (keyof Population)[]).map(key => <label key={key}>{POP_LABELS[key]}<input name={key} type="number" min="0" step="1" max={region.residents[key] + (pending?.[key] ?? 0)} defaultValue={region.residents[key]} key={`${key}-${region.residents[key]}`} required /></label>)}</div><button>Oppdater lokal allokering</button></fieldset>
          </form>
          <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onCommand({ kind: 'budget', l1Id: region.l1Id, budget: Object.fromEntries(['food', 'water', 'medicine'].map(id => [id, Number(data.get(id))])) }); }}>
            <fieldset disabled={locked}><legend>Ønsket reserve</legend><p>Dette er et forsyningsmål. Mengdene trekkes først når en transport faktisk drar.</p><div className="regional-population">{[['food', 'Mat'], ['water', 'Vann'], ['medicine', 'Medisin']].map(([id, name]) => <label key={id}>{name}<input type="number" min="0" step="1" name={id} defaultValue={region.budget[id] ?? 0} key={`${id}-${region.budget[id]}`} required /></label>)}</div><button>Sett forsyningsmål</button></fieldset>
          </form>
          <p>Behov: {stockText(request)}</p><button disabled={locked || !Object.keys(request).length} onClick={() => onSupplyRequest(region.hqZoneId, request)}>Planlegg fysisk forsyning</button>
          {region.ledger && <details><summary>Lokalt døgnregnskap · dag {region.ledger.day}</summary><p>Produsert: {stockText(region.ledger.produced)}</p><p>Brukt: {stockText(region.ledger.consumed)}</p><p>Udekket: {stockText(region.ledger.shortages)}</p></details>}
          {region.alerts.length > 0 && <ul className="regional-alerts">{region.alerts.map((alert, i) => <li key={i}>{alert}</li>)}</ul>}
        </article>;
      })}</div>
    </>}
  </section>;
}
