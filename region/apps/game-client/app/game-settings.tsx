'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SHORTCUT_BINDINGS, SHORTCUT_ACTIONS, SHORTCUT_LABELS, displayShortcut, isShortcutCode, normalizeShortcutBindings, type ShortcutAction, type ShortcutBindings } from './shortcut-bindings';
import { Volume2, Music2, Radio, Keyboard, Eye, RotateCcw, Type } from 'lucide-react';
import type { GameAudioPreferences } from './game-audio';
import './game-settings.css';

export type GamePreferences = GameAudioPreferences & { reducedMotion: boolean; keyboardShortcuts: boolean; textScale: 'normal' | 'large'; shortcutBindings: ShortcutBindings };
export const GAME_PREFERENCES_KEY = 'stavanger-z.preferences.v1';
export const DEFAULT_GAME_PREFERENCES: GamePreferences = { masterVolume: .55, musicVolume: .25, effectsVolume: .6, reducedMotion: false, keyboardShortcuts: true, textScale: 'normal', shortcutBindings: { ...DEFAULT_SHORTCUT_BINDINGS } };
const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
export function parseGamePreferences(value: unknown, fallback = DEFAULT_GAME_PREFERENCES): GamePreferences {
  const v = value && typeof value === 'object' ? value as Partial<GamePreferences> : {};
  return { masterVolume: volume(v.masterVolume, fallback.masterVolume), musicVolume: volume(v.musicVolume, fallback.musicVolume), effectsVolume: volume(v.effectsVolume, fallback.effectsVolume), reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : fallback.reducedMotion, textScale: v.textScale === 'large' ? 'large' : v.textScale === 'normal' ? 'normal' : fallback.textScale, shortcutBindings: normalizeShortcutBindings(v.shortcutBindings, fallback.shortcutBindings), keyboardShortcuts: typeof v.keyboardShortcuts === 'boolean' ? v.keyboardShortcuts : fallback.keyboardShortcuts };
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

export function GameSettings({ value, onChange, onTestSound, performancePanel }: { value: GamePreferences; onChange: (patch: Partial<GamePreferences>) => void; onTestSound?: () => void; performancePanel?: ReactNode }) {
 const [tab, setTab] = useState('Lyd');
 const [capture, setCapture] = useState<ShortcutAction | null>(null);
 const [message, setMessage] = useState('');
 const tabs = ['Lyd', 'Visning', 'Kontroller', ...(performancePanel ? ['Ytelse'] : [])];
 return <section className="game-settings" aria-label="Spillinnstillinger">
  <div className="gs-heading"><div><p>STAVANGER Z</p><h2>Innstillinger</h2></div><Volume2 aria-hidden="true" /></div>
  <div className="gs-tabs" role="tablist" aria-label="Innstillingskategorier">{tabs.map(name => <button type="button" role="tab" key={name} id={`gs-tab-${name}`} aria-controls="gs-panel" aria-selected={tab === name} onClick={() => { setTab(name); setCapture(null); setMessage(''); }}>{name}</button>)}</div>
  <div id="gs-panel" role="tabpanel" aria-labelledby={`gs-tab-${tab}`}>
  {tab === 'Lyd' && <fieldset><legend>Lyd</legend>{([
   ['masterVolume', 'Hovedvolum', Volume2], ['musicVolume', 'Musikk', Music2], ['effectsVolume', 'Lydeffekter', Radio],
  ] as const).map(([key, label, Icon]) => <label className="gs-volume" key={key}><span><Icon aria-hidden="true" />{label}</span><input type="range" min="0" max="100" step="1" aria-label={label} value={Math.round(value[key] * 100)} onChange={event => onChange({ [key]: Number(event.target.value) / 100 })} /><output>{Math.round(value[key] * 100)} %</output></label>)}<div className="gs-audio-note"><small>Lyd starter etter første klikk og pauses når fanen er skjult.</small>{onTestSound && <button type="button" onClick={onTestSound}>Prøv lyd</button>}</div></fieldset>}
  {tab === 'Visning' && <fieldset><legend>Visning</legend><label className="gs-text-size"><Type aria-hidden="true" /><span>Tekststørrelse</span><select aria-label="Tekststørrelse" value={value.textScale} onChange={event=>onChange({textScale:event.target.value as GamePreferences['textScale']})}><option value="normal">Standard</option><option value="large">Større</option></select></label><label className="gs-toggle"><Eye aria-hidden="true" /><span>Redusert bevegelse<small>Roligere overganger og døgnavspilling.</small></span><input type="checkbox" checked={value.reducedMotion} onChange={event => onChange({ reducedMotion: event.target.checked })} /></label></fieldset>}
  {tab === 'Kontroller' && <fieldset className="gs-controls"><legend>Kontroller</legend>
   <label className="gs-toggle"><Keyboard aria-hidden="true" /><span>Hurtigtaster</span><input type="checkbox" checked={value.keyboardShortcuts} onChange={event => { setCapture(null); onChange({ keyboardShortcuts: event.target.checked }); }} /></label>
   <div className="gs-bindings">{SHORTCUT_ACTIONS.map(action => <div className="gs-binding" key={action}><span>{SHORTCUT_LABELS[action]}</span><button type="button" aria-label={`Endre tast for ${SHORTCUT_LABELS[action]}`} aria-pressed={capture === action}
    onClick={() => { setCapture(action); setMessage('Trykk en bokstav, et tall, Mellomrom, Home eller End.'); }}
    onBlur={() => { if (capture === action) { setCapture(null); setMessage(''); } }}
    onKeyDown={event => {
     if (capture !== action) return;
     event.stopPropagation();
     if (event.key === 'Tab') { setCapture(null); setMessage('Tastvalg avbrutt.'); return; }
     event.preventDefault();
     if (event.key === 'Escape') { setCapture(null); setMessage('Tastvalg avbrutt.'); return; }
     if (event.repeat) return;
     if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !isShortcutCode(event.code)) { setMessage('Denne tasten er reservert. Velg en bokstav, et tall, Mellomrom, Home eller End.'); return; }
     const conflict = SHORTCUT_ACTIONS.find(other => other !== action && value.shortcutBindings[other] === event.code);
     if (conflict) { setMessage(`${displayShortcut(event.code)} brukes av ${SHORTCUT_LABELS[conflict]}. Velg en annen tast.`); return; }
     onChange({ shortcutBindings: { ...value.shortcutBindings, [action]: event.code } }); setCapture(null); setMessage(`${SHORTCUT_LABELS[action]}: ${displayShortcut(event.code)}.`);
    }} onKeyUp={event => event.stopPropagation()}><kbd>{capture === action ? 'Trykk tast…' : displayShortcut(value.shortcutBindings[action])}</kbd></button></div>)}</div>
   <p className="gs-key-message" role="status">{message || 'Trykk en tast for å endre. Escape lukker vinduer og avbryter tastvalg.'}</p>
   <button type="button" onClick={() => { onChange({ shortcutBindings: { ...DEFAULT_SHORTCUT_BINDINGS } }); setCapture(null); setMessage('Standardtaster gjenopprettet.'); }}><RotateCcw aria-hidden="true" />Standardtaster</button>
  </fieldset>}
  {tab === 'Ytelse' && performancePanel}
  </div>
  <footer><small>Lagres i denne nettleseren.</small><button type="button" onClick={() => { onChange({ ...DEFAULT_GAME_PREFERENCES, shortcutBindings: { ...DEFAULT_SHORTCUT_BINDINGS }, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches }); setCapture(null); setMessage('Innstillinger tilbakestilt.'); }}><RotateCcw aria-hidden="true" />Tilbakestill alt</button></footer>
 </section>;
}
