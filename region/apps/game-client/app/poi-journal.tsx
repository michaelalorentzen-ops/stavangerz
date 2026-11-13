'use client';

import { useState } from 'react';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import {
  discoveryOrderPreview, visibleDiscoveries,
  type DiscoveryEntry, type DiscoveryRegionState,
} from '../../../packages/gameplay/src/region/discoveries';
import './poi-journal.css';

export interface PoiJournalProps {
  state: RegionState; world: RegionWorld; crewIds?: string[];
  onSelectZone?: (zoneId: string) => void;
  /** Queue an ordinary authoritative daily order; never resolve in React. */
  onOrder?: (action: 'investigate' | 'discoveryChoice', zoneId: string, target: string) => void;
}
const STATUS = { clue: 'Ledetråd', choice: 'Et valg gjenstår', followup: 'Neste undersøkelse', resolved: 'Avsluttet', lost: 'Sporet er tapt' } as const;
const SOURCE = { scout: 'Speiding', search: 'Søk / dokument', rumor: 'Rykte', radio: 'Radio' } as const;
function Entry({ entry, state, world, crewIds = [], onSelectZone, onOrder }: PoiJournalProps & { entry: DiscoveryEntry }) {
  const active = !['resolved', 'lost'].includes(entry.status);
  const zoneName = world.zones.find(z => z.id === entry.zoneId)?.name ?? 'Rapportert sone';
  const requiredPerson = entry.boundPersonId ? state.survivors.find(p => p.id === entry.boundPersonId) : undefined;
  const action = (target: string, kind: 'investigate' | 'choice', label: string, detail: string) => {
    const preview = discoveryOrderPreview(state as DiscoveryRegionState, world, entry.zoneId, target, crewIds, kind);
    const cost = Object.entries(preview.cost).map(([id, n]) => `${n} ${id === 'parts' ? 'deler' : id}`).join(', ');
    return <div className="rz-poi-journal-action" key={target}>
      <button type="button" data-testid={`discovery-${target}`} disabled={!preview.ok} title={preview.reason}
        onClick={() => onOrder?.(kind === 'investigate' ? 'investigate' : 'discoveryChoice', entry.zoneId, target)}>{label}</button>
      <p>{detail}</p>
      <small>{preview.ok ? `${preview.hours} arbeidstimer på stedet${cost ? ` · ${cost}` : ''}. Reise, risiko og utmattelse kommer i tillegg.` : preview.reason}</small>
    </div>;
  };
  return <article className={`rz-poi-journal-entry rz-poi-journal-${entry.status}`} data-discovery-id={entry.id}>
    <header><span className="rz-poi-journal-status">{STATUS[entry.status]}</span><small>{entry.kind === 'tor' ? 'Personbundet sidehistorie' : 'Lokalt funn'} · valgfritt</small></header>
    <h3>{entry.title}</h3>
    <p className="rz-poi-journal-place">{entry.poiName}{onSelectZone && <button type="button" onClick={() => onSelectZone(entry.zoneId)}>Vis {zoneName} på kartet</button>}</p>
    <p>{entry.notes.at(-1)?.text}</p>
    <p className="rz-poi-journal-source">Rapportert dag {entry.discoveredDay} · {entry.sources.map(s => SOURCE[s]).join(' / ')}</p>
    {entry.notes.length > 1 && <details><summary>Tidligere feltnotater ({entry.notes.length - 1})</summary><ol>
      {entry.notes.slice(0, -1).map(n => <li key={n.id}><small>Dag {n.day}</small><p>{n.text}</p></li>)}
    </ol></details>}
    {active && requiredPerson && <p className="rz-poi-journal-person">{requiredPerson.name} må delta. Vanlig utforsking og faseprogresjon krever aldri denne historien.</p>}
    {active && onOrder && <div className="rz-poi-journal-actions">
      {entry.status === 'choice' ? entry.choices.map(c => action(`${entry.id}:${c.id}`, 'choice', c.label, c.detail))
        : action(entry.id, 'investigate', entry.status === 'followup' ? 'Planlegg neste undersøkelse' : 'Undersøk ledetråden', 'Legges til dagsplanen med de valgte personene. Funnet blir kjent når laget rapporterer; utstyr og ressurser må fraktes hjem.')}
    </div>}
    <small className="rz-poi-journal-fiction">Fortellingsdetaljene er fiksjon knyttet til et eksisterende sted.</small>
  </article>;
}

/** Known observations only: pending field reports are intentionally never read here. */
export function PoiJournal(props: PoiJournalProps) {
  const [showFinished, setShowFinished] = useState(false);
  const entries = visibleDiscoveries(props.state as DiscoveryRegionState);
  const active = entries.filter(e => !['resolved', 'lost'].includes(e.status));
  const finished = entries.filter(e => ['resolved', 'lost'].includes(e.status));
  const shown = showFinished ? finished : active;
  return <section className="rz-poi-journal" aria-label="Oppdagelser og spor">
    <p className="rz-kicker">FELTJOURNAL</p><h2>Oppdagelser og spor</h2>
    <p>Ikke alle funn blir en stor historie. Følg spor som interesserer deg, la andre ligge, og ta vare på dem som bærer historien.</p>
    <div className="rz-poi-journal-tabs" role="group" aria-label="Vis spor">
      <button type="button" aria-pressed={!showFinished} onClick={() => setShowFinished(false)}>Åpne spor · {active.length}</button>
      <button type="button" aria-pressed={showFinished} onClick={() => setShowFinished(true)}>Avsluttede · {finished.length}</button>
    </div>
    {!shown.length && <p className="rz-poi-journal-empty">{showFinished ? 'Ingen avsluttede spor er rapportert ennå.' : 'Ingen åpne spor er rapportert. Speiding, søk, samtaler og fungerende radio kan gi ledetråder. Det er ingen plikt å finne dem alle.'}</p>}
    {shown.map(entry => <Entry key={entry.id} {...props} entry={entry} />)}
  </section>;
}

/** Small projection for an existing L3 context panel, sharing exactly the same state. */
export function DiscoveryZonePanel(props: PoiJournalProps & { zoneId: string }) {
  const entries = visibleDiscoveries(props.state as DiscoveryRegionState, props.zoneId);
  if (!entries.length) return null;
  return <section className="rz-poi-journal rz-poi-journal-inline" aria-label="Rapporterte spor i sonen">
    <h3>Rapporterte spor</h3>{entries.map(entry => <Entry key={entry.id} {...props} entry={entry} />)}
  </section>;
}
