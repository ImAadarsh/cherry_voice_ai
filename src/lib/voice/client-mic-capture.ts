/** Shared AudioWorklet mic capture for Cherry Voice web clients. */
export type MicCaptureHandle = { stop: () => void };

export async function startWorkletMicCapture(opts: {
  audioUrl: string;
  workletUrl: string;
  isActive: () => boolean;
  onUploadFailure?: () => void;
}): Promise<{ handle: MicCaptureHandle }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(opts.workletUrl);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-capture-processor");
  node.port.onmessage = (ev: MessageEvent<{ type?: string; samples?: Float32Array }>) => {
    if (!opts.isActive() || ev.data?.type !== "pcm" || !ev.data.samples) return;
    const down = downsample(ev.data.samples, ctx.sampleRate, 16000);
    const pcm = f32ToPcm(down);
    void fetch(opts.audioUrl, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pcm })
      .catch(() => opts.onUploadFailure?.());
  };
  src.connect(node);
  node.connect(ctx.destination);
  return {
    handle: {
      stop: () => {
        node.disconnect();
        src.disconnect();
        void ctx.close();
        stream.getTracks().forEach((t) => t.stop());
      },
    },
  };
}

function f32ToPcm(f: Float32Array): ArrayBuffer {
  const b = new ArrayBuffer(f.length * 2);
  const v = new DataView(b);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    v.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return b;
}

function downsample(b: Float32Array, inR: number, outR: number): Float32Array {
  if (inR === outR) return b;
  const ratio = inR / outR;
  const len = Math.round(b.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0, c = 0;
    const a = Math.round(i * ratio), z = Math.round((i + 1) * ratio);
    for (let j = a; j < z && j < b.length; j++) { s += b[j]; c++; }
    out[i] = c ? s / c : 0;
  }
  return out;
}

export function playProcessingEarcon(): void {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.04;
    o.frequency.value = 440;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    o.onended = () => void ctx.close();
  } catch { /* ignore */ }
}
