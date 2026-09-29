import * as Tone from 'tone';
import { carSound } from './data';

// Un auto que pasa: motor (diente de sierra) y aire (ruido rosa) cuyo tono baja al alejarse, como el efecto Doppler.
export function passCar(out: Tone.ToneAudioNode, kmh: number) {
  const {freq, dur} = carSound(kmh), t = Tone.now() + 0.01;
  const amp = new Tone.Gain(0).connect(out);
  const body = new Tone.Filter(900, 'lowpass').connect(amp);
  const engine = new Tone.Oscillator(freq * 1.12, 'sawtooth').connect(body);
  const airLevel = new Tone.Gain(0.5).connect(amp);
  const air = new Tone.Filter({type: 'bandpass', frequency: freq * 14, Q: 0.8}).connect(airLevel);
  const noise = new Tone.Noise('pink').connect(air);
  engine.frequency.setValueAtTime(freq * 1.12, t).exponentialRampToValueAtTime(freq * 0.89, t + dur);
  air.frequency.setValueAtTime(freq * 14, t).exponentialRampToValueAtTime(freq * 8, t + dur);
  amp.gain.setValueAtTime(0, t).linearRampToValueAtTime(0.16, t + dur / 2).linearRampToValueAtTime(0, t + dur);
  engine.start(t).stop(t + dur);
  noise.start(t).stop(t + dur);
  setTimeout(() => [engine, noise, body, air, airLevel, amp].forEach(node => node.dispose()), (dur + 0.4) * 1000);
}
// Bocina de dos tonos: icono auditivo de atasco.
export function honk(out: Tone.ToneAudioNode) {
  const t = Tone.now() + 0.02, amp = new Tone.Gain(0).connect(out);
  const tone = new Tone.Filter(2400, 'lowpass').connect(amp);
  const horns = [415, 523].map(f => new Tone.Oscillator(f, 'square').connect(tone));
  amp.gain.setValueAtTime(0, t).linearRampToValueAtTime(0.05, t + 0.02).setValueAtTime(0.05, t + 0.2).linearRampToValueAtTime(0, t + 0.24);
  horns.forEach(h => h.start(t).stop(t + 0.25));
  setTimeout(() => [...horns, tone, amp].forEach(node => node.dispose()), 700);
}
