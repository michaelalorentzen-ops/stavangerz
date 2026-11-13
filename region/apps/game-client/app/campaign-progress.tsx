import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region';
import { campaignAchievements, campaignProgress } from './campaign-progress-model';
import { HudIcon } from './hud-icons';
import './campaign-progress.css';

type Props = { state: RegionState; world: RegionWorld };

/** Place once in the existing progress view; no notification or new overlay. */
export function CampaignProgress({ state, world }: Props) {
  const progress = campaignProgress(state, world);
  return <section className="cp-progress" aria-label="Veien videre">
    <header><HudIcon name="goals" size={23}/><div><small>FASE {progress.phase.id} · {progress.phase.name}</small><h3>{progress.next ? `Mot ${progress.next.name.toLocaleLowerCase('nb-NO')}` : 'Tre veier til seier'}</h3></div><b>{progress.completed}/{progress.goals.length}</b></header>
    {!state.gameOver && <p className="cp-next"><HudIcon name="arrow"/>{progress.nextAction}</p>}
    {progress.next && <p className="cp-unlocks">Neste kapittel: {progress.next.unlocks.join(' · ') || progress.next.name}</p>}
    <details open={state.phase >= 5}><summary>Veier til seier{state.phase < 5 ? ' · avgjøres fra fase 5' : ''}</summary>
      <div className="cp-routes">
        <article><HudIcon name="research"/><div><h4>Vaksineforsøket <span>{progress.cure.done ? 'Fullført' : progress.cure.current ? 'Pågår' : 'Gjenstår'}</span></h4><p>{progress.cure.done ? 'Forskningsprosjektet er fullført.' : progress.cure.current ? `${Math.floor(progress.cure.progress)} forskningspoeng samlet. Fortsett forskningen i HQ.` : progress.cure.missingResearch.length ? `Forsk først: ${progress.cure.missingResearch.join(' og ')}.` : progress.cure.blocked ?? 'Start Vaksineforsøket i forskning. Ressurskostnaden vises der.'}</p></div></article>
        <article><HudIcon name="crew"/><div><h4>Samlet region <span>{progress.alliance.allies}/{progress.alliance.total}</span></h4><p>Alle gjenværende grupper: forhold minst 60 og ingen fiendtlighet.</p>{progress.alliance.missing.length > 0 && <p className="cp-missing">{progress.alliance.missing.map(faction => faction.known ? `${faction.name} ${Math.round(faction.relation)}/60${faction.hostile ? ' · fiendtlig' : ''}` : 'Ukjent gruppe · etabler kontakt').join(' / ')}</p>}</div></article>
        <article><HudIcon name="farm"/><div><h4>Et samfunn som varer <span>{progress.stable.days}/30 døgn</span></h4><p>30 sammenhengende døgn i fase 5: faktisk matbalanse ≥ 0, håp ≥ 50, uro &lt; 50 og levende mannskap. Brudd nullstiller rekken.</p><p className="cp-missing">Håp {Math.round(state.morale)}/50 · uro {Math.round(state.discontent)}/50. Mat vurderes etter døgnets produksjon, forbruk, svinn og drift; lager og prognose teller ikke som bekreftede døgn.</p></div></article>
      </div>
    </details>
  </section>;
}

/** A compact factual chapter retrospective, usable at a phase change or the ending. */
export function CampaignAchievements({ state }: { state: RegionState }) {
  const facts = campaignAchievements(state);
  return <section className="cp-achievements" aria-label="Det dere har oppnådd">
    <h3>{state.gameOver ? 'Historien dere bygde' : 'Så langt i historien'}</h3>
    <div className="cp-facts"><span><HudIcon name="sun"/><b>{facts.days}</b>døgn</span><span><HudIcon name="goals"/><b>{facts.phase.id}</b>fase</span><span><HudIcon name="map"/><b>{facts.zones}</b>soner</span><span><HudIcon name="research"/><b>{facts.research}</b>prosjekter</span></div>
    {facts.milestones.length > 0 && <ul className="cp-badges">{facts.milestones.map(milestone => <li key={milestone.id} title={milestone.text}><HudIcon name="check" size={14}/>{milestone.title}</li>)}</ul>}
    {facts.chapters.length > 0 && <p className="cp-chapters">{facts.chapters.map(chapter => `Dag ${chapter.day}: ${chapter.text.replace(/\.$/, '')}`).join(' · ')}</p>}
  </section>;
}
