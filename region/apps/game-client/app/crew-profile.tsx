'use client';

import { Crosshair, MapPin, Shield, Wrench, Heart, Battery, ArrowRight, UserRound, BookOpen } from 'lucide-react';
import { fatigueWorkMultiplier, crewPositionFor, equippedGear, knownCrewL3Zone, TRAIT_NAMES, type GearSlot, type RegionState, type RegionWorld } from '../../../packages/gameplay/src/region';
import './detail-views.css';

export interface CrewProfileProps {
  state: RegionState; world: RegionWorld; personId: string;
  onAssign: (personId: string) => void; onLocate: (zoneId: string) => void;
  onEquipment?: (personId: string) => void;
  onHelp?: (topic:string)=>void;
}
const PORTRAITS = new Set(['ingrid', 'marius', 'leila', 'tor']);
const SLOTS = [ ['weapon', 'Våpen', Crosshair], ['protection', 'Beskyttelse', Shield], ['tool', 'Oppdragsverktøy', Wrench] ] as const;

/** A read-only dossier. Placement and carried equipment come from the canonical registries. */
export function CrewProfile({ state, world, personId, onAssign, onLocate, onEquipment, onHelp }: CrewProfileProps) {
  const person = state.survivors.find(p => p.id === personId);
  if (!person) return <section className="dv"><h2>Personen finnes ikke i mannskapet.</h2></section>;
  const position = crewPositionFor(state, person.id);
  const zoneId = position ? knownCrewL3Zone(position) ?? (position.kind === 'area-duty' ? position.areaZoneId : undefined) : undefined;
  const zoneName = (id: string) => world.zones.find(z => z.id === id)?.name ?? 'Ukjent område';
  const place = !position ? 'Posisjon ikke registrert' : position.kind === 'zone' ? zoneName(position.zoneId)
    : position.kind === 'transit' ? `På vei mot ${zoneName(position.toZoneId)}`
      : position.kind === 'area-duty' ? `${position.duty === 'guard' ? 'Vakthold' : 'Patrulje'} i ${zoneName(position.areaZoneId)}` : 'Ute · nøyaktig posisjon ukjent';
  const present = person.alive && !person.left;
  const mission = Object.values(state.crewMissions ?? {}).find(m => m.survivorIds.includes(person.id) && !['complete', 'failed'].includes(m.status));
  const unavailable = !present ? 'Personen er ikke lenger i mannskapet.'
    : mission ? 'Personen er bundet til et pågående oppdrag. Vent til oppdraget er avsluttet.'
      : person.awayUntil !== undefined && person.awayUntil > state.day ? `Personen er borte på oppdrag til dag ${person.awayUntil}.`
        : position?.kind === 'transit' ? 'Personen er underveis. Nye oppdrag kan planlegges når reisen er avsluttet.'
          : position?.kind === 'area-duty' ? 'Personen dekker et område. Områdeoppdraget må avsluttes før et nytt oppdrag kan planlegges.'
            : position?.kind !== 'zone' ? 'Posisjonen er ikke kjent. Nye oppdrag krever en registrert plassering.' : undefined;
  const equipmentUnavailable = unavailable;
  const slug = person.name.toLocaleLowerCase('nb-NO');
  const status = !person.alive ? 'Død' : person.left ? 'Forlot gruppen' : person.bitten !== undefined ? 'Bitt · trenger behandling' : person.health < 25 ? 'Alvorlig skadet' : position?.kind === 'transit' ? 'Underveis' : position?.kind === 'area-duty' ? 'På post' : 'Overlevende';
  return <section className="dv dv-crew" aria-label={`Personprofil: ${person.name}`}>
    <div className="dv-portrait">{PORTRAITS.has(slug) ? <img src={`/art/crew/${slug}.webp`} alt={`Portrett av ${person.name}`} /> : <UserRound aria-hidden="true" />}<div className="dv-portrait-caption"><span>MANNSKAP</span><strong>Med siden dag {person.joinedDay??0}</strong></div></div>
    <div className="dv-dossier"><header><p className="dv-eyebrow">{person.role}</p><h2>{person.name}</h2><span className={`dv-tag${person.health < 25 || person.bitten !== undefined ? ' dv-warning' : ''}`}>{status}</span></header>
      <p className="dv-lead">{person.about}</p>
      <div className="dv-vitals"><div><Heart aria-hidden="true" /><span>Helse<strong>{Math.round(person.health)}<small> / 100</small></strong></span><progress aria-label="Helse" value={person.health} max={100} /></div><div><Battery aria-hidden="true" /><span>Utmattelse<strong>{Math.round(person.fatigue)}<small> / 100</small></strong></span><progress aria-label="Utmattelse" value={person.fatigue} max={100} /></div></div>
      <div className="dv-fatigue-effect"><Battery size={16}/><span>{fatigueWorkMultiplier(person.fatigue)<1?'Utmattelse: −40 % arbeidsinnsats':'Ingen redusert innsats fra utmattelse'}</span>{onHelp&&<button className="sz-help-icon" aria-label="Håndbok: utmattelse" onClick={()=>onHelp('fatigue')}><BookOpen size={16}/></button>}</div>
      <div className="dv-location"><MapPin aria-hidden="true" /><div><small>FAKTISK PLASSERING</small><p>{place}</p>{position?.kind === 'transit' && <small>Forventet fremme dag {position.estimatedArrivalDay}</small>}{position?.kind === 'away-unknown' && position.expectedReturnDay !== undefined && <small>Forventet tilbake dag {position.expectedReturnDay}</small>}</div>{zoneId && <button type="button" onClick={() => onLocate(zoneId)}>Vis på kart</button>}</div>
      <section aria-label="Båret utstyr"><div className="dv-section-title"><h3>Utstyr på personen</h3>{onEquipment && present && <button type="button" disabled={!!equipmentUnavailable} title={equipmentUnavailable} onClick={() => onEquipment(person.id)}>Tilpass utstyr <ArrowRight aria-hidden="true" /></button>}</div><div className="dv-gear">{SLOTS.map(([slot, label, Icon]) => {
        const gear = equippedGear(state, person.id, slot as GearSlot);
        return <article key={slot}><Icon aria-hidden="true" /><small>{label}</small><strong>{gear?.name ?? 'Ikke utstyrt'}</strong><p>{gear?.description ?? 'Ingen gjenstand registrert i denne kategorien.'}</p></article>;
      })}</div></section>
      {present && <div><div className="dv-actions"><button type="button" className="dv-primary" disabled={!!unavailable} title={unavailable} onClick={() => onAssign(person.id)}>Planlegg oppdrag <ArrowRight aria-hidden="true" /></button></div>{unavailable && <p className="dv-availability">{unavailable}</p>}</div>}
      <details className="dv-details"><summary>Egenskaper og bakgrunn</summary><div className="dv-traits">{person.traits?.map(trait => <span className="dv-tag" key={trait}>{TRAIT_NAMES[trait]}</span>)}</div><dl className="dv-facts"><div><dt>Kamp</dt><dd>{person.skills.combat}</dd></div><div><dt>Speiding</dt><dd>{person.skills.scouting}</dd></div><div><dt>Håndverk</dt><dd>{person.skills.craft}</dd></div><div><dt>Medisin</dt><dd>{person.skills.medical}</dd></div>{person.loyalty !== undefined && <div><dt>Lojalitet</dt><dd>{Math.round(person.loyalty)} / 100</dd></div>}</dl><p>{person.about}</p></details>
    </div>
  </section>;
}
export default CrewProfile;
