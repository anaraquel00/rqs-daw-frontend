import type {
  SetlistCurve,
  SetlistLoudnessMode,
} from '../services/dsp';

import type {
  BuildV2TrackState,
} from './build-v2-track-state';

import type {
  BuildV2FinalFadeState,
} from './build-v2-final-fade';

import {
  type BuildV2ProjectDocumentV1,
  type BuildV2ProjectAudioFormat,
  parseBuildV2ProjectDocument,
} from './build-v2-project-schema';


export interface BuildV2ProjectSessionTrack {
  trackId: string;
  assetId: string;
  file: File;
  durationSeconds: number;
  state: BuildV2TrackState;
}


export interface BuildV2ProjectSessionTransition {
  fromTrackId: string;
  toTrackId: string;
  durationSeconds: number;
  curve: SetlistCurve;
  usesDefault: boolean;
}


export interface BuildV2ProjectSessionVignette {
  enabled: boolean;
  assetId: string | null;
  file: File | null;
  durationSeconds: number;
}


export interface BuildV2ProjectSessionInput {
  projectId: string;
  projectName: string;

  createdAt: string;
  updatedAt: string;

  tracks:
    readonly BuildV2ProjectSessionTrack[];

  transitions:
    readonly BuildV2ProjectSessionTransition[];

  transitionDefaults: {
    durationSeconds: number;
    curve: SetlistCurve;
  };

  finalFade:
    BuildV2FinalFadeState;

  vignette:
    BuildV2ProjectSessionVignette;

  render: {
    exportName: string;
    loudnessMode:
      SetlistLoudnessMode;
  };
}


export interface BuildV2ProjectSnapshotAsset {
  assetId: string;
  file: File;
}


export interface BuildV2ProjectSaveSnapshot {
  project:
    BuildV2ProjectDocumentV1;

  assets:
    BuildV2ProjectSnapshotAsset[];
}


/**
 * Converts the mutable BUILD V2 runtime session into the
 * immutable canonical persistence contract.
 *
 * No AudioBuffer, Blob URL, upload state or S3 key crosses
 * this boundary.
 */
export function buildBuildV2ProjectSnapshot(
  session:
    BuildV2ProjectSessionInput,
): BuildV2ProjectSaveSnapshot {
  const assets:
    BuildV2ProjectDocumentV1[
      'assets'
    ] = [];

  const payloads:
    BuildV2ProjectSnapshotAsset[] = [];

  for (
    const track
    of session.tracks
  ) {
    const format =
      formatForFile(
        track.file,
      );

    assets.push({
      assetId:
        track.assetId,

      originalFileName:
        track.file.name,

      format,

      sizeBytes:
        track.file.size,

      durationSeconds:
        track.durationSeconds,
    });

    payloads.push({
      assetId:
        track.assetId,

      file:
        track.file,
    });
  }


  let vignetteAssetId:
    string | null = null;

  if (
    session.vignette.enabled
  ) {
    const assetId =
      session.vignette.assetId;

    const file =
      session.vignette.file;

    if (
      !assetId
      || !file
    ) {
      throw new Error(
        'BUILD_V2_PROJECT_VIGNETTE_ASSET_MISSING',
      );
    }

    assets.push({
      assetId,

      originalFileName:
        file.name,

      format:
        formatForFile(
          file,
        ),

      sizeBytes:
        file.size,

      durationSeconds:
        session.vignette
          .durationSeconds,
    });

    payloads.push({
      assetId,
      file,
    });

    vignetteAssetId =
      assetId;
  }


  const project =
    parseBuildV2ProjectDocument({
      kind:
        'rqs-build-project',

      schemaVersion:
        1,

      projectId:
        session.projectId,

      name:
        session.projectName,

      createdAt:
        session.createdAt,

      updatedAt:
        session.updatedAt,

      assets,

      tracks:
        session.tracks.map(
          track => ({
            trackId:
              track.trackId,

            assetId:
              track.assetId,

            state: {
              ...track.state,
            },
          }),
        ),

      transitions:
        session.transitions.map(
          transition => ({
            fromTrackId:
              transition.fromTrackId,

            toTrackId:
              transition.toTrackId,

            durationSeconds:
              transition
                .durationSeconds,

            curve:
              transition.curve,

            usesDefault:
              transition.usesDefault,
          }),
        ),

      transitionDefaults: {
        durationSeconds:
          session
            .transitionDefaults
            .durationSeconds,

        curve:
          session
            .transitionDefaults
            .curve,
      },

      finalFade: {
        enabled:
          session.finalFade.enabled,

        durationSeconds:
          session.finalFade.duration,

        curve:
          session.finalFade.curve,
      },

      vignette: {
        enabled:
          session.vignette.enabled,

        assetId:
          vignetteAssetId,

        mode:
          'duck-overlay-v1',
      },

      render: {
        exportName:
          session.render.exportName,

        loudnessMode:
          session.render
            .loudnessMode,

        outputFormat:
          'wav',

        sampleRate:
          48_000,

        channels:
          2,
      },
    });


  return {
    project,
    assets:
      payloads,
  };
}


function formatForFile(
  file: File,
): BuildV2ProjectAudioFormat {
  if (
    /\.wav$/i.test(
      file.name,
    )
  ) {
    return 'wav';
  }

  if (
    /\.mp3$/i.test(
      file.name,
    )
  ) {
    return 'mp3';
  }

  throw new Error(
    'BUILD_V2_PROJECT_UNSUPPORTED_AUDIO_FORMAT',
  );
}
