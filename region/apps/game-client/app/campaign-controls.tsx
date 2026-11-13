'use client';

import { useId } from 'react';
import {
  DIFFICULTIES, campaignFor, campaignHints,
  type CampaignOptions,
} from '../../../packages/gameplay/src/region/campaign';
import type { RegionState } from '../../../packages/gameplay/src/region/types';
import './campaign-controls.css';

export default function CampaignControls({ value, onChange }: { value: CampaignOptions; onChange: (value: CampaignOptions) => void }) {
  const id = useId();
  return <section className="cmp-controls" aria-label="Vanskelighetsgrad og Hardcore">
    <fieldset><legend>Velg spillestil</legend>
      <div className="cmp-modes">{DIFFICULTIES.map(mode => <label key={mode.id} className={`cmp-mode ${(value.difficulty ?? 'survival') === mode.id ? 'selected' : ''}`}>
        <input type="radio" name={`${id}-difficulty`} checked={(value.difficulty ?? 'survival') === mode.id}
          onChange={() => onChange({ ...value, difficulty: mode.id })} />
        <span><strong>{mode.name}{mode.id === 'survival' && <small>Standard</small>}</strong><span>{mode.description}</span></span>
      </label>)}</div>
    </fieldset>
    <label className={`cmp-hardcore ${value.hardcore ? 'selected' : ''}`}>
      <input type="checkbox" checked={value.hardcore ?? false} onChange={event => onChange({ ...value, hardcore: event.target.checked })} />
      <span><strong>Hardcore</strong><span>Hovedpersonens død avslutter gjennomspillingen. Du fortsetter fra siste lagrede kontrollpunkt og kan ikke gå tilbake til tidligere valg.</span></span>
    </label>
    <p className="cmp-note">Hardcore kan kombineres med alle tre spillestiler. Uten Hardcore kan du velge en etterfølger dersom hovedpersonen dør.</p>
  </section>;
}

export function CampaignModeInfo({ state }: { state: RegionState }) {
  const campaign = campaignFor(state);
  const mode = DIFFICULTIES.find(candidate => candidate.id === campaign.difficulty)!;
  return <section className="cmp-info" aria-label="Gjennomspillingens regler">
    <p className="cmp-kicker">DENNE GJENNOMSPILLINGEN</p>
    <h3>{mode.name}{campaign.hardcore && <span>Hardcore</span>}</h3>
    <p>{mode.description}</p>
    <p>{campaign.hardcore ? 'Valgt hovedperson kan ikke erstattes. Død er permanent, og tidligere valg kan ikke gjenopprettes i spillet.' : 'Samfunnet kan fortsette etter hovedpersonens død. Du velger aktivt hvem som fører historien videre.'}</p>
  </section>;
}

export function CampaignHelp({ state }: { state: RegionState }) {
  const hints = campaignHints(state);
  return hints.length ? <aside className="cmp-hints" aria-label="Råd for Story"><p className="cmp-kicker">RÅD FOR STORY</p>{hints.map(hint => <p key={hint}>{hint}</p>)}</aside> : null;
}

export function CampaignEndingView({ state }: { state: RegionState }) {
  const ending = state.campaign?.ending;
  if (!ending) return null;
  return <article className="cmp-ending">
    <p className="cmp-kicker">DAG {ending.day} · HISTORIEN DERES</p>
    <h2>{ending.title}</h2><p className="cmp-ending-lead">{ending.summary}</p>
    <div className="cmp-ending-facts"><span><b>{ending.facts.population}</b>Mennesker</span><span><b>{ending.facts.controlledZones}</b>Lokale soner</span><span><b>{ending.facts.researchCompleted}</b>Forskningsprosjekter</span></div>
    {ending.epilogue.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
    {(ending.facts.decisions.length > 0 || ending.facts.research.length > 0) && <details><summary>Sporene dere etterlater</summary>
      {ending.facts.research.length > 0 && <section><h3>Kunnskapen</h3><p>{ending.facts.research.join(' · ')}</p></section>}
      {ending.facts.decisions.length > 0 && <section><h3>Krøniken</h3><ol>{ending.facts.decisions.map((entry, i) => <li key={i}><small>Dag {entry.day}</small>{entry.text}</li>)}</ol></section>}
    </details>}
  </article>;
}
