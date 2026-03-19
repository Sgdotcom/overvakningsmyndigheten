import { setState } from '../state.js';

async function sha256Hex(buf) {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Audio fingerprint (invasive).
 * Renders an OfflineAudioContext graph and hashes the output buffer.
 */
export async function collectAudioFingerprint() {
  if (!window.OfflineAudioContext) {
    const out = { supported: false };
    setState({ audioFingerprint: out });
    return out;
  }

  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 10000;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -50;
  comp.knee.value = 40;
  comp.ratio.value = 12;
  comp.attack.value = 0;
  comp.release.value = 0.25;

  osc.connect(comp);
  comp.connect(ctx.destination);
  osc.start(0);

  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);
  // downsample the float array to a stable byte buffer
  const sampleCount = 4096;
  const step = Math.max(1, Math.floor(data.length / sampleCount));
  const bytes = new Uint8Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const v = data[i * step] || 0;
    const clamped = Math.max(-1, Math.min(1, v));
    bytes[i] = Math.floor((clamped + 1) * 127.5);
  }

  const fp = await sha256Hex(bytes.buffer);
  const out = { supported: true, sha256: fp };
  setState({ audioFingerprint: out });
  return out;
}

