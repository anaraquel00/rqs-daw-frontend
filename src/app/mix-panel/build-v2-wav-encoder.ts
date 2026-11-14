const WAV_HEADER_BYTES = 44;
const PCM_24_BYTES_PER_SAMPLE = 3;
const STEREO_CHANNELS = 2;

type BuildV2AudioBufferSource = Pick<
  AudioBuffer,
  'getChannelData' | 'length' | 'numberOfChannels' | 'sampleRate'
>;

function writeAscii(
  view: DataView,
  offset: number,
  value: string,
): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(
      offset + index,
      value.charCodeAt(index),
    );
  }
}

function writePcm24Sample(
  view: DataView,
  offset: number,
  sample: number,
): void {
  const finiteSample =
    Number.isFinite(sample)
      ? sample
      : 0;

  const clamped = Math.max(
    -1,
    Math.min(1, finiteSample),
  );

  const signed =
    clamped < 0
      ? Math.round(clamped * 0x800000)
      : Math.round(clamped * 0x7fffff);

  view.setUint8(offset, signed & 0xff);
  view.setUint8(offset + 1, (signed >> 8) & 0xff);
  view.setUint8(offset + 2, (signed >> 16) & 0xff);
}

export function encodeBuildV2WavPcm24(
  audioBuffer: BuildV2AudioBufferSource,
): Uint8Array {
  if (
    !Number.isInteger(audioBuffer.length)
    || audioBuffer.length < 0
    || !Number.isFinite(audioBuffer.sampleRate)
    || audioBuffer.sampleRate <= 0
    || audioBuffer.numberOfChannels < 1
  ) {
    throw new Error('Invalid BUILD V2 audio buffer');
  }

  const bytesPerFrame =
    STEREO_CHANNELS
    * PCM_24_BYTES_PER_SAMPLE;

  const dataBytes =
    audioBuffer.length
    * bytesPerFrame;

  const output = new Uint8Array(
    WAV_HEADER_BYTES + dataBytes,
  );

  const view = new DataView(
    output.buffer,
  );

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, STEREO_CHANNELS, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(
    28,
    audioBuffer.sampleRate * bytesPerFrame,
    true,
  );
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 24, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const left = audioBuffer.getChannelData(0);
  const right =
    audioBuffer.numberOfChannels > 1
      ? audioBuffer.getChannelData(1)
      : left;

  let offset = WAV_HEADER_BYTES;

  for (
    let frame = 0;
    frame < audioBuffer.length;
    frame += 1
  ) {
    writePcm24Sample(view, offset, left[frame] ?? 0);
    offset += PCM_24_BYTES_PER_SAMPLE;
    writePcm24Sample(view, offset, right[frame] ?? 0);
    offset += PCM_24_BYTES_PER_SAMPLE;
  }

  return output;
}
