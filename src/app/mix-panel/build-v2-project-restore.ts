import type {
  SetlistCurve,
  SetlistLoudnessMode,
} from '../services/dsp';

import type {
  BuildV2TrackState,
} from './build-v2-track-state';

import {
  type BuildV2ProjectDocumentV1,
  parseBuildV2ProjectDocument,
} from './build-v2-project-schema';


export interface BuildV2ProjectRestoredTrack {
  trackId: string;
  assetId: string;
  file: File;
  durationSeconds: number;
  state: BuildV2TrackState;
}


export interface BuildV2ProjectRestoredTransition {
  fromTrackId: string;
  toTrackId: string;
  durationSeconds: number;
  curve: SetlistCurve;
  usesDefault: boolean;
}


export interface BuildV2ProjectRestoredVignette {
  enabled: boolean;
  assetId: string | null;
  file: File | null;
  durationSeconds: number;
}


export interface BuildV2ProjectRestorePlan {
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;

  tracks:
    BuildV2ProjectRestoredTrack[];

  transitions:
    BuildV2ProjectRestoredTransition[];

  transitionDefaults: {
    durationSeconds: number;
    curve: SetlistCurve;
  };

  finalFade: {
    enabled: boolean;
    duration: number;
    curve: SetlistCurve;
  };

  vignette:
    BuildV2ProjectRestoredVignette;

  render: {
    exportName: string;
    loudnessMode:
      SetlistLoudnessMode;
  };
}


export function buildBuildV2ProjectRestorePlan(
  projectInput:
    BuildV2ProjectDocumentV1,
  files:
    ReadonlyMap<string, File>,
): BuildV2ProjectRestorePlan {
  const project =
    parseBuildV2ProjectDocument(
      projectInput,
    );

  if (
    files.size
    !== project.assets.length
  ) {
    throw new Error(
      'BUILD_V2_PROJECT_RESTORE_ASSET_COUNT_MISMATCH',
    );
  }

  const assetsById =
    new Map(
      project.assets.map(
        asset => [
          asset.assetId,
          asset,
        ],
      ),
    );

  for (
    const asset
    of project.assets
  ) {
    const file =
      files.get(
        asset.assetId,
      );

    if (!file) {
      throw new Error(
        `BUILD_V2_PROJECT_RESTORE_FILE_MISSING_${asset.assetId}`,
      );
    }

    if (
      file.name
        !== asset.originalFileName
      || file.size
        !== asset.sizeBytes
    ) {
      throw new Error(
        `BUILD_V2_PROJECT_RESTORE_FILE_MISMATCH_${asset.assetId}`,
      );
    }
  }

  for (
    const assetId
    of files.keys()
  ) {
    if (
      !assetsById.has(
        assetId,
      )
    ) {
      throw new Error(
        `BUILD_V2_PROJECT_RESTORE_EXTRA_FILE_${assetId}`,
      );
    }
  }


  const tracks =
    project.tracks.map(
      track => {
        const asset =
          assetsById.get(
            track.assetId,
          );

        const file =
          files.get(
            track.assetId,
          );

        if (
          !asset
          || !file
        ) {
          throw new Error(
            `BUILD_V2_PROJECT_RESTORE_TRACK_ASSET_MISSING_${track.trackId}`,
          );
        }

        return {
          trackId:
            track.trackId,

          assetId:
            track.assetId,

          file,

          durationSeconds:
            asset.durationSeconds,

          state: {
            ...track.state,
          },
        };
      },
    );


  let vignette:
    BuildV2ProjectRestoredVignette = {
    enabled:
      false,

    assetId:
      null,

    file:
      null,

    durationSeconds:
      0,
  };

  if (
    project.vignette.enabled
  ) {
    const assetId =
      project.vignette.assetId;

    if (!assetId) {
      throw new Error(
        'BUILD_V2_PROJECT_RESTORE_VIGNETTE_ID_MISSING',
      );
    }

    const asset =
      assetsById.get(
        assetId,
      );

    const file =
      files.get(
        assetId,
      );

    if (
      !asset
      || !file
    ) {
      throw new Error(
        'BUILD_V2_PROJECT_RESTORE_VIGNETTE_FILE_MISSING',
      );
    }

    vignette = {
      enabled:
        true,

      assetId,

      file,

      durationSeconds:
        asset.durationSeconds,
    };
  }


  return {
    projectId:
      project.projectId,

    projectName:
      project.name,

    createdAt:
      project.createdAt,

    updatedAt:
      project.updatedAt,

    tracks,

    transitions:
      project.transitions.map(
        transition => ({
          fromTrackId:
            transition.fromTrackId,

          toTrackId:
            transition.toTrackId,

          durationSeconds:
            transition.durationSeconds,

          curve:
            transition.curve,

          usesDefault:
            transition.usesDefault,
        }),
      ),

    transitionDefaults: {
      durationSeconds:
        project
          .transitionDefaults
          .durationSeconds,

      curve:
        project
          .transitionDefaults
          .curve,
    },

    finalFade: {
      enabled:
        project.finalFade.enabled,

      duration:
        project.finalFade
          .durationSeconds,

      curve:
        project.finalFade.curve,
    },

    vignette,

    render: {
      exportName:
        project.render.exportName,

      loudnessMode:
        project.render
          .loudnessMode,
    },
  };
}
