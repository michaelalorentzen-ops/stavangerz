'use client';

import { useCallback, useEffect, useRef } from 'react';

export type GameAudioPreferences = { masterVolume: number; musicVolume: number; effectsVolume: number };
/** Result cues require a real observed outcome; the score itself never reads world state. */
export type GameSound = 'order' | 'day' | 'event' | 'confirm' | 'combat' | 'night' | 'discovery' | 'claim';
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };

/** Original procedural soundscape. No recorded samples, remote assets or gameplay RNG. */
class CampAudio {
  private context: AudioContext;
  private music: GainNode;
  private effects: GainNode;
  private master: GainNode;
  private limiter: DynamicsCompressorNode;
  private delay: DelayNode;
  private echo: GainNode;
  private feedback: GainNode;
  private echoFilter: BiquadFilterNode;
  private noise: AudioBuffer;
  private voices = new Set<Voice>();
  private wind: Voice | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private bar = 0;
  private preferences: GameAudioPreferences;
  private disposed = false;
  private lastCue: Partial<Record<GameSound, number>> = {};
  constructor(preferences: GameAudioPreferences) {
    this.preferences = preferences;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    this.master.gain.value = clamp(preferences.masterVolume); this.music.gain.value = clamp(preferences.musicVolume); this.effects.gain.value = clamp(preferences.effectsVolume);
    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -12; this.limiter.knee.value = 15; this.limiter.ratio.value = 4;
    this.limiter.attack.value = .008; this.limiter.release.value = .2;
    this.music.connect(this.master); this.effects.connect(this.master); this.master.connect(this.limiter); this.limiter.connect(this.context.destination);
    // One quiet, filtered music echo adds space without an expensive reverb or an audio download.
    this.delay = this.context.createDelay(1); this.delay.delayTime.value = .43;
    this.echo = this.context.createGain(); this.echo.gain.value = .14;
    this.feedback = this.context.createGain(); this.feedback.gain.value = .16;
    this.echoFilter = this.context.createBiquadFilter(); this.echoFilter.type = 'lowpass'; this.echoFilter.frequency.value = 1700;
    this.music.connect(this.delay); this.delay.connect(this.echoFilter); this.echoFilter.connect(this.echo); this.echo.connect(this.master);
    this.echoFilter.connect(this.feedback); this.feedback.connect(this.delay);
    this.noise = this.createNoise();
    this.setPreferences(preferences);
  }
  private createNoise() {
    const buffer = this.context.createBuffer(1, 24000 * 6, 24000), samples = buffer.getChannelData(0);
    // Local deterministic texture, unrelated to the simulation's seed or outcomes.
    let seed = 314159, smoothed = 0;
    for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; smoothed = .965 * smoothed + .035 * (seed / 2147483648 - 1); samples[i] = smoothed * 4; }
    return buffer;
  }
  setPreferences(preferences: GameAudioPreferences) {
    if (this.disposed) return;
    this.preferences = preferences;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(clamp(preferences.masterVolume), t, .06);
    this.music.gain.setTargetAtTime(clamp(preferences.musicVolume), t, .12);
    this.effects.gain.setTargetAtTime(clamp(preferences.effectsVolume), t, .05);
    this.syncAmbience();
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): Voice {
    const voice = { source, nodes }; this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); nodes.forEach(node => node.disconnect()); };
    return voice;
  }
  private stop(voice: Voice) { try { voice.source.stop(); } catch { /* Already ended. */ } voice.source.disconnect(); voice.nodes.forEach(node => node.disconnect()); this.voices.delete(voice); }
  private note(frequency: number, at: number, duration: number, gain: number, bus: GainNode, options: { type?: OscillatorType; detune?: number; attack?: number; pan?: number; endFrequency?: number } = {}) {
    const tone = this.context.createOscillator(), envelope = this.context.createGain(), pan = this.context.createStereoPanner();
    tone.type = options.type ?? 'sine'; tone.frequency.setValueAtTime(frequency, at); tone.detune.value = options.detune ?? 0;
    if (options.endFrequency) tone.frequency.exponentialRampToValueAtTime(options.endFrequency, at + duration);
    pan.pan.value = options.pan ?? 0;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + Math.min(options.attack ?? .012, duration / 3)); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    tone.connect(envelope); envelope.connect(pan); pan.connect(bus); this.track(tone, [envelope, pan]); tone.start(at); tone.stop(at + duration + .02);
  }
  private texture(at: number, duration: number, gain: number, frequency: number, bus: GainNode, attack = .02) {
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), envelope = this.context.createGain();
    source.buffer = this.noise; source.loop = true; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .65;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + Math.min(attack, duration / 3)); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(bus); this.track(source, [filter, envelope]); source.start(at); source.stop(at + duration + .02);
  }
  private startWind() {
    if (this.wind) return;
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), envelope = this.context.createGain();
    source.buffer = this.noise; source.loop = true; filter.type = 'bandpass'; filter.frequency.value = 640; filter.Q.value = .4;
    const t = this.context.currentTime; envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(.13, t + 2.5);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.music); this.wind = this.track(source, [filter, envelope]); source.start();
  }
  private score = () => {
    if (this.disposed || this.context.state !== 'running' || this.preferences.musicVolume <= 0 || this.preferences.masterVolume <= 0) return;
    const t = this.context.currentTime + .04;
    // Open D minor / B-flat / F / C voicings: no alarm-like pulse or implied enemies.
    const chords = [[146.83, 220, 349.23], [116.54, 174.61, 293.66], [174.61, 261.63, 440], [130.81, 196, 329.63]];
    const step = this.bar++, chord = chords[step % chords.length];
    if (this.wind) (this.wind.nodes[0] as BiquadFilterNode).frequency.setTargetAtTime(420 + (step % 4) * 140, t, 2);
    chord.forEach((frequency, i) => {
      this.note(frequency, t + i * .3, 8.5, .023, this.music, { type: 'triangle', attack: 1.8, detune: i % 2 ? 3 : -3, pan: (i - 1) * .35 });
      this.note(frequency * 1.003, t + .35 + i * .3, 7.7, .014, this.music, { attack: 2.1, pan: (1 - i) * .35 });
    });
    // A distant, brief melodic response only every other phrase leaves room for play.
    if (step % 2 === 0) [chord[2], chord[1] * 2].forEach((frequency, i) => this.note(frequency, t + 4.2 + i * .8, 2.2, .018, this.music, { attack: .08, pan: i ? -.2 : .2 }));
  };
  private syncAmbience() {
    const audible = !this.disposed && this.context.state === 'running' && this.preferences.musicVolume > 0 && this.preferences.masterVolume > 0;
    if (audible && !this.timer) { this.startWind(); this.score(); this.timer = setInterval(this.score, 12000); }
    if (!audible) { clearInterval(this.timer); this.timer = undefined; if (this.wind) { this.stop(this.wind); this.wind = undefined; } }
  }
  async resume() {
    if (this.disposed || this.context.state === 'closed') return;
    if (this.context.state !== 'running') await this.context.resume();
    if (!this.disposed) this.syncAmbience();
  }
  suspend() {
    clearInterval(this.timer); this.timer = undefined; this.wind = undefined;
    // Hidden-tab sounds are discarded, so an old combat cue cannot resume hours later.
    [...this.voices].forEach(voice => this.stop(voice));
    if (this.context.state === 'running') void this.context.suspend().catch(() => {});
  }
  play(sound: GameSound) {
    if (this.disposed || this.context.state !== 'running' || this.preferences.effectsVolume <= 0 || this.preferences.masterVolume <= 0) return;
    const now = this.context.currentTime;
    // UI double-clicks must not stack the same notification into a loud burst.
    if (now - (this.lastCue[sound] ?? -Infinity) < .12) return;
    this.lastCue[sound] = now; const t = now + .012;
    const bell = (frequency: number, at: number, gain = .075, duration = .8) => { this.note(frequency, at, duration, gain, this.effects); this.note(frequency * 2.01, at, duration * .42, gain * .16, this.effects); };
    if (sound === 'order' || sound === 'confirm') {
      this.texture(t, .09, .065, 1100, this.effects); this.note(sound === 'order' ? 392 : 493.88, t + .025, .25, .055, this.effects, { type: 'triangle' }); return;
    }
    if (sound === 'combat') {
      // Short material impacts rather than gunfire: combat may have used melee equipment.
      [0, .18].forEach((offset, i) => { this.texture(t + offset, .19, .24, 500 + i * 350, this.effects); this.note(155 - i * 15, t + offset, .21, .1, this.effects, { type: 'triangle', endFrequency: 70 }); }); return;
    }
    if (sound === 'night') {
      this.texture(t, 2.8, .085, 480, this.effects, .8); this.note(220, t + .08, 2.3, .045, this.effects, { attack: .6, pan: -.2 }); this.note(293.66, t + .4, 2.1, .032, this.effects, { attack: .6, pan: .2 }); return;
    }
    if (sound === 'discovery') { [523.25, 659.25, 783.99].forEach((frequency, i) => bell(frequency, t + i * .17, .06, 1.15)); this.texture(t, .8, .035, 1800, this.effects, .2); return; }
    if (sound === 'claim') { [293.66, 440, 587.33, 698.46].forEach((frequency, i) => bell(frequency, t + i * .16, .06, 1.4)); this.texture(t, 1.1, .06, 1000, this.effects, .3); return; }
    if (sound === 'event') { this.texture(t, .12, .1, 800, this.effects); bell(392, t + .035, .055, .8); bell(523.25, t + .19, .04, .75); return; }
    // Day result: a warm, restrained resolution. Other cues are chosen by actual outcome.
    [261.63, 329.63, 392].forEach((frequency, i) => this.note(frequency, t + i * .11, 1.2, .055, this.effects, { type: 'triangle', attack: .08, pan: (i - 1) * .25 }));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.suspend();
    [this.music, this.effects, this.master, this.limiter, this.delay, this.echo, this.feedback, this.echoFilter].forEach(node => node.disconnect());
    void this.context.close().catch(() => {});
  }
}

/** Call play only for accepted actions / actual observed results, never during render or save restoration. */
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
