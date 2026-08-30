/**
 * AudioWorklet processor — captures mic PCM and posts Float32 chunks to main thread.
 * Lower latency than deprecated ScriptProcessorNode.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;
    const channel = input[0];
    this.port.postMessage({ type: "pcm", samples: channel.slice() });
    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
