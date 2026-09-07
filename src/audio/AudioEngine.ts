import type { AudioSnapshot } from '../types';

export class AudioEngine {
  readonly audio: HTMLAudioElement;

  private context?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private analyser?: AnalyserNode;
  private bass?: BiquadFilterNode;
  private mid?: BiquadFilterNode;
  private treble?: BiquadFilterNode;
  private gain?: GainNode;
  private eq = { bass: 0, mid: 0, treble: 0 };

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
  }

  load(url: string) {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = url;
    this.audio.load();
  }

  async play() {
    await this.ensureGraph();
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    const upper = Number.isFinite(this.audio.duration) ? this.audio.duration : seconds;
    this.audio.currentTime = Math.max(0, Math.min(seconds, upper));
  }

  setVolume(value: number) {
    const normalized = Math.max(0, Math.min(1, value));
    if (this.gain) this.gain.gain.value = normalized;
    this.audio.volume = this.gain ? 1 : normalized;
  }

  setEq(band: 'bass' | 'mid' | 'treble', db: number) {
    this.eq[band] = Math.max(-12, Math.min(12, db));
    const filter = band === 'bass' ? this.bass : band === 'mid' ? this.mid : this.treble;
    if (filter) filter.gain.value = this.eq[band];
  }

  get frequencyBinCount() {
    return this.analyser?.frequencyBinCount ?? 1024;
  }

  readFrequencyData(target: Uint8Array<ArrayBuffer>) {
    if (!this.analyser) {
      target.fill(0);
      return;
    }
    this.analyser.getByteFrequencyData(target);
  }

  readTimeData(target: Uint8Array<ArrayBuffer>) {
    if (!this.analyser) {
      target.fill(128);
      return;
    }
    this.analyser.getByteTimeDomainData(target);
  }

  snapshot(): AudioSnapshot {
    if (!this.analyser || !this.context) return { low: 0, mid: 0, high: 0, rms: 0 };

    const freq = new Uint8Array(this.analyser.frequencyBinCount);
    const time = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteFrequencyData(freq);
    this.analyser.getByteTimeDomainData(time);

    const hzPerBin = this.context.sampleRate / this.analyser.fftSize;
    let low = 0;
    let mid = 0;
    let high = 0;
    let lowCount = 0;
    let midCount = 0;
    let highCount = 0;

    freq.forEach((value, index) => {
      const hz = index * hzPerBin;
      if (hz < 250) {
        low += value;
        lowCount += 1;
      } else if (hz < 4000) {
        mid += value;
        midCount += 1;
      } else {
        high += value;
        highCount += 1;
      }
    });

    let sumSquares = 0;
    time.forEach((value) => {
      const centered = (value - 128) / 128;
      sumSquares += centered * centered;
    });

    const normalize = (sum: number, count: number) =>
      count ? Number((sum / count / 255).toFixed(3)) : 0;

    return {
      low: normalize(low, lowCount),
      mid: normalize(mid, midCount),
      high: normalize(high, highCount),
      rms: Number(Math.sqrt(sumSquares / time.length).toFixed(3)),
    };
  }

  async dispose() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }

  private async ensureGraph() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume();
      return;
    }

    this.context = new AudioContext();
    this.source = this.context.createMediaElementSource(this.audio);
    this.bass = this.context.createBiquadFilter();
    this.mid = this.context.createBiquadFilter();
    this.treble = this.context.createBiquadFilter();
    this.analyser = this.context.createAnalyser();
    this.gain = this.context.createGain();

    this.bass.type = 'lowshelf';
    this.bass.frequency.value = 180;
    this.bass.gain.value = this.eq.bass;

    this.mid.type = 'peaking';
    this.mid.frequency.value = 1200;
    this.mid.Q.value = 0.9;
    this.mid.gain.value = this.eq.mid;

    this.treble.type = 'highshelf';
    this.treble.frequency.value = 6000;
    this.treble.gain.value = this.eq.treble;

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    this.source
      .connect(this.bass)
      .connect(this.mid)
      .connect(this.treble)
      .connect(this.analyser)
      .connect(this.gain)
      .connect(this.context.destination);

    await this.context.resume();
  }
}
