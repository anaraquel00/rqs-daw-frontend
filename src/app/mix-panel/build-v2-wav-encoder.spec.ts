import {
  encodeBuildV2WavPcm24,
} from './build-v2-wav-encoder';

describe('BUILD V2 WAV PCM 24-bit encoder', () => {
  it('writes a stereo 48 kHz RIFF header and interleaved PCM samples', () => {
    const channels = [
      new Float32Array([-1, 0.5]),
      new Float32Array([1, -0.5]),
    ];

    const wav = encodeBuildV2WavPcm24({
      length: 2,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: channel => channels[channel],
    });

    const view = new DataView(wav.buffer);
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(
        ...wav.slice(offset, offset + length),
      );

    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(288_000);
    expect(view.getUint16(32, true)).toBe(6);
    expect(view.getUint16(34, true)).toBe(24);
    expect(view.getUint32(40, true)).toBe(12);
    expect(wav.length).toBe(56);

    expect([...wav.slice(44, 50)]).toEqual([
      0x00, 0x00, 0x80,
      0xff, 0xff, 0x7f,
    ]);
  });

  it('duplicates mono into stereo and replaces non-finite samples with silence', () => {
    const mono = new Float32Array([
      Number.NaN,
      0.25,
    ]);

    const wav = encodeBuildV2WavPcm24({
      length: 2,
      numberOfChannels: 1,
      sampleRate: 44_100,
      getChannelData: () => mono,
    });

    expect([...wav.slice(44, 50)]).toEqual([
      0, 0, 0,
      0, 0, 0,
    ]);

    expect([...wav.slice(50, 56)]).toEqual([
      0, 0, 0x20,
      0, 0, 0x20,
    ]);
  });

  it('rejects invalid buffer metadata', () => {
    expect(() => encodeBuildV2WavPcm24({
      length: -1,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: () => new Float32Array(),
    })).toThrowError('Invalid BUILD V2 audio buffer');
  });
});
