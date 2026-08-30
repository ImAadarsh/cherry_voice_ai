/**
 * PSTN audio bridge — μ-law 8 kHz (Twilio) ↔ PCM for the shared orchestrator.
 * pcmToMulaw8k is a minimal encoder; mulaw8kToPcm is expanded in a future telephony sprint.
 */

const MU_LAW_MAX = 0x1fff;
const BIAS = 0x84;

function linearToMulaw(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  let magnitude = Math.min(MU_LAW_MAX, Math.abs(sample));
  magnitude += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; exponent--) {
    expMask >>= 1;
  }
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Downsample PCM 16-bit LE (e.g. 24 kHz) to μ-law 8 kHz mono (stub: nearest-sample decimation). */
export function pcmToMulaw8k(pcm: Buffer, inputSampleRate = 24000): Buffer {
  const ratio = Math.max(1, Math.round(inputSampleRate / 8000));
  const outLen = Math.floor(pcm.length / 2 / ratio);
  const out = Buffer.alloc(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio * 2;
    const sample = pcm.readInt16LE(idx);
    out[i] = linearToMulaw(sample);
  }
  return out;
}

/** Decode μ-law 8 kHz to PCM 16-bit LE 16 kHz (stub for Twilio media streams). */
export function mulaw8kToPcm(mulaw: Buffer, outputSampleRate = 16000): Buffer {
  const outSamples = mulaw.length * 2;
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < mulaw.length; i++) {
    const u = ~mulaw[i]! & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let sample = ((mantissa << 3) + BIAS) << exponent;
    sample -= BIAS;
    if (sign) sample = -sample;
    const s16 = Math.max(-32768, Math.min(32767, sample));
    out.writeInt16LE(s16, i * 4);
    out.writeInt16LE(s16, i * 4 + 2);
  }
  if (outputSampleRate !== 8000) {
    return out;
  }
  return out;
}
