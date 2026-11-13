'use client';

import { useCallback, useEffect, useRef } from 'react';

export type GameAudioPreferences = { masterVolume: number; musicVolume: number; effectsVolume: number };
export type GameSound = 'order' | 'day' | 'event' | 'confirm';
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Original oscillator score: no downloads, recorded samples or campaign state. */
class CampAudio {
  private context: AudioContext;
  private music: GainNode;
  private effects: GainNode;
  private master: GainNode;
  private timer: ReturnType<typeof setInterval> | undefined;
  private bar = 0;
  private preferences: GameAudioPreferences;
  constructor(preferences: GameAudioPreferences) {
    this.preferences = preferences;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    this.music.connect(this.master); this.effects.connect(this.master); this.master.connect(this.context.destination);
    this.setPreferences(preferences);
  }
  setPreferences(preferences: GameAudioPreferences) {
    this.preferences = preferences;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(clamp(preferences.masterVolume), t, .08);
    this.music.gain.setTargetAtTime(clamp(preferences.musicVolume), t, .15);
    this.effects.gain.setTargetAtTime(clamp(preferences.effectsVolume), t, .05);
  }
  private note(frequency: number, at: number, duration: number, gain: number, bus: GainNode, type: OscillatorType = 'sine') {
    const tone = this.context.createOscillator(), envelope = this.context.createGain();
    tone.type = type; tone.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + Math.min(.3, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    tone.connect(envelope); envelope.connect(bus); tone.start(at); tone.stop(at + duration + .02);
    tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
  }
  private score = () => {
    if (this.context.state !== 'running' || this.preferences.musicVolume === 0 || this.preferences.masterVolume === 0) return;
    const t = this.context.currentTime + .05;
    // Sparse A minor / F / C / G voicings, with ample silence between phrases.
    const chords = [[110, 164.81, 261.63], [87.31, 130.81, 220], [130.81, 196, 329.63], [98, 146.83, 246.94]];
    const chord = chords[this.bar++ % chords.length];
    chord.forEach((frequency, i) => this.note(frequency, t + i * .45, 6.8, .025, this.music));
    this.note(chord[2] * 2, t + 3, 2.6, .014, this.music);
  };
  async resume() {
    if (this.context.state === 'closed') return;
    await this.context.resume();
    if (!this.timer) { this.score(); this.timer = setInterval(this.score, 10000); }
  }
  suspend() { if (this.context.state === 'running') void this.context.suspend().catch(() => {}); }
  play(sound: GameSound) {
    if (this.context.state !== 'running' || this.preferences.effectsVolume === 0 || this.preferences.masterVolume === 0) return;
    const t = this.context.currentTime + .01;
    const phrase: Record<GameSound, number[]> = { order: [330, 440], confirm: [440, 554.37], day: [220, 261.63, 329.63], event: [293.66, 220] };
    phrase[sound].forEach((frequency, i) => this.note(frequency, t + i * .12, sound === 'event' ? .6 : .35, .07, this.effects));
  }
  dispose() { clearInterval(this.timer); this.timer = undefined; void this.context.close().catch(() => {}); }
}

/** Call play only for accepted UI actions, never during render or save restoration. */
export function useGameAudio(preferences: GameAudioPreferences) {
  const engine = useRef<CampAudio | null>(null), latest = useRef(preferences);
  useEffect(() => { latest.current = preferences; engine.current?.setPreferences(preferences); }, [preferences]);
  useEffect(() => {
    let disposed = false;
    const unlock = (event: Event) => {
      if (!event.isTrusted || disposed || typeof AudioContext === 'undefined') return;
      if (!engine.current) { try { engine.current = new CampAudio(latest.current); } catch { return; } }
      if (document.visibilityState === 'visible') void engine.current.resume().catch(() => {});
    };
    const visibility = () => { if (document.hidden) engine.current?.suspend(); else if (engine.current) void engine.current.resume().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility); engine.current?.dispose(); engine.current = null;
    };
  }, []);
  return useCallback((sound: GameSound) => { engine.current?.play(sound); }, []);
}
