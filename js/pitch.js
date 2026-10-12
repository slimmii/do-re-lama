// Microfoon-toonhoogteherkenning. Het rekenwerk zit in detector-worklet.js (audiothread).

export class PitchDetector {
  constructor(ctx) {
    this.ctx = ctx;
    this.onFrame = null; // ({time, freq, midi, cents, rms, level})
    this.onNote = null; // ({time, midi, attack, strength})
    this.running = false;
    this.echoCancellation = false;
    this.deviceId = ''; // '' = de standaardmicrofoon van de browser
    this._sensitivity = 0.5; // 0..1
    this._latency = 0.06; // seconden die we van een aanslag aftrekken
  }

  get sensitivity() { return this._sensitivity; }
  set sensitivity(v) { this._sensitivity = v; this.node?.port.postMessage({ sensitivity: v }); }
  get latency() { return this._latency; }
  set latency(v) { this._latency = v; this.node?.port.postMessage({ latency: v }); }
  // Laat de detector per aanslag uitleggen hoe hij aan zijn noot kwam (onDebug); zie dev.mic() in de console.
  get debug() { return !!this._debug; }
  set debug(v) { this._debug = !!v; this.node?.port.postMessage({ debug: !!v }); }

  // Klinkende midi-noten die nu (of zo meteen) verwacht worden; helpt de detector als er nog snaren naklinken.
  setExpect(midis) {
    const key = midis.join(',');
    if (key === this._expectKey) return;
    this._expectKey = key;
    this.node?.port.postMessage({ expect: midis });
  }

  // Enkel deze klinkende midi-noten mogen als noot herkend worden; [] = alles.
  setAllowed(midis) {
    this._allowed = [...midis];
    this.node?.port.postMessage({ allowed: this._allowed });
  }

  // Laagste toonhoogte die de meting zoekt. Standaard 90 Hz (de laagste spelnoot is 131 Hz); bij het stemmen
  // lager voor de lage mi (82 Hz). Hoe lager, hoe groter de kans dat een noot een octaaf te laag geschat wordt.
  setMinFreq(hz) {
    this._minFreq = hz;
    this.node?.port.postMessage({ minFreq: hz });
  }

  async start() {
    if (this.running) return;
    await this.ctx.audioWorklet.addModule(new URL('./detector-worklet.js', import.meta.url));
    const audio = { echoCancellation: this.echoCancellation, noiseSuppression: false, autoGainControl: false };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: this.deviceId ? { ...audio, deviceId: { exact: this.deviceId } } : audio });
    } catch (e) {
      // gekozen microfoon is er niet meer (uitgetrokken): dan de standaardmicrofoon
      if (!this.deviceId || !['OverconstrainedError', 'NotFoundError'].includes(e.name)) throw e;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    }
    this.label = this.stream.getAudioTracks()[0]?.label || '';
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'simisol-detector', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    this.node.port.postMessage({ sensitivity: this._sensitivity, latency: this._latency, allowed: this._allowed || [], minFreq: this._minFreq || 90, debug: !!this._debug });
    this.node.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'frame') this.onFrame?.(m);
      else if (m.type === 'note') this.onNote?.(m);
      else if (m.type === 'debug') this.onDebug?.(m);
    };
    // Een stille uitgang houdt de worklet actief.
    this.mute = this.ctx.createGain();
    this.mute.gain.value = 0;
    this.source.connect(this.node);
    this.node.connect(this.mute).connect(this.ctx.destination);
    this.running = true;
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.source?.disconnect();
    this.node?.disconnect();
    this.mute?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    this.node = null;
  }
}
