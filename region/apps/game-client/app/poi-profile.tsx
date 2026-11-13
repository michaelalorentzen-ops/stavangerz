'use client';

import { ArrowRight, Building2, MapPin, BookOpen, Compass, Clock } from 'lucide-react';
import { previewOrder, resourceName, type ActionId, type RegionState, type RegionWorld } from '../../../packages/gameplay/src/region';
import { knownWonders, nextWonderLevel, wonderStatus, WONDERS } from '../../../packages/gameplay/src/region/wonders';
import { discoveryOrderPreview, visibleDiscoveries, type DiscoveryRegionState } from '../../../packages/gameplay/src/region/discoveries';
import { CONTENT } from '../../../packages/world-data/src/content';
import './detail-views.css';

export interface PoiProfileProps {
  state: RegionState; world: RegionWorld; poiId: string; crewIds: string[];
  onSelectZone: (zoneId: string) => void;
  onOrder: (action: ActionId, zoneId: string, target?: string) => void;
  onJournal?: () => void;
}

/** No raw loot, zombies, hidden discoveries or unreported installation records enter this view. */
export function PoiProfile({ state, world, poiId, crewIds, onSelectZone, onOrder, onJournal }: PoiProfileProps) {
  const poi = world.pois.find(p => p.id === poiId);
  const wonder = knownWonders(state).find(([id]) => id === poiId || WONDERS.find(w => w.id === id)?.poi === poiId);
  const discovery = visibleDiscoveries(state as DiscoveryRegionState).find(e => e.id === poiId || e.poiId === poiId);
  const zoneId = discovery?.zoneId ?? wonder?.[1].zoneId ?? poi?.zoneId;
  const known = !!wonder || !!discovery || (!!zoneId && !!state.zones[zoneId] && state.zones[zoneId].status !== 'unknown');
  if (!known || !zoneId) return <section className="dv dv-poi"><p className="dv-eyebrow">FELTREGISTER</p><h2>Stedet er ikke rapportert</h2><p className="dv-lead">Utforsk området for å finne ut hva som finnes her.</p>{onJournal && <button type="button" onClick={onJournal}>Åpne feltjournalen</button>}</section>;
  const zone = world.zones.find(z => z.id === zoneId);
  const definition = wonder ? WONDERS.find(w => w.id === wonder[0]) : undefined;
  const title = discovery?.title ?? definition?.name ?? poi?.name ?? 'Rapportert sted';
  const type = poi?.hqType ? CONTENT.hqTypes.find(t => t.id === poi.hqType) : undefined;
  const site = CONTENT.facilityTypes.find(t => t.id === poi?.facilityType) ?? CONTENT.siteTypes.find(t => t.id === poi?.siteType);
  const actions: { action: ActionId; label: string; target?: string }[] = [];
  if (wonder && nextWonderLevel(state, wonder[0])) actions.push({ action: 'wonder', label: nextWonderLevel(state, wonder[0])!.name, target: wonder[0] });
  if (poi?.role === 'hq' && !state.hq) actions.push({ action: 'establishHq', label: 'Etabler hovedkvarter' });
  const next = wonder ? nextWonderLevel(state, wonder[0]) : undefined;
  return <section className="dv dv-poi" aria-label={title}>
    <header className="dv-place-hero"><div className="dv-place-symbol"><Building2 aria-hidden="true" /></div><div><p className="dv-eyebrow">{discovery ? 'OPPDAGELSE / FELTJOURNAL' : wonder ? 'UNIKT ANLEGG' : poi?.role === 'hq' ? 'MULIG HOVEDKVARTER' : 'RAPPORTERT STED'}</p><h2>{title}</h2><p><MapPin aria-hidden="true" /> {zone?.name ?? 'Rapportert sone'}</p></div></header>
    <div className="dv-poi-body"><p className="dv-lead">{discovery?.notes.at(-1)?.text ?? definition?.about ?? (type ? `${type.name}. Et mulig fast tilhold for gruppen.` : site ? ('summary' in site ? site.summary : site.name) : 'Registrert sted i sonen.')}</p>
      <div className="dv-traits"><span className="dv-tag">{state.zones[zoneId]?.status === 'controlled' ? 'Sonen er kontrollert' : 'Sonen er ikke kontrollert'}</span>{wonder && <span className="dv-tag">{({ discovered: 'Oppdaget', secured: 'Undersøkt og sikret', operational: 'Operativt' })[wonderStatus(wonder[1])]}</span>}{state.hq?.zoneId === zoneId && <span className="dv-tag">Eget HQ i sonen</span>}</div>
      {next && wonder && <article className="dv-next"><p className="dv-eyebrow">NESTE UTVIKLING</p><h3>{next.name}</h3><p>{next.text}</p><label><Clock aria-hidden="true" /> {Math.round(wonder[1].progress)} / {next.hours} arbeidstimer<progress aria-label="Anleggsarbeid" value={Math.min(wonder[1].progress, next.hours)} max={Math.max(1, next.hours)} /></label></article>}
      <div className="dv-order-options">{actions.map(({ action, target, label }) => {
        const preview = previewOrder(state, world, { action, zoneId, target, survivorIds: crewIds });
        return <article key={`${action}-${target}`}><button type="button" className="dv-primary" onClick={() => onOrder(action, zoneId, target)}>{label}<ArrowRight aria-hidden="true" /></button>{crewIds.length>0 && preview.valid && <small>{Object.entries(preview.costs).map(([id, n]) => `${n} ${resourceName(id)}`).join(' · ') || 'Ingen materialkostnad'}. Reise og reservasjoner kontrolleres i dagsplanen.</small>}</article>;
      })}{discovery && !['resolved', 'lost'].includes(discovery.status) && (discovery.status === 'choice' ? discovery.choices.map(c => ({ target: `${discovery.id}:${c.id}`, label: c.label, detail: c.detail, kind: 'choice' as const })) : [{ target: discovery.id, label: discovery.status === 'followup' ? 'Fortsett undersøkelsen' : 'Undersøk ledetråden', detail: 'Planlegg et feltoppdrag til stedet.', kind: 'investigate' as const }]).map(option => {
        const preview = discoveryOrderPreview(state as DiscoveryRegionState, world, zoneId, option.target, crewIds, option.kind);
        return <article key={option.target}><button type="button" className="dv-primary" onClick={() => onOrder(option.kind === 'choice' ? 'discoveryChoice' : 'investigate', zoneId, option.target)}>{option.label}<ArrowRight aria-hidden="true" /></button><p>{option.detail}</p><small>{preview.ok ? `${preview.hours} arbeidstimer på stedet. Reise kommer i tillegg.` : preview.reason}</small></article>;
      })}</div>
      <div className="dv-actions"><button type="button" onClick={() => onSelectZone(zoneId)}><Compass aria-hidden="true" />Vis på kartet</button>{onJournal && <button type="button" onClick={onJournal}><BookOpen aria-hidden="true" />Feltjournal</button>}</div>
      {discovery && discovery.notes.length > 1 && <details className="dv-details"><summary>Tidligere feltnotater</summary>{discovery.notes.slice(0, -1).map(note => <p key={note.id}><small>Dag {note.day}</small><br />{note.text}</p>)}</details>}
    </div>
  </section>;
}
export default PoiProfile;
