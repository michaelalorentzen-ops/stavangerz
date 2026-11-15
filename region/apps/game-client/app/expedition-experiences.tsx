'use client';

import { useState } from 'react';
import type { ExpeditionExperience, ExperienceKind, RegionReport } from '../../../packages/gameplay/src/region/types';
import { HudIcon, type HudIconName } from './hud-icons';
import { environmentArt } from './story-art';
import './expedition-experiences.css';

const ICONS: Record<ExperienceKind, HudIconName> = { scout: 'scout', search: 'search', combat: 'clear', gear: 'gear', claim: 'claim', perimeter: 'shield', poi: 'compass', hq: 'hq' };
const LABELS: Record<ExperienceKind, string> = { scout: 'Speiding', search: 'Forsyningssøk', combat: 'Kamp', gear: 'Utstyr', claim: 'Et eget område', perimeter: 'Varig forsvar', poi: 'Et sted å undersøke', hq: 'Et fast tilhold' };
const PORTRAITS = new Set(['ingrid', 'marius', 'leila', 'tor']);

/** Read the saved, public report only. Neither today's world nor private observations are consulted. */
export function reportExperiences(report: RegionReport): ExpeditionExperience[] {
  const seen = new Set<string>();
  return report.lines.flatMap(line => {
    const experience = line.experience;
    if (!experience || seen.has(experience.id)) return [];
    seen.add(experience.id); return [experience];
  });
}

/** One compact scene at a time, in the existing report rather than another modal. */
export function ExpeditionExperiences({ report, onZone, onHelp }: {
  report: RegionReport; onZone: (zoneId: string) => void; onHelp?: (topic: string) => void;
}) {
  return <ExpeditionExperienceCards key={report.day} experiences={reportExperiences(report)} onZone={onZone} onHelp={onHelp}/>;
}

/** Also reusable by the ZA book with the engine's retained public snapshots. */
export function ExpeditionExperienceCards({ experiences, onZone, onHelp }: {
  experiences: readonly ExpeditionExperience[]; onZone: (zoneId: string) => void; onHelp?: (topic: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, experiences.length - 1));
  const experience = experiences[current];
  if (!experience) return null;
  const image = environmentArt(experience.illustration);
  const voice = experience.voice;
  return <section className="exp-experiences" aria-label="Opplevelser fra toktet">
    <article className={`exp-card exp-${experience.kind}`} data-experience-id={experience.id}>
      <div className="exp-scene" aria-hidden="true">{image && <img src={image} alt=""/>}<span><HudIcon name={ICONS[experience.kind]} size={24}/>{LABELS[experience.kind]}</span></div>
      <div className="exp-copy">
        <p className="exp-record">{experience.record === 'first' ? 'DET FØRSTE STEGET' : 'FRA FELTJOURNALEN'} <span>· dag {experience.day}</span></p>
        <h3>{experience.title}</h3>
        <p className="exp-story">{experience.text}</p>
        <p className="exp-result"><HudIcon name="report" size={17}/><span>{experience.result}</span></p>
        {voice && <blockquote className="exp-voice">{PORTRAITS.has(voice.personId) ? <img src={`/art/crew/${voice.personId}.webp`} alt=""/> : <HudIcon name="crew" size={30}/>}<div><p>«{voice.text}»</p><cite>{voice.name}</cite></div></blockquote>}
        <p className="exp-participants"><HudIcon name="crew" size={15}/>{experience.participants.map(person => person.name).join(' · ')}</p>
      </div>
      <div className="exp-actions"><button type="button" onClick={() => onZone(experience.zoneId)}><HudIcon name="location" size={17}/><span>{experience.zoneName}</span></button>{onHelp && <button type="button" className="exp-help" aria-label={`Håndbok om ${LABELS[experience.kind].toLocaleLowerCase('nb-NO')}`} onClick={() => onHelp(experience.helpTopic)}><HudIcon name="book" size={20}/><span>Håndbok</span></button>}</div>
    </article>
    {experiences.length > 1 && <nav className="exp-pagination" aria-label="Bla i opplevelsene"><button type="button" aria-label="Forrige opplevelse" disabled={current === 0} onClick={() => setIndex(current - 1)}><HudIcon name="back"/></button><span>{current + 1} / {experiences.length} opplevelser</span><button type="button" aria-label="Neste opplevelse" disabled={current === experiences.length - 1} onClick={() => setIndex(current + 1)}><HudIcon name="arrow"/></button></nav>}
  </section>;
}
