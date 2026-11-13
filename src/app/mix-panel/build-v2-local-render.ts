import type { SetlistCurve } from '../services/dsp';
import {
  BuildV2AudioDecoderFactory,
  BuildV2FileTrack,
  decodeBuildV2TrackFiles,
} from './build-v2-audio-decoder';
import {
  BuildV2EngineFinalFade,
  BuildV2EngineTrack,
  BuildV2EngineTransition,
  renderBuildV2Offline,
} from './build-v2-audio-engine';
import type {
  BuildV2EngineVignette,
} from './build-v2-vignette';
import {
  createBuildV2TrackState,
} from './build-v2-track-state';

export interface BuildV2LocalRenderOptions {
  sampleRate?: number;
  createDecoder?: BuildV2AudioDecoderFactory;
  finalFade?: BuildV2EngineFinalFade | null;
  vignette?: {
    id: string;
    file: File;
  } | null;
  render?: (
    tracks: BuildV2EngineTrack[],
    transitions: BuildV2EngineTransition[],
    sampleRate: number,
    finalFade:
      BuildV2EngineFinalFade | null,
    vignette:
      BuildV2EngineVignette | null,
  ) => Promise<AudioBuffer>;
}

export interface BuildV2LocalTransition {
  duration: number;
  curve: SetlistCurve;
}

export async function renderBuildV2FilesOffline(
  tracks: BuildV2FileTrack[],
  transitions: BuildV2LocalTransition[],
  options: BuildV2LocalRenderOptions = {},
): Promise<AudioBuffer> {
  const sampleRate = options.sampleRate ?? 48_000;

  const decoded = await decodeBuildV2TrackFiles(
    tracks,
    options.createDecoder,
  );

  let decodedVignette:
    BuildV2EngineVignette | null = null;

  if (options.vignette) {
    const decodedVignetteTracks =
      await decodeBuildV2TrackFiles(
        [
          {
            id:
              options.vignette.id,
            file:
              options.vignette.file,
            state:
              createBuildV2TrackState(),
          },
        ],
        options.createDecoder,
      );

    const decodedTrack =
      decodedVignetteTracks[0];

    if (!decodedTrack) {
      throw new Error(
        'BUILD_V2_VIGNETTE_DECODE_UNAVAILABLE',
      );
    }

    decodedVignette = {
      id: decodedTrack.id,
      buffer: decodedTrack.buffer,
    };
  }

  const render =
    options.render
    ?? renderBuildV2Offline;

  return render(
    decoded,
    transitions,
    sampleRate,
    options.finalFade ?? null,
    decodedVignette,
  );
}
