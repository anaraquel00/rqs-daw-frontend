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

export interface BuildV2LocalRenderOptions {
  sampleRate?: number;
  createDecoder?: BuildV2AudioDecoderFactory;
  finalFade?: BuildV2EngineFinalFade | null;
  render?: (
    tracks: BuildV2EngineTrack[],
    transitions: BuildV2EngineTransition[],
    sampleRate: number,
    finalFade:
      BuildV2EngineFinalFade | null,
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

  const render = options.render ?? renderBuildV2Offline;

  return render(
    decoded,
    transitions,
    sampleRate,
    options.finalFade ?? null,
  );
}
