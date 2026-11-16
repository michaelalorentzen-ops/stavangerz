'use client';

import { Pause, Play, SkipForward, MapPin, UserRound, Radio, Flag } from 'lucide-react';
import type { ReportLine } from '../../../packages/gameplay/src/region/types';
import type { ExpeditionReplayScene } from './expedition-replay';
import './expedition-replay.css';

export interface ExpeditionReplaySceneCardProps {
  scene: ExpeditionReplayScene;
  position?: number;
  total?: number;
  paused: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
}
const PORTRAITS = new Set(['ingrid', 'marius', 'leila', 'tor']);
const PHASE = { departure: 'Dagens rute', operations: 'Fra oppdragene', night: 'Gjennom natten', 'new-day': 'Ved daggry' };

/** No timer, state mutation, outcome calculation or extra scene-advance click.
 * Parent owns the reached stage, duration, keyboard control and mandatory choices.
 * One card replaces the previous card; the map remains visible behind it. */
export function ExpeditionReplaySceneCard({ scene, position, total, paused, onTogglePause, onSkip }: ExpeditionReplaySceneCardProps) {
  return <section className={`exp-replay-scene exp-replay-${scene.tone}`} aria-label="Øyeblikk fra ekspedisjonen" data-scene-id={scene.id}>
    <div className="exp-replay-heading">
      {scene.image && <img className="exp-replay-art" src={scene.image} alt="" />}
      <div className="exp-replay-heading-copy">
        <div className="exp-replay-kicker">{scene.milestone ? <><Flag size={13} aria-hidden="true" /> Milepæl</> : PHASE[scene.phase]}{scene.first && !scene.milestone && scene.kind !== 'departure' && <span>Et første minne</span>}</div>
        <h2>{scene.title}</h2>
        {scene.zoneName && <p className="exp-replay-location"><MapPin size={13} aria-hidden="true" />{scene.zoneName}</p>}
      </div>
    </div>
    <div className="exp-replay-content" role="status" aria-live="polite" aria-atomic="true">
      {scene.voice ? <blockquote><Radio size={14} aria-hidden="true" /><div><strong>{scene.voice.name}</strong><p>«{scene.voice.text}»</p></div></blockquote>
        : scene.text && <p className="exp-replay-narrative">{scene.text}</p>}
      {scene.result && <p className="exp-replay-result">{scene.result}</p>}
    </div>
    {scene.participants.length > 0 && <div className="exp-replay-crew" aria-label="Rapportens deltakere">{scene.participants.map(person => {
      const portrait = person.name.toLocaleLowerCase('nb-NO');
      return <span key={person.id} title={`${person.name} · ${person.role}`}>
        {PORTRAITS.has(portrait) ? <img src={`/art/crew/${portrait}.webp`} alt="" /> : <UserRound size={16} aria-hidden="true" />}
        <span>{person.name}</span>
      </span>;
    })}</div>}
    <footer className="exp-replay-controls">
      <span className="exp-replay-progress">{position !== undefined && total !== undefined ? `${position + 1} / ${total}` : PHASE[scene.phase]}</span>
      <button type="button" onClick={onTogglePause} aria-label={paused ? 'Fortsett avspillingen' : 'Sett avspillingen på pause'} aria-pressed={paused}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />} {paused ? 'Fortsett' : 'Pause'}
      </button>
      <button type="button" data-testid="skip-replay" onClick={onSkip}><SkipForward size={16} aria-hidden="true" /> Hopp over</button>
    </footer>
  </section>;
}

/** Optional routine strip. The exact authoritative text remains in the report;
 * the strip identifies at most two already-public results without extra clicks. */
export function ExpeditionReplayCompact({ lines }: { lines: readonly ReportLine[] }) {
  if (!lines.length) return null;
  return <div className="exp-replay-compact" role="status" aria-label="Kort fra oppdragene">{lines.slice(0, 2).map((line, index) =>
    <p key={`${index}:${line.title}`} className={`exp-replay-${line.tone}`}><span aria-hidden="true">{line.tone === 'bad' || line.tone === 'warn' ? '!' : '·'}</span>{line.title}</p>)}</div>;
}
