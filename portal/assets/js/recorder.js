/*
  WavRecorder: records from the microphone and returns a 16-bit mono WAV.

  Why WAV: it needs no encoder library, every device can play it, and the
  hardware requirements for the bear are still unconfirmed. Files are
  larger than MP3 (about 5 MB per minute at 44.1 kHz mono).

  How it works:
    1. getUserMedia gives us the microphone stream.
    2. An AudioContext + ScriptProcessorNode hands us raw Float32 samples.
       (ScriptProcessorNode is old but works everywhere, including when
       index.html is opened from disk. AudioWorklet would need a server.)
    3. On stop, samples are resampled to the target rate and written into
       a WAV container.

  Usage:
    const rec = new WavRecorder({ sampleRate: 44100, maxSeconds: 120 });
    await rec.start();               // asks for microphone permission
    ...                              // rec.elapsedSeconds() for a timer
    const { blob, duration } = await rec.stop();
*/

class WavRecorder {
  constructor(options) {
    this.targetRate = (options && options.sampleRate) || 44100;
    this.maxSeconds = (options && options.maxSeconds) || 120;
    this.onMaxReached = options && options.onMaxReached;
    this.chunks = [];
    this.stream = null;
    this.context = null;
    this.processor = null;
    this.source = null;
    this.startedAt = 0;
    this.recording = false;
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext));
  }

  async start() {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1 },
      video: false
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.context = new Ctx();
    if (this.context.state === "suspended") { await this.context.resume(); }
    this.inputRate = this.context.sampleRate;
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      if (this.elapsedSeconds() >= this.maxSeconds && this.onMaxReached) {
        this.onMaxReached();
      }
    };
    this.source.connect(this.processor);
    // The processor must be connected to something to run. A muted gain
    // node keeps the microphone from being played back through speakers.
    this.silence = this.context.createGain();
    this.silence.gain.value = 0;
    this.processor.connect(this.silence);
    this.silence.connect(this.context.destination);
    this.startedAt = performance.now();
    this.recording = true;
  }

  elapsedSeconds() {
    return this.recording ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  async stop() {
    this.recording = false;
    if (this.processor) { this.processor.disconnect(); this.processor.onaudioprocess = null; }
    if (this.source) this.source.disconnect();
    if (this.silence) this.silence.disconnect();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.context) { try { await this.context.close(); } catch (e) { /* ignore */ } }

    const samples = WavRecorder.merge(this.chunks);
    const resampled = WavRecorder.resample(samples, this.inputRate, this.targetRate);
    const blob = WavRecorder.encodeWav(resampled, this.targetRate);
    const duration = resampled.length / this.targetRate;
    this.chunks = [];
    return { blob, duration };
  }

  cancel() {
    this.recording = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.context) { try { this.context.close(); } catch (e) { /* ignore */ } }
    this.chunks = [];
  }

  static merge(chunks) {
    let length = 0;
    chunks.forEach((c) => { length += c.length; });
    const out = new Float32Array(length);
    let offset = 0;
    chunks.forEach((c) => { out.set(c, offset); offset += c.length; });
    return out;
  }

  /* Simple linear-interpolation resampler. Good enough for speech. */
  static resample(samples, fromRate, toRate) {
    if (fromRate === toRate) return samples;
    const ratio = fromRate / toRate;
    const newLength = Math.round(samples.length / ratio);
    const out = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, samples.length - 1);
      const frac = pos - i0;
      out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
    }
    return out;
  }

  /* Writes a canonical 44-byte-header PCM WAV, 16-bit mono. */
  static encodeWav(samples, sampleRate) {
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);          // PCM chunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);          // bits per sample
    writeString(36, "data");
    view.setUint32(40, samples.length * bytesPerSample, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  }
}

window.WavRecorder = WavRecorder;
