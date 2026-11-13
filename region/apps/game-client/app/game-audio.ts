'use client';

import { useCallback, useEffect, useRef } from 'react';

export type GameAudioPreferences = { masterVolume: number; musicVolume: number; effectsVolume: number };
/** Result cues require a real observed outcome; the score itself never reads world state. */
export type GameSound = 'order' | 'day' | 'event' | 'confirm' | 'combat' | 'night' | 'discovery' | 'claim' | 'victory' | 'defeat';
export type GameAmbience = 'camp' | 'harbor' | 'night';
type SampleName = GameSound | `ambient-${GameAmbience}`;
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };

/** Local CC0 Foley arrangements + original accompaniment. See public/audio/README.md. */
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
  private samples = new Map<SampleName, Promise<AudioBuffer | undefined>>();
  private requests = new AbortController();
  private ambience: GameAmbience;
  private epoch = 0;
  private ambientVersion = 0;
  private voices = new Set<Voice>();
  private wind: Voice | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private bar = 0;
  private preferences: GameAudioPreferences;
  private disposed = false;
  private lastCue: Partial<Record<GameSound, number>> = {};
  constructor(preferences: GameAudioPreferences, ambience: GameAmbience) {
    this.preferences = preferences; this.ambience = ambience;
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
    this.setPreferences(preferences);
  }
  private load(name: SampleName): Promise<AudioBuffer | undefined> {
    let pending = this.samples.get(name);
    if (!pending) {
      pending = fetch(`/audio/${name}.mp3`, { cache: 'force-cache', signal: this.requests.signal })
        .then(response => { if (!response.ok) throw new Error('Unavailable local audio'); return response.arrayBuffer(); })
        .then(bytes => this.disposed ? undefined : this.context.decodeAudioData(bytes))
        .catch(() => undefined);
      this.samples.set(name, pending);
    }
    return pending;
  }
  setAmbience(ambience: GameAmbience) {
    if (this.disposed || this.ambience === ambience) return;
    this.ambience = ambience; this.ambientVersion++;
    if (this.wind) {
      const envelope = this.wind.nodes[0] as GainNode, t = this.context.currentTime;
      envelope.gain.cancelScheduledValues(t); envelope.gain.setValueAtTime(envelope.gain.value, t); envelope.gain.linearRampToValueAtTime(0, t + .6);
      this.wind.source.stop(t + .65); this.wind = undefined;
    }
    this.syncAmbience();
  }
  setPreferences(preferences: GameAudioPreferences) {
    if (this.disposed) return;
    if ((preferences.masterVolume <= 0 && this.preferences.masterVolume > 0) || (preferences.effectsVolume <= 0 && this.preferences.effectsVolume > 0)) this.epoch++;
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
  private startWind() {
    if (this.wind) return;
    const version = this.ambientVersion, epoch = this.epoch, name = this.ambience;
    void this.load(`ambient-${name}`).then(buffer => {
      if (!buffer || this.disposed || this.wind || version !== this.ambientVersion || epoch !== this.epoch || this.context.state !== 'running' || this.preferences.musicVolume <= 0 || this.preferences.masterVolume <= 0) return;
      const source = this.context.createBufferSource(), envelope = this.context.createGain();
      source.buffer = buffer; source.loop = true;
      const t = this.context.currentTime; envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(.65, t + 1.6);
      source.connect(envelope); envelope.connect(this.music); this.wind = this.track(source, [envelope]); source.start();
    });
  }
  private score = () => {
    if (this.disposed || this.context.state !== 'running' || this.preferences.musicVolume <= 0 || this.preferences.masterVolume <= 0) return;
    const t = this.context.currentTime + .04;
    // Open D minor / B-flat / F / C voicings: no alarm-like pulse or implied enemies.
    const chords = [[146.83, 220, 349.23], [116.54, 174.61, 293.66], [174.61, 261.63, 440], [130.81, 196, 329.63]];
    const step = this.bar++, chord = chords[step % chords.length];
    chord.forEach((frequency, i) => {
      this.note(frequency, t + i * .3, 8.5, .023, this.music, { type: 'triangle', attack: 1.8, detune: i % 2 ? 3 : -3, pan: (i - 1) * .35 });
      this.note(frequency * 1.003, t + .35 + i * .3, 7.7, .014, this.music, { attack: 2.1, pan: (1 - i) * .35 });
    });
    // A distant, brief melodic response only every other phrase leaves room for play.
    if (step % 2 === 0) [chord[2], chord[1] * 2].forEach((frequency, i) => this.note(frequency, t + 4.2 + i * .8, 2.2, .018, this.music, { attack: .08, pan: i ? -.2 : .2 }));
  };
  private syncAmbience() {
    const audible = !this.disposed && this.context.state === 'running' && this.preferences.musicVolume > 0 && this.preferences.masterVolume > 0;
    if (audible) { this.startWind(); if (!this.timer) { this.score(); this.timer = setInterval(this.score, 12000); } }
    if (!audible) { clearInterval(this.timer); this.timer = undefined; if (this.wind) { this.stop(this.wind); this.wind = undefined; } }
  }
  async resume() {
    if (this.disposed || this.context.state === 'closed') return;
    if (this.context.state !== 'running') await this.context.resume();
    if (!this.disposed) this.syncAmbience();
  }
  suspend() {
    this.epoch++; this.ambientVersion++;
    clearInterval(this.timer); this.timer = undefined; this.wind = undefined;
    // Hidden-tab sounds are discarded, so an old combat cue cannot resume hours later.
    [...this.voices].forEach(voice => this.stop(voice));
    if (this.context.state === 'running') void this.context.suspend().catch(() => {});
  }
  play(sound: GameSound) {
    if (this.disposed || this.context.state !== 'running' || this.preferences.effectsVolume <= 0 || this.preferences.masterVolume <= 0) return;
    const now = this.context.currentTime;
    if (now - (this.lastCue[sound] ?? -Infinity) < .18) return;
    this.lastCue[sound] = now;
    const epoch = this.epoch, requested = performance.now();
    void this.load(sound).then(buffer => {
      // Never replay an old command after a slow load, hidden tab, mute or campaign teardown.
      if (!buffer || this.disposed || epoch !== this.epoch || performance.now() - requested > 1500 || this.context.state !== 'running' || this.preferences.effectsVolume <= 0 || this.preferences.masterVolume <= 0) return;
      const source = this.context.createBufferSource(), envelope = this.context.createGain();
      const levels: Record<GameSound, number> = { order: .55, confirm: .5, combat: .65, night: .6, discovery: .65, claim: .7, event: .55, day: .55, victory: .75, defeat: .65 };
      source.buffer = buffer; envelope.gain.value = levels[sound];
      source.connect(envelope); envelope.connect(this.effects); this.track(source, [envelope]); source.start();
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.requests.abort(); this.suspend(); this.samples.clear();
    [this.music, this.effects, this.master, this.limiter, this.delay, this.echo, this.feedback, this.echoFilter].forEach(node => node.disconnect());
    void this.context.close().catch(() => {});
  }
}

/** Call play only for accepted actions / actual observed results, never during render or save restoration. */
export function useGameAudio(preferences: GameAudioPreferences, ambience: GameAmbience = 'camp') {
  const engine = useRef<CampAudio | null>(null), latest = useRef(preferences), latestAmbience = useRef(ambience);
  useEffect(() => { latest.current = preferences; engine.current?.setPreferences(preferences); }, [preferences]);
  useEffect(() => { latestAmbience.current = ambience; engine.current?.setAmbience(ambience); }, [ambience]);
  useEffect(() => {
    let disposed = false;
    const unlock = (event: Event) => {
      if (!event.isTrusted || disposed || typeof AudioContext === 'undefined') return;
      if (!engine.current) { try { engine.current = new CampAudio(latest.current, latestAmbience.current); } catch { return; } }
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
