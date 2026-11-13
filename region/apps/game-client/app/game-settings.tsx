'use client';

import { useEffect, useState } from 'react';
import { Volume2, Music2, Radio, Keyboard, Eye, RotateCcw, Type } from 'lucide-react';
import type { GameAudioPreferences } from './game-audio';
import './game-settings.css';

export type GamePreferences = GameAudioPreferences & { reducedMotion: boolean; keyboardShortcuts: boolean; textScale: 'normal' | 'large' };
export const GAME_PREFERENCES_KEY = 'stavanger-z.preferences.v1';
export const DEFAULT_GAME_PREFERENCES: GamePreferences = { masterVolume: .55, musicVolume: .25, effectsVolume: .6, reducedMotion: false, keyboardShortcuts: true, textScale: 'normal' };
const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
export function parseGamePreferences(value: unknown, fallback = DEFAULT_GAME_PREFERENCES): GamePreferences {
  const v = value && typeof value === 'object' ? value as Partial<GamePreferences> : {};
  return { masterVolume: volume(v.masterVolume, fallback.masterVolume), musicVolume: volume(v.musicVolume, fallback.musicVolume), effectsVolume: volume(v.effectsVolume, fallback.effectsVolume), reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : fallback.reducedMotion, textScale: v.textScale === 'large' ? 'large' : v.textScale === 'normal' ? 'normal' : fallback.textScale, keyboardShortcuts: typeof v.keyboardShortcuts === 'boolean' ? v.keyboardShortcuts : fallback.keyboardShortcuts };
}

/** Preferences are local to this browser and separate from every campaign save. */
export function useGamePreferences() {
  const [preferences, setPreferences] = useState<GamePreferences>(DEFAULT_GAME_PREFERENCES), [ready, setReady] = useState(false);
  useEffect(() => {
    const initial = { ...DEFAULT_GAME_PREFERENCES, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
    try { setPreferences(parseGamePreferences(JSON.parse(localStorage.getItem(GAME_PREFERENCES_KEY) ?? 'null'), initial)); } catch { setPreferences(initial); }
    setReady(true);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed=(event:MediaQueryListEvent)=>setPreferences(previous=>({...previous,reducedMotion:event.matches}));
    media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Private browsing may disallow storage. */ } }, [preferences, ready]);
  function updatePreferences(patch: Partial<GamePreferences>) { setPreferences(previous => parseGamePreferences({ ...previous, ...patch }, previous)); }
  return { preferences, updatePreferences, ready };
}

export function GameSettings({ value, onChange, onTestSound }: { value: GamePreferences; onChange: (patch: Partial<GamePreferences>) => void; onTestSound?: () => void }) {
  return <section className="game-settings" aria-label="Spillinnstillinger">
    <div className="gs-heading"><div><p>STAVANGER Z</p><h2>Innstillinger</h2></div><Volume2 aria-hidden="true" /></div>
    <fieldset><legend>Lyd</legend>{([
      ['masterVolume', 'Hovedvolum', Volume2], ['musicVolume', 'Musikk', Music2], ['effectsVolume', 'Lydeffekter', Radio],
    ] as const).map(([key, label, Icon]) => <label className="gs-volume" key={key}><span><Icon aria-hidden="true" />{label}</span><input type="range" min="0" max="100" step="1" aria-label={label} value={Math.round(value[key] * 100)} onChange={event => onChange({ [key]: Number(event.target.value) / 100 })} /><output>{Math.round(value[key] * 100)} %</output></label>)}<div className="gs-audio-note"><small>Lyd starter etter første klikk og pauses når fanen er skjult.</small>{onTestSound && <button type="button" onClick={onTestSound}>Prøv lyd</button>}</div></fieldset>
    <fieldset><legend>Visning og kontroll</legend><label className="gs-text-size"><Type aria-hidden="true" /><span>Tekststørrelse</span><select aria-label="Tekststørrelse" value={value.textScale} onChange={event=>onChange({textScale:event.target.value as GamePreferences['textScale']})}><option value="normal">Standard</option><option value="large">Større</option></select></label><label className="gs-toggle"><Eye aria-hidden="true" /><span>Redusert bevegelse<small>Roligere overganger og døgnavspilling.</small></span><input type="checkbox" checked={value.reducedMotion} onChange={event => onChange({ reducedMotion: event.target.checked })} /></label><label className="gs-toggle"><Keyboard aria-hidden="true" /><span>Hurtigtaster<small>Mellomrom · døgnslutt, C · mannskap, B · boka, P · plan, H · HQ, Home · leiren, I · innstillinger. Escape lukker.</small></span><input type="checkbox" checked={value.keyboardShortcuts} onChange={event => onChange({ keyboardShortcuts: event.target.checked })} /></label></fieldset>
    <footer><small>Lagres i denne nettleseren.</small><button type="button" onClick={() => onChange({ ...DEFAULT_GAME_PREFERENCES, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches })}><RotateCcw aria-hidden="true" />Tilbakestill</button></footer>
  </section>;
}
