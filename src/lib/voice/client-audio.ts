/** Browser PCM playback queue with barge-in support (client-only). */

function stripWavHeaderClient(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12 || bytes[0] !== 0x52) return bytes;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    if (id === "data") return bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size;
  }
  return bytes.length > 44 ? bytes.subarray(44) : bytes;
}

export class PcmPlaybackQueue {
  private ctx: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.nextPlayTime = this.ctx.currentTime;
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  async playPcmChunk(base64: string, sampleRate = 24000): Promise<void> {
    const ctx = await this.ensureContext();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pcm = stripWavHeaderClient(bytes);
    if (pcm.length < 2) return;

    const samples = new Float32Array(pcm.length / 2);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let j = 0; j < samples.length; j++) {
      samples[j] = view.getInt16(j * 2, true) / 32768;
    }

    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, this.nextPlayTime);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx >= 0) this.activeSources.splice(idx, 1);
    };
  }

  stop(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources = [];
    if (this.ctx) {
      this.nextPlayTime = this.ctx.currentTime;
    }
  }

  destroy(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.nextPlayTime = 0;
    }
  }
}
