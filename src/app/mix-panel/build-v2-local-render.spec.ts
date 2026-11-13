import {
  renderBuildV2FilesOffline,
} from './build-v2-local-render';
import {
  BuildV2AudioDecoder,
} from './build-v2-audio-decoder';
import {
  createBuildV2TrackState,
} from './build-v2-track-state';

describe('BUILD V2 local render coordinator', () => {
  function file(name: string): File {
    return new File(
      [new Uint8Array([1, 2, 3, 4])],
      name,
      { type: 'audio/wav' },
    );
  }

  function buffer(
    seconds: number,
    sampleRate = 8_000,
  ): AudioBuffer {
    return new AudioBuffer({
      length: seconds * sampleRate,
      numberOfChannels: 2,
      sampleRate,
    });
  }

  it('decodes ordered files and passes them to the V2 engine', async () => {
    const decodedA = buffer(2);
    const decodedB = buffer(3);
    const finalBuffer = buffer(4);

    const decoder: BuildV2AudioDecoder = {
      decodeAudioData:
        jasmine.createSpy('decodeAudioData')
          .and.returnValues(
            Promise.resolve(decodedA),
            Promise.resolve(decodedB),
          ),
    };

    const render =
      jasmine.createSpy('render')
        .and.returnValue(
          Promise.resolve(finalBuffer),
        );

    const stateA = {
      ...createBuildV2TrackState(),
      gainDb: -6,
      pan: -0.5,
    };

    const stateB = {
      ...createBuildV2TrackState(),
      trimStartSeconds: 0.5,
      pan: 0.5,
    };

    const result = await renderBuildV2FilesOffline(
      [
        {
          id: 'a',
          file: file('a.wav'),
          state: stateA,
        },
        {
          id: 'b',
          file: file('b.wav'),
          state: stateB,
        },
      ],
      [
        {
          duration: 1,
          curve: 'equal-power',
        },
      ],
      {
        sampleRate: 48_000,
        createDecoder: () => decoder,
        render,
      },
    );

    expect(result).toBe(finalBuffer);
    expect(render).toHaveBeenCalledTimes(1);

    const [
      engineTracks,
      transitions,
      sampleRate,
    ] = render.calls.mostRecent().args;

    expect(engineTracks.length).toBe(2);

    expect(engineTracks[0].id).toBe('a');
    expect(engineTracks[0].buffer).toBe(decodedA);
    expect(engineTracks[0].state).toEqual(stateA);

    expect(engineTracks[1].id).toBe('b');
    expect(engineTracks[1].buffer).toBe(decodedB);
    expect(engineTracks[1].state).toEqual(stateB);

    expect(transitions).toEqual([
      {
        duration: 1,
        curve: 'equal-power',
      },
    ]);

    expect(sampleRate).toBe(48_000);
  });
});
