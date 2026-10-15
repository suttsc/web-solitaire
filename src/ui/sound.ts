/** Tiny synthesised sound effects (Web Audio), so there are no audio files to download or cache. */

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
) {
  const ctx = audio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const at = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export const sounds = {
  place(): void {
    tone(660, 0, 0.05, 'triangle', 0.08);
  },
  invalid(): void {
    tone(140, 0, 0.12, 'square', 0.04);
    if ('vibrate' in navigator) navigator.vibrate(10);
  },
  win(): void {
    [523, 659, 784, 1047].forEach((frequency, i) => {
      tone(frequency, i * 0.12, 0.25, 'triangle', 0.1);
    });
  },
};
