import type { BuildV2TrackState } from './build-v2-track-state';
import type { BuildV2EngineTrack } from './build-v2-audio-engine';

export interface BuildV2FileTrack {
  id: string;
  file: File;
  state: BuildV2TrackState;
}

export interface BuildV2AudioDecoder {
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  close?(): Promise<void> | void;
}

export type BuildV2AudioDecoderFactory =
  () => BuildV2AudioDecoder;

export async function decodeBuildV2TrackFiles(
  tracks: BuildV2FileTrack[],
  createDecoder: BuildV2AudioDecoderFactory =
    createBrowserAudioDecoder,
): Promise<BuildV2EngineTrack[]> {
  if (tracks.length === 0) return [];

  const decoder = createDecoder();

  try {
    const decodedTracks: BuildV2EngineTrack[] = [];

    for (const track of tracks) {
      const bytes = await track.file.arrayBuffer();

      if (bytes.byteLength === 0) {
        throw new Error(
          `BUILD_V2_EMPTY_AUDIO_FILE_${track.id}`,
        );
      }

      let buffer: AudioBuffer;

      try {
        /*
         * Some implementations of decodeAudioData may consume/detach
         * the supplied ArrayBuffer. Give the decoder its own copy.
         */
        buffer = await decoder.decodeAudioData(
          bytes.slice(0),
        );
      } catch {
        throw new Error(
          `BUILD_V2_DECODE_FAILED_${track.id}`,
        );
      }

      if (
        !Number.isFinite(buffer.duration)
        || buffer.duration <= 0
        || buffer.length <= 0
        || buffer.numberOfChannels <= 0
      ) {
        throw new Error(
          `BUILD_V2_INVALID_AUDIO_BUFFER_${track.id}`,
        );
      }

      decodedTracks.push({
        id: track.id,
        buffer,
        state: {
          ...track.state,
        },
      });
    }

    return decodedTracks;
  } finally {
    await decoder.close?.();
  }
}

function createBrowserAudioDecoder(): BuildV2AudioDecoder {
  const context = new AudioContext();

  return {
    decodeAudioData: (data: ArrayBuffer) =>
      context.decodeAudioData(data),

    close: () => context.close(),
  };
}
