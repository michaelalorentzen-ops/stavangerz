'use client';

import { Accessibility, Baby, HeartPulse, PersonStanding, UserRound, Users } from 'lucide-react';
import { administrations, centralPopulation } from '../../../packages/gameplay/src/region/administration';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { assigned, autoWork, workforce, WORK_IDS } from '../../../packages/gameplay/src/region/society';
import { WORK_NAMES } from '../../../packages/gameplay/src/region/systems';
import type { RegionState, RegionWorld, WorkId } from '../../../packages/gameplay/src/region/types';
import { HudIcon, type HudIconName } from './hud-icons';
import './community-work.css';

export interface CommunityWorkProps {
  state: RegionState;
  world: RegionWorld;
  onWork: (allocation: Partial<Record<WorkId, number>>) => void;
  onAdvanced?: () => void;
  onHelp?: (topic: string) => void;
}
const JOB_ICONS: Record<WorkId, HudIconName> = {
  farm: 'farm', fish: 'fish', scavenge: 'search', clear: 'clear', guard: 'guard', build: 'build', research: 'research',
};
const JOB_DETAILS: Record<WorkId, string> = {
  farm: 'Dyrker mat på kontrollert jord.',
  fish: 'Skaffer mat med båt langs kontrollert kyst.',
  scavenge: 'Henter forsyninger i trygge nærområder.',
  clear: 'Rydder zombier i og nær egne soner.',
  guard: 'Forsvarer sonene om natten.',
  build: 'Hjelper byggeprosjekter og reparerer forsvar.',
  research: 'Arbeider med valgt forskning.',
};

/** Group work is separate from named crew orders. Every control uses the existing authoritative allocation rules. */
export function CommunityWork({ state, world, onWork, onAdvanced, onHelp }: CommunityWorkProps) {
  const population = centralPopulation(state);
  const residents = population.adults + population.children + population.elderly;
  const allResidents = state.population.adults + state.population.children + state.population.elderly;
  const elsewhere = Math.max(0, allResidents - residents);
  const regions = administrations(state).length;
  const crew = state.survivors.filter(person => person.alive && !person.left);
  const crewHere = crew.filter(person => {
    const position = crewPositionFor(state, person.id);
    return position?.kind === 'zone' && position.zoneId === state.homeZoneId;
  }).length;
  const capacity = workforce(state);
  const working = assigned(state);
  const idle = Math.max(0, capacity - working);
  const excess = Math.max(0, working - capacity);
  const locked = Boolean(state.turnCheckpoint || state.event || state.gameOver);
  const change = (job: WorkId, amount: -1 | 1) => {
    const current = state.work[job] ?? 0;
    if (locked || (amount > 0 && working >= capacity) || current + amount < 0) return;
    onWork({ ...state.work, [job]: current + amount });
  };
  const detail = (job: WorkId) => job === 'research' && !state.research.current ? 'Velg forskning før denne jobben gir fremdrift.'
    : job === 'fish' && !(state.stock.boat > 0) ? 'Trenger båt og kontrollert kyst for å gi mat.' : JOB_DETAILS[job];

  return <section className="community-work" aria-label="Arbeid og innbyggere">
    <header className="cw-heading"><h3>Hvem gjør hva?</h3>{onHelp && <button type="button" className="cw-text-button" onClick={() => onHelp('community')}><HudIcon name="help" size={16} />Om innbyggerne</button>}</header>
    <div className="cw-groups">
      <div className="cw-group"><UserRound aria-hidden="true" /><div><strong>{crew.length} i mannskapet</strong><span>Navngitte personer · egne oppdrag{crewHere !== crew.length ? ` · ${crewHere} her` : ''}</span></div></div>
      <div className="cw-group"><Users aria-hidden="true" /><div><strong>{residents} innbyggere her</strong><span>Jobber i grupper · fordeles nedenfor</span></div></div>
    </div>
    <dl className="cw-population" aria-label="Innbyggere på leirstedet">
      <div><PersonStanding aria-hidden="true" /><dt>Voksne</dt><dd>{population.adults}</dd></div>
      <div><Baby aria-hidden="true" /><dt>Barn</dt><dd>{population.children}</dd></div>
      <div><Accessibility aria-hidden="true" /><dt>Eldre</dt><dd>{population.elderly}</dd></div>
      <div title="Syke er allerede med i innbyggertallet."><HeartPulse aria-hidden="true" /><dt>Syke</dt><dd>{population.sick}</dd></div>
    </dl>
    {elsewhere > 0 && <p className="cw-away">{elsewhere} innbyggere {regions ? 'i regioner, andre leirer eller underveis' : 'i andre leirer eller underveis'} inngår ikke i denne fordelingen.</p>}
    <div className={`cw-allocation${idle > 0 ? ' cw-needs-work' : ''}${excess > 0 ? ' cw-overallocated' : ''}`} aria-live="polite">
      <div className="cw-allocation-stats"><span><b>{capacity}</b> arbeidsføre</span><span><b>{working}</b> i arbeid</span><strong><HudIcon name={idle || excess ? 'warning' : 'check'} size={17} />{excess ? `${excess} for mange fordelt` : `${idle} uten oppgave`}</strong></div>
      <small>{excess ? 'Arbeidskraften har falt. Reduser fordelingen.' : 'Nye innbyggere blir ikke satt i arbeid automatisk. Helse og lover bestemmer arbeidskraften.'}</small>
    </div>
    <div className="cw-work-toolbar"><h4>Fordel dagens arbeid</h4><button type="button" className="cw-suggest" disabled={locked || capacity === 0 && working === 0} onClick={() => onWork(autoWork(state, world))}><HudIcon name="work" size={16} />Foreslå fordeling</button></div>
    <div className="cw-jobs" role="group" aria-label="Fordeling mellom jobber">
      {WORK_IDS.map(job => <div className={`cw-job${state.work[job] ? ' cw-job-assigned' : ''}`} key={job}>
        <span className="cw-job-icon"><HudIcon name={JOB_ICONS[job]} size={21} /></span>
        <div className="cw-job-copy"><strong>{WORK_NAMES[job]}</strong><small>{detail(job)}</small></div>
        <div className="cw-stepper"><button type="button" aria-label={`Færre til ${WORK_NAMES[job].toLowerCase()}`} disabled={locked || !(state.work[job] > 0)} onClick={() => change(job, -1)}><HudIcon name="minus" size={16} /></button><output aria-label={`Antall i ${WORK_NAMES[job].toLowerCase()}`}>{state.work[job] ?? 0}</output><button type="button" aria-label={`Flere til ${WORK_NAMES[job].toLowerCase()}`} disabled={locked || working >= capacity} onClick={() => change(job, 1)}><HudIcon name="plus" size={16} /></button></div>
      </div>)}
    </div>
    {locked && <p className="cw-locked">{state.gameOver ? 'Spillet er avsluttet.' : 'Avklar hendelsen eller fullfør døgnet før du endrer arbeid.'}</p>}
    <footer className="cw-footer">{onAdvanced && <button type="button" className="cw-text-button" onClick={onAdvanced}><HudIcon name="report" size={16} />Politikk og lover<HudIcon name="chevron" size={15} /></button>}{onHelp && <button type="button" className="cw-text-button" onClick={() => onHelp('supplies')}><HudIcon name="book" size={16} />Mat, vann og arbeid</button>}</footer>
  </section>;
}

export default CommunityWork;
