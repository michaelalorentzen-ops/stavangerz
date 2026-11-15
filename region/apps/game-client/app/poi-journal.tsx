'use client';

import { useState } from 'react';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import { discoveryOrderPreview, visibleDiscoveries, type DiscoveryEntry, type DiscoveryRegionState } from '../../../packages/gameplay/src/region/discoveries';
import { HudIcon } from './hud-icons';
import { environmentArt } from './story-art';
import './poi-journal.css';

export interface PoiJournalProps {
  state: RegionState; world: RegionWorld; crewIds?: string[];
  onSelectZone?: (zoneId: string) => void;
  /** Open the ordinary authoritative order planner; React never resolves the work. */
  onOrder?: (action: 'investigate' | 'discoveryChoice', zoneId: string, target: string) => void;
}
const STATUS = { clue: 'Ledetråd', choice: 'Et valg gjenstår', followup: 'Neste undersøkelse', resolved: 'Avsluttet', lost: 'Sporet er tapt' } as const;
const SOURCE = { scout: 'Speiding', search: 'Søk / dokument', rumor: 'Rykte', radio: 'Radio' } as const;
/** Preserve every word of a long note without turning the journal into a scrolling wall. */
function noteParts(text: string, max = 360) {
  const parts: string[] = []; let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && current.length + word.length + 1 > max) { parts.push(current); current = ''; }
    current += `${current ? ' ' : ''}${word}`;
  }
  if (current || !parts.length) parts.push(current);
  return parts;
}
function Entry({ entry, state, world, crewIds = [], onSelectZone, onOrder }: PoiJournalProps & { entry: DiscoveryEntry }) {
  const [history, setHistory] = useState(false), [noteIndex, setNoteIndex] = useState(0), [part, setPart] = useState(0);
  const active = !['resolved', 'lost'].includes(entry.status);
  const zoneName = world.zones.find(z => z.id === entry.zoneId)?.name ?? 'Rapportert sone';
  const requiredPerson = entry.boundPersonId ? state.survivors.find(p => p.id === entry.boundPersonId) : undefined;
  const note = history ? entry.notes[Math.min(noteIndex, Math.max(0, entry.notes.length - 1))] : entry.notes.at(-1);
  const parts = noteParts(note?.text ?? 'Ingen feltnotater er rapportert.'), partIndex = Math.min(part, parts.length - 1);
  // Old entries have no illustration tag. A generic interior is decorative, not a claimed POI photograph.
  const illustration = environmentArt(entry.illustration ?? (entry.kind === 'tor' ? 'industry' : 'shop'));
  const action = (target: string, kind: 'investigate' | 'choice', label: string, detail: string) => {
    const preview = discoveryOrderPreview(state as DiscoveryRegionState, world, entry.zoneId, target, crewIds, kind);
    const cost = Object.entries(preview.cost).map(([id, n]) => `${n} ${id === 'parts' ? 'deler' : id}`).join(', ');
    return <div className="rz-poi-journal-action" key={target}>
      <button type="button" data-testid={`discovery-${target}`} disabled={crewIds.length > 0 && !preview.ok} title={crewIds.length ? preview.reason : undefined}
        onClick={() => onOrder?.(kind === 'investigate' ? 'investigate' : 'discoveryChoice', entry.zoneId, target)}>{label}<HudIcon name="arrow" size={16}/></button>
      <p>{detail}</p>
      <small>{!crewIds.length ? 'Velg lag i oppdragsplanen.' : preview.ok ? `${preview.hours} arbeidstimer${cost ? ` · ${cost}` : ''}. Reise kommer i tillegg.` : preview.reason}</small>
    </div>;
  };
  return <article className={`rz-poi-journal-entry rz-poi-journal-${entry.status}`} data-discovery-id={entry.id}>
    <div className="pj-scene" aria-hidden="true">{illustration && <img src={illustration} alt=""/>}<HudIcon name={entry.boundPersonId ? 'crew' : 'compass'} size={27}/></div>
    <div className="pj-entry-main">
      <header><span className="rz-poi-journal-status">{STATUS[entry.status]}</span><small>{entry.boundPersonId ? 'Personbundet historie' : 'Lokalt funn'} · valgfritt</small></header>
      <h3>{entry.title}</h3>
      <p className="rz-poi-journal-place">{onSelectZone ? <button type="button" onClick={() => onSelectZone(entry.zoneId)}><HudIcon name="location" size={16}/><span>{entry.poiName} · {zoneName}</span></button> : entry.poiName}</p>
      <div className="pj-note" aria-label={history ? 'Tidligere feltnotater' : 'Siste feltnotat'}>{history && <small>Dag {note?.day}</small>}<p>{parts[partIndex]}</p></div>
      {parts.length > 1 && <nav className="pj-part-nav" aria-label="Les hele feltnotatet"><button type="button" aria-label="Forrige tekstdel" disabled={!partIndex} onClick={() => setPart(partIndex - 1)}>←</button><span>Tekst {partIndex + 1}/{parts.length}</span><button type="button" aria-label="Neste tekstdel" disabled={partIndex + 1 >= parts.length} onClick={() => setPart(partIndex + 1)}>→</button></nav>}
      {history ? <nav className="pj-history-nav" aria-label="Bla i feltnotater"><button type="button" aria-label="Forrige feltnotat" disabled={!noteIndex} onClick={() => { setNoteIndex(noteIndex - 1); setPart(0); }}>←</button><span>Notat {Math.min(noteIndex + 1, entry.notes.length)} / {entry.notes.length}</span><button type="button" aria-label="Neste feltnotat" disabled={noteIndex + 1 >= entry.notes.length} onClick={() => { setNoteIndex(noteIndex + 1); setPart(0); }}>→</button></nav>
        : <>
          {active && requiredPerson && <p className="rz-poi-journal-person"><HudIcon name="crew" size={15}/>{requiredPerson.name} må delta i oppdraget.</p>}
          {active && onOrder && <div className="rz-poi-journal-actions">{entry.status === 'choice' ? entry.choices.map(choice => action(`${entry.id}:${choice.id}`, 'choice', choice.label, choice.detail)) : action(entry.id, 'investigate', entry.status === 'followup' ? 'Planlegg neste undersøkelse' : 'Undersøk ledetråden', 'Send et lag. Resultatet blir kjent når laget rapporterer.')}</div>}
        </>}
      <footer className="pj-entry-footer"><span className="rz-poi-journal-source">Dag {entry.discoveredDay} · {entry.sources.map(source => SOURCE[source]).join(' / ')}</span>{entry.notes.length > 1 && <button type="button" onClick={() => { setHistory(!history); setNoteIndex(0); setPart(0); }}><HudIcon name={history ? 'back' : 'book'} size={16}/>{history ? 'Tilbake til sporet' : `Feltnotater · ${entry.notes.length}`}</button>}</footer>
    </div>
  </article>;
}
function EntryPager(props: PoiJournalProps & { entries: DiscoveryEntry[]; label: string }) {
  const [selectedId, setSelectedId] = useState('');
  const index = Math.max(0, props.entries.findIndex(entry => entry.id === selectedId));
  const entry = props.entries[index];
  if (!entry) return null;
  return <>{props.entries.length > 1 && <nav className="pj-entry-pager" aria-label={props.label}><button type="button" aria-label="Forrige spor" disabled={!index} onClick={() => setSelectedId(props.entries[index - 1].id)}><HudIcon name="back"/></button><label><span className="sz-sr-only">Velg rapportert spor</span><select aria-label="Velg rapportert spor" value={entry.id} onChange={event => setSelectedId(event.target.value)}>{props.entries.map((item, i) => <option key={item.id} value={item.id}>{i + 1}/{props.entries.length} · {item.title}</option>)}</select></label><button type="button" aria-label="Neste spor" disabled={index + 1 >= props.entries.length} onClick={() => setSelectedId(props.entries[index + 1].id)}><HudIcon name="arrow"/></button></nav>}<Entry key={`${entry.id}:${entry.revision}`} {...props} entry={entry}/></>;
}

/** Public observations only: pending field reports never enter this component. */
export function PoiJournal(props: PoiJournalProps) {
  const [showFinished, setShowFinished] = useState(false);
  const entries = visibleDiscoveries(props.state as DiscoveryRegionState);
  const active = entries.filter(entry => !['resolved', 'lost'].includes(entry.status));
  const finished = entries.filter(entry => ['resolved', 'lost'].includes(entry.status));
  const shown = showFinished ? finished : active;
  return <section className="rz-poi-journal" aria-label="Oppdagelser og spor">
    <p className="rz-kicker">FELTJOURNAL</p><h2>Oppdagelser og spor</h2>
    <p className="pj-intro">Rapporterte funn og valgfrie historier. Følg sporene som interesserer dere.</p>
    <div className="rz-poi-journal-tabs" role="group" aria-label="Vis spor"><button type="button" aria-pressed={!showFinished} onClick={() => setShowFinished(false)}>Åpne spor · {active.length}</button><button type="button" aria-pressed={showFinished} onClick={() => setShowFinished(true)}>Funn og avsluttede · {finished.length}</button></div>
    {!shown.length && <p className="rz-poi-journal-empty">{showFinished ? 'Ingen avsluttede funn er rapportert ennå.' : 'Ingen åpne spor er rapportert. Speiding, søk, samtaler og fungerende radio kan gi ledetråder.'}</p>}
    <EntryPager key={showFinished ? 'finished' : 'active'} {...props} entries={shown} label="Bla i rapporterte spor"/>
    <small className="rz-poi-journal-fiction">Personhistorier og fortellingsdetaljer er fiksjon i spillverdenen.</small>
  </section>;
}

/** The map panel shares the public journal, with one entry at a time. */
export function DiscoveryZonePanel(props: PoiJournalProps & { zoneId: string }) {
  const entries = visibleDiscoveries(props.state as DiscoveryRegionState, props.zoneId);
  if (!entries.length) return null;
  return <section className="rz-poi-journal rz-poi-journal-inline" aria-label="Rapporterte spor i sonen"><h3>Rapporterte spor</h3><EntryPager {...props} entries={entries} label="Bla i sonens spor"/></section>;
}
