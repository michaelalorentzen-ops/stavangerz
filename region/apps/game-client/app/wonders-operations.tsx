'use client';

import { useState } from 'react';
import { HudIcon } from './hud-icons';
import { wonderArt } from './story-art';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import {
  knownWonders, nextWonderLevel, wonderOrderError, wonderOperational, wonderStatus, wonderWorkCost, WONDERS,
} from '../../../packages/gameplay/src/region/wonders';
import './wonders-operations.css';

/** Known installations only. The callback queues a real crew order; no effects resolve in React. */
export function WondersOperations({ state, world, crewIds = [], onOrder, onSelectZone, zoneId }: {
  state: RegionState; world: RegionWorld; crewIds?: string[]; zoneId?: string;
  onOrder?: (zoneId: string, wonderId: string) => void;
  onSelectZone?: (zoneId: string) => void;
}) {
  const holdings = knownWonders(state).filter(([id, holding]) => (!zoneId || holding.zoneId === zoneId) && WONDERS.some(def => def.id === id));
  const [selectedId, setSelectedId] = useState('');
  const selectedIndex = Math.max(0, holdings.findIndex(([id]) => id === selectedId));
  const selected = holdings[selectedIndex];
  return <section className="rz-installations" aria-label="Unike anleggsoppdrag">
    <p className="rz-kicker">OPPDAGELSE · SIKRING · DRIFT</p><h2>Unike steder</h2>
    <p className="rz-installations-intro">Undersøk stedet, sikre adkomsten og få anlegget i drift. Arbeidet krever et faktisk lag på stedet.</p>
    {!holdings.length && <p className="rz-installations-empty">Ingen unike steder er rapportert ennå. Steder kan finnes gjennom feltoppdrag og konkrete ledetråder. Uoppdagede anlegg vises ikke i denne oversikten.</p>}
    {holdings.length > 1 && <nav className="rz-installation-pager" aria-label="Bla i rapporterte unike steder"><button type="button" aria-label="Forrige unike sted" disabled={!selectedIndex} onClick={() => setSelectedId(holdings[selectedIndex - 1][0])}><HudIcon name="back"/></button><label><span className="sz-sr-only">Velg rapportert anlegg</span><select aria-label="Velg rapportert anlegg" value={selected?.[0] ?? ''} onChange={event => setSelectedId(event.target.value)}>{holdings.map(([id], index) => <option key={id} value={id}>{index + 1}/{holdings.length} · {WONDERS.find(def => def.id === id)!.name}</option>)}</select></label><button type="button" aria-label="Neste unike sted" disabled={selectedIndex + 1 >= holdings.length} onClick={() => setSelectedId(holdings[selectedIndex + 1][0])}><HudIcon name="arrow"/></button></nav>}
    {(selected ? [selected] : []).map(([id, holding]) => {
      const def = WONDERS.find(d => d.id === id);
      if (!def) return null;
      const status = wonderStatus(holding), operational = wonderOperational(holding);
      const zone = world.zones.find(z => z.id === holding.zoneId);
      const lost = operational && def.found === 'claim' && state.zones[holding.zoneId]?.status !== 'controlled';
      const next = nextWonderLevel(state, id), costs = wonderWorkCost(state, id);
      const workError = wonderOrderError(state, id, holding.zoneId);
      const error = workError ?? (!crewIds.length ? 'Velg lag i oppdragsplanen.' : undefined);
      return <article className="rz-installation" key={id} data-wonder-id={id}>
        <figure className="rz-installation-scene">{wonderArt(id) && <img src={wonderArt(id)} alt=""/>}<figcaption>Illustrert fortolkning</figcaption></figure><div className="rz-installation-body"><header><h3>{def.name}</h3><span>{lost ? 'Drift avbrutt: sonen er tapt' : status === 'discovered' ? 'Oppdaget' : status === 'secured' ? 'Undersøkt og sikret' : `Operativt · ${def.levels[holding.level]?.name ?? 'kjent nivå'}`}</span></header>
        <p>{def.about}</p>
        <ol className="rz-installation-stages" aria-label="Anleggets trinn">
          <li aria-current={status === 'discovered' ? 'step' : undefined}>Oppdaget</li>
          <li aria-current={status === 'secured' ? 'step' : undefined}>Undersøkt / sikret</li>
          <li aria-current={status === 'operational' ? 'step' : undefined}>Operativt</li>
        </ol>
        {!operational && <p className="rz-installation-note">Ingen grunnvirkninger er aktive ennå. Anleggsarbeid rydder ikke bort en horde; adkomsten må være forsvarlig før crewet kan arbeide.</p>}
        {operational && !holding.installation && <small className="rz-installation-legacy">Videreført aktivt anlegg fra tidligere lagring. Status og virkninger er bevart.</small>}
        {next ? <div className="rz-installation-next"><h4>{next.name}</h4><p>{next.text}</p>
          <label>{Math.round(holding.progress)} av {next.hours} arbeidstimer<progress value={Math.min(holding.progress, next.hours)} max={next.hours} /></label>
          <p className="rz-installation-cost">{Object.keys(costs).length ? `Første arbeidsøkt: ${Object.entries(costs).map(([resource, n]) => `${n} ${{ ammo: 'ammunisjon', building: 'byggematerialer', parts: 'deler', batteries: 'batterier' }[resource] ?? resource}`).join(', ')}.` : holding.progress ? 'Materialene for dette trinnet er allerede betalt.' : 'Ingen materialkostnad for dette trinnet.'}</p>
          {onOrder && <><button type="button" data-testid={`wonder-order-${id}`} disabled={!!workError} title={workError} onClick={() => onOrder(holding.zoneId, id)}>Planlegg anleggsoppdrag</button><small>{error ?? `${crewIds.length} personer valgt. Reise, last, lokalt lager og risiko kontrolleres i dagsplanen.`}</small></>}
        </div> : <p>Alle tilgjengelige utbyggingstrinn er fullført.</p>}
        {onSelectZone && <button type="button" className="rz-installation-map" onClick={() => onSelectZone(holding.zoneId)}><HudIcon name="location" size={16}/>{zone?.name ?? 'Vis på kartet'}</button>}</div>
      </article>;
    })}
  </section>;
}
