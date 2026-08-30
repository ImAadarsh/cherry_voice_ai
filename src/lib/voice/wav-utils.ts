/** Strip WAV container header from Inworld PCM chunks (each chunk is a standalone WAV file). */
export function stripWavHeader(audio: Buffer): Buffer {
  if (audio.length < 12 || audio.toString("ascii", 0, 4) !== "RIFF") {
    return audio;
  }

  let offset = 12;
  while (offset + 8 <= audio.length) {
    const chunkId = audio.toString("ascii", offset, offset + 4);
    const chunkSize = audio.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      const start = offset + 8;
      const end = Math.min(start + chunkSize, audio.length);
      return audio.subarray(start, end);
    }
    offset += 8 + chunkSize;
  }

  return audio.length > 44 ? audio.subarray(44) : audio;
}
