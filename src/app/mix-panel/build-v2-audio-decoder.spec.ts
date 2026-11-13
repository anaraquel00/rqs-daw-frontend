import {
  BuildV2AudioDecoder,
  decodeBuildV2TrackFiles,
} from './build-v2-audio-decoder';
import {
  createBuildV2TrackState,
} from './build-v2-track-state';

describe('BUILD V2 audio decoder', () => {
  function audioBuffer(
    durationSeconds = 1,
    sampleRate = 8_000,
  ): AudioBuffer {
    return new AudioBuffer({
      length: Math.round(
        durationSeconds * sampleRate,
      ),
      numberOfChannels: 2,
      sampleRate,
    });
  }

  function audioFile(
    name: string,
    bytes = [1, 2, 3, 4],
  ): File {
    return new File(
      [new Uint8Array(bytes)],
      name,
      { type: 'audio/wav' },
    );
  }

  it('converts File tracks into ordered engine AudioBuffers', async () => {
    const firstBuffer = audioBuffer(2);
    const secondBuffer = audioBuffer(3);

    const decodeAudioData =
      jasmine.createSpy('decodeAudioData')
        .and.returnValues(
          Promise.resolve(firstBuffer),
          Promise.resolve(secondBuffer),
        );

    const close =
      jasmine.createSpy('close')
        .and.returnValue(Promise.resolve());

    const decoder: BuildV2AudioDecoder = {
      decodeAudioData,
      close,
    };

    const firstState = {
      ...createBuildV2TrackState(),
      gainDb: -6,
      pan: -0.25,
    };

    const secondState = {
      ...createBuildV2TrackState(),
      trimStartSeconds: 1,
      pan: 0.5,
    };

    const result =
      await decodeBuildV2TrackFiles(
        [
          {
            id: 'track-a',
            file: audioFile('a.wav'),
            state: firstState,
          },
          {
            id: 'track-b',
            file: audioFile('b.wav'),
            state: secondState,
          },
        ],
        () => decoder,
      );

    expect(result.length).toBe(2);

    expect(result[0].id).toBe('track-a');
    expect(result[0].buffer).toBe(firstBuffer);
    expect(result[0].state).toEqual(firstState);

    expect(result[1].id).toBe('track-b');
    expect(result[1].buffer).toBe(secondBuffer);
    expect(result[1].state).toEqual(secondState);

    expect(decodeAudioData).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('copies V2 state instead of sharing the UI object', async () => {
    const state = createBuildV2TrackState();

    const decoder: BuildV2AudioDecoder = {
      decodeAudioData: async () => audioBuffer(),
    };

    const result =
      await decodeBuildV2TrackFiles(
        [
          {
            id: 'track-a',
            file: audioFile('a.wav'),
            state,
          },
        ],
        () => decoder,
      );

    expect(result[0].state).not.toBe(state);

    result[0].state.gainDb = -12;

    expect(state.gainDb).toBe(0);
  });

  it('rejects an empty source file and still closes the decoder', async () => {
    const close =
      jasmine.createSpy('close')
        .and.returnValue(Promise.resolve());

    const decoder: BuildV2AudioDecoder = {
      decodeAudioData: async () => audioBuffer(),
      close,
    };

    await expectAsync(
      decodeBuildV2TrackFiles(
        [
          {
            id: 'empty',
            file: audioFile('empty.wav', []),
            state: createBuildV2TrackState(),
          },
        ],
        () => decoder,
      ),
    ).toBeRejectedWithError(
      'BUILD_V2_EMPTY_AUDIO_FILE_empty',
    );

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports exactly which track failed decoding', async () => {
    const close =
      jasmine.createSpy('close')
        .and.returnValue(Promise.resolve());

    const decoder: BuildV2AudioDecoder = {
      decodeAudioData: async () => {
        throw new Error('codec failure');
      },
      close,
    };

    await expectAsync(
      decodeBuildV2TrackFiles(
        [
          {
            id: 'broken-track',
            file: audioFile('broken.mp3'),
            state: createBuildV2TrackState(),
          },
        ],
        () => decoder,
      ),
    ).toBeRejectedWithError(
      'BUILD_V2_DECODE_FAILED_broken-track',
    );

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not create an AudioContext for an empty setlist', async () => {
    const factory =
      jasmine.createSpy('factory');

    const result =
      await decodeBuildV2TrackFiles(
        [],
        factory,
      );

    expect(result).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });
});
