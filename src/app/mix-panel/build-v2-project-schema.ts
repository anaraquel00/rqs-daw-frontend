import type {
  SetlistCurve,
  SetlistLoudnessMode,
} from '../services/dsp';

import {
  type BuildV2TrackState,
  buildV2EffectiveRange,
  normalizeBuildV2TrackState,
} from './build-v2-track-state';

import {
  BUILD_V2_TRANSITION_MAX_SECONDS,
  BUILD_V2_TRANSITION_MIN_SECONDS,
  buildV2TransitionMaxDuration,
  normalizeBuildV2TransitionDuration,
} from './build-v2-transition-state';

import {
  BUILD_V2_FINAL_FADE_MAX_SECONDS,
  BUILD_V2_FINAL_FADE_MIN_SECONDS,
  buildV2FinalFadeMaxDuration,
  normalizeBuildV2FinalFadeState,
} from './build-v2-final-fade';

import {
  BUILD_V2_VIGNETTE_MAX_SECONDS,
} from './build-v2-vignette';


export const BUILD_V2_PROJECT_KIND =
  'rqs-build-project';

export const BUILD_V2_PROJECT_SCHEMA_VERSION =
  1 as const;

export const BUILD_V2_PROJECT_MAX_TRACKS =
  8;

export const BUILD_V2_PROJECT_SAMPLE_RATE =
  48_000 as const;

export const BUILD_V2_PROJECT_CHANNELS =
  2 as const;

export type BuildV2ProjectAudioFormat =
  | 'wav'
  | 'mp3';

export type BuildV2ProjectVignetteMode =
  'duck-overlay-v1';


export interface BuildV2ProjectAssetV1 {
  assetId: string;
  originalFileName: string;
  format: BuildV2ProjectAudioFormat;
  sizeBytes: number;
  durationSeconds: number;
}


export interface BuildV2ProjectTrackV1 {
  trackId: string;
  assetId: string;
  state: BuildV2TrackState;
}


export interface BuildV2ProjectTransitionV1 {
  fromTrackId: string;
  toTrackId: string;
  durationSeconds: number;
  curve: SetlistCurve;
  usesDefault: boolean;
}


export interface BuildV2ProjectTransitionDefaultsV1 {
  durationSeconds: number;
  curve: SetlistCurve;
}


export interface BuildV2ProjectFinalFadeV1 {
  enabled: boolean;
  durationSeconds: number;
  curve: SetlistCurve;
}


export interface BuildV2ProjectVignetteV1 {
  enabled: boolean;
  assetId: string | null;
  mode: BuildV2ProjectVignetteMode;
}


export interface BuildV2ProjectRenderV1 {
  exportName: string;
  loudnessMode: SetlistLoudnessMode;
  outputFormat: 'wav';
  sampleRate: typeof BUILD_V2_PROJECT_SAMPLE_RATE;
  channels: typeof BUILD_V2_PROJECT_CHANNELS;
}


export interface BuildV2ProjectDocumentV1 {
  kind: typeof BUILD_V2_PROJECT_KIND;
  schemaVersion:
    typeof BUILD_V2_PROJECT_SCHEMA_VERSION;

  projectId: string;
  name: string;

  createdAt: string;
  updatedAt: string;

  assets: BuildV2ProjectAssetV1[];
  tracks: BuildV2ProjectTrackV1[];
  transitions: BuildV2ProjectTransitionV1[];

  transitionDefaults:
    BuildV2ProjectTransitionDefaultsV1;

  finalFade:
    BuildV2ProjectFinalFadeV1;

  vignette:
    BuildV2ProjectVignetteV1;

  render:
    BuildV2ProjectRenderV1;
}


export type BuildV2ProjectSchemaErrorCode =
  | 'INVALID_DOCUMENT'
  | 'INVALID_FIELD'
  | 'UNSUPPORTED_KIND'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_ASSET'
  | 'INVALID_TRACK'
  | 'INVALID_TRANSITION'
  | 'INVALID_FINAL_FADE'
  | 'INVALID_VIGNETTE'
  | 'INVALID_RENDER'
  | 'INVALID_REFERENCE'
  | 'INVALID_GEOMETRY';


export class BuildV2ProjectSchemaError
  extends Error {
  constructor(
    readonly code:
      BuildV2ProjectSchemaErrorCode,
    message: string,
  ) {
    super(message);

    this.name =
      'BuildV2ProjectSchemaError';
  }
}


const EPSILON =
  0.000001;

const VALID_CURVES:
  readonly SetlistCurve[] = [
    'equal-power',
    'linear',
    'fast-cut',
  ];

const VALID_LOUDNESS:
  readonly SetlistLoudnessMode[] = [
    'off',
    'normalize',
  ];


/**
 * Empty project factory for Gate 4B.
 *
 * The project ID is supplied by the caller because
 * persistence owns identity generation, not the schema.
 */
export function createEmptyBuildV2ProjectDocument(
  projectId: string,
  name: string,
  timestamp = new Date().toISOString(),
): BuildV2ProjectDocumentV1 {
  return parseBuildV2ProjectDocument({
    kind:
      BUILD_V2_PROJECT_KIND,

    schemaVersion:
      BUILD_V2_PROJECT_SCHEMA_VERSION,

    projectId,
    name,

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    assets: [],
    tracks: [],
    transitions: [],

    transitionDefaults: {
      durationSeconds: 8,
      curve: 'equal-power',
    },

    finalFade: {
      enabled: false,
      durationSeconds: 8,
      curve: 'equal-power',
    },

    vignette: {
      enabled: false,
      assetId: null,
      mode: 'duck-overlay-v1',
    },

    render: {
      exportName:
        name,

      loudnessMode:
        'off',

      outputFormat:
        'wav',

      sampleRate:
        BUILD_V2_PROJECT_SAMPLE_RATE,

      channels:
        BUILD_V2_PROJECT_CHANNELS,
    },
  });
}


/**
 * The canonical boundary.
 *
 * Persistence adapters MUST pass loaded data through
 * this parser before restoring a BUILD V2 session.
 */
export function parseBuildV2ProjectDocument(
  input: unknown,
): BuildV2ProjectDocumentV1 {
  const root =
    expectRecord(
      input,
      'INVALID_DOCUMENT',
      'Project document must be an object.',
    );

  expectExactKeys(
    root,
    [
      'kind',
      'schemaVersion',
      'projectId',
      'name',
      'createdAt',
      'updatedAt',
      'assets',
      'tracks',
      'transitions',
      'transitionDefaults',
      'finalFade',
      'vignette',
      'render',
    ],
    'INVALID_DOCUMENT',
    'project',
  );

  if (
    root['kind']
    !== BUILD_V2_PROJECT_KIND
  ) {
    fail(
      'UNSUPPORTED_KIND',
      'Unsupported BUILD project kind.',
    );
  }

  if (
    root['schemaVersion']
    !== BUILD_V2_PROJECT_SCHEMA_VERSION
  ) {
    fail(
      'UNSUPPORTED_VERSION',
      'Unsupported BUILD project schema version.',
    );
  }

  const projectId =
    expectNonEmptyString(
      root['projectId'],
      128,
      'INVALID_FIELD',
      'projectId',
    );

  const name =
    expectNonEmptyString(
      root['name'],
      80,
      'INVALID_FIELD',
      'name',
    );

  const createdAt =
    expectCanonicalTimestamp(
      root['createdAt'],
      'createdAt',
    );

  const updatedAt =
    expectCanonicalTimestamp(
      root['updatedAt'],
      'updatedAt',
    );

  if (
    Date.parse(updatedAt)
    < Date.parse(createdAt)
  ) {
    fail(
      'INVALID_FIELD',
      'updatedAt cannot be earlier than createdAt.',
    );
  }

  const assets =
    expectArray(
      root['assets'],
      'INVALID_ASSET',
      'assets',
    ).map(
      (asset, index) =>
        parseAsset(
          asset,
          index,
        ),
    );

  const tracks =
    expectArray(
      root['tracks'],
      'INVALID_TRACK',
      'tracks',
    ).map(
      (track, index) =>
        parseTrack(
          track,
          index,
        ),
    );

  if (
    tracks.length
    > BUILD_V2_PROJECT_MAX_TRACKS
  ) {
    fail(
      'INVALID_TRACK',
      `BUILD V2 supports at most ${BUILD_V2_PROJECT_MAX_TRACKS} tracks.`,
    );
  }

  const transitions =
    expectArray(
      root['transitions'],
      'INVALID_TRANSITION',
      'transitions',
    ).map(
      (transition, index) =>
        parseTransition(
          transition,
          index,
        ),
    );

  const transitionDefaults =
    parseTransitionDefaults(
      root['transitionDefaults'],
    );

  const finalFade =
    parseFinalFade(
      root['finalFade'],
    );

  const vignette =
    parseVignette(
      root['vignette'],
    );

  const render =
    parseRender(
      root['render'],
    );

  const project:
    BuildV2ProjectDocumentV1 = {
      kind:
        BUILD_V2_PROJECT_KIND,

      schemaVersion:
        BUILD_V2_PROJECT_SCHEMA_VERSION,

      projectId,
      name,
      createdAt,
      updatedAt,

      assets,
      tracks,
      transitions,

      transitionDefaults,
      finalFade,
      vignette,
      render,
    };

  validateProject(
    project,
  );

  return project;
}


export function parseBuildV2ProjectJson(
  json: string,
): BuildV2ProjectDocumentV1 {
  let parsed: unknown;

  try {
    parsed =
      JSON.parse(json);
  } catch {
    fail(
      'INVALID_DOCUMENT',
      'Project JSON could not be parsed.',
    );
  }

  return parseBuildV2ProjectDocument(
    parsed,
  );
}


export function serializeBuildV2ProjectDocument(
  project:
    BuildV2ProjectDocumentV1,
): string {
  const canonical =
    parseBuildV2ProjectDocument(
      project,
    );

  return JSON.stringify(
    canonical,
    null,
    2,
  );
}


export function isBuildV2ProjectDocument(
  input: unknown,
): input is BuildV2ProjectDocumentV1 {
  try {
    parseBuildV2ProjectDocument(
      input,
    );

    return true;
  } catch {
    return false;
  }
}


function parseAsset(
  input: unknown,
  index: number,
): BuildV2ProjectAssetV1 {
  const record =
    expectRecord(
      input,
      'INVALID_ASSET',
      `Asset ${index} must be an object.`,
    );

  expectExactKeys(
    record,
    [
      'assetId',
      'originalFileName',
      'format',
      'sizeBytes',
      'durationSeconds',
    ],
    'INVALID_ASSET',
    `asset ${index}`,
  );

  const assetId =
    expectNonEmptyString(
      record['assetId'],
      128,
      'INVALID_ASSET',
      `asset ${index}.assetId`,
    );

  const originalFileName =
    expectNonEmptyString(
      record['originalFileName'],
      255,
      'INVALID_ASSET',
      `asset ${index}.originalFileName`,
    );

  const format =
    parseAudioFormat(
      record['format'],
      index,
    );

  if (
    format === 'wav'
    && !/\.wav$/i.test(
      originalFileName,
    )
  ) {
    fail(
      'INVALID_ASSET',
      `Asset ${index} format does not match its filename.`,
    );
  }

  if (
    format === 'mp3'
    && !/\.mp3$/i.test(
      originalFileName,
    )
  ) {
    fail(
      'INVALID_ASSET',
      `Asset ${index} format does not match its filename.`,
    );
  }

  const sizeBytes =
    expectInteger(
      record['sizeBytes'],
      1,
      Number.MAX_SAFE_INTEGER,
      'INVALID_ASSET',
      `asset ${index}.sizeBytes`,
    );

  const durationSeconds =
    expectFiniteNumber(
      record['durationSeconds'],
      'INVALID_ASSET',
      `asset ${index}.durationSeconds`,
    );

  if (
    durationSeconds <= 0
  ) {
    fail(
      'INVALID_ASSET',
      `Asset ${index} must have positive duration.`,
    );
  }

  return {
    assetId,
    originalFileName,
    format,
    sizeBytes,
    durationSeconds,
  };
}


function parseTrack(
  input: unknown,
  index: number,
): BuildV2ProjectTrackV1 {
  const record =
    expectRecord(
      input,
      'INVALID_TRACK',
      `Track ${index} must be an object.`,
    );

  expectExactKeys(
    record,
    [
      'trackId',
      'assetId',
      'state',
    ],
    'INVALID_TRACK',
    `track ${index}`,
  );

  const stateRecord =
    expectRecord(
      record['state'],
      'INVALID_TRACK',
      `Track ${index}.state must be an object.`,
    );

  expectExactKeys(
    stateRecord,
    [
      'trimStartSeconds',
      'trimEndSeconds',
      'gainDb',
      'pan',
    ],
    'INVALID_TRACK',
    `track ${index}.state`,
  );

  const rawEnd =
    stateRecord[
      'trimEndSeconds'
    ];

  const trimEndSeconds =
    rawEnd === null
      ? null
      : expectFiniteNumber(
          rawEnd,
          'INVALID_TRACK',
          `track ${index}.state.trimEndSeconds`,
        );

  return {
    trackId:
      expectNonEmptyString(
        record['trackId'],
        128,
        'INVALID_TRACK',
        `track ${index}.trackId`,
      ),

    assetId:
      expectNonEmptyString(
        record['assetId'],
        128,
        'INVALID_TRACK',
        `track ${index}.assetId`,
      ),

    state: {
      trimStartSeconds:
        expectFiniteNumber(
          stateRecord[
            'trimStartSeconds'
          ],
          'INVALID_TRACK',
          `track ${index}.state.trimStartSeconds`,
        ),

      trimEndSeconds,

      gainDb:
        expectFiniteNumber(
          stateRecord[
            'gainDb'
          ],
          'INVALID_TRACK',
          `track ${index}.state.gainDb`,
        ),

      pan:
        expectFiniteNumber(
          stateRecord[
            'pan'
          ],
          'INVALID_TRACK',
          `track ${index}.state.pan`,
        ),
    },
  };
}


function parseTransition(
  input: unknown,
  index: number,
): BuildV2ProjectTransitionV1 {
  const record =
    expectRecord(
      input,
      'INVALID_TRANSITION',
      `Transition ${index} must be an object.`,
    );

  expectExactKeys(
    record,
    [
      'fromTrackId',
      'toTrackId',
      'durationSeconds',
      'curve',
      'usesDefault',
    ],
    'INVALID_TRANSITION',
    `transition ${index}`,
  );

  return {
    fromTrackId:
      expectNonEmptyString(
        record['fromTrackId'],
        128,
        'INVALID_TRANSITION',
        `transition ${index}.fromTrackId`,
      ),

    toTrackId:
      expectNonEmptyString(
        record['toTrackId'],
        128,
        'INVALID_TRANSITION',
        `transition ${index}.toTrackId`,
      ),

    durationSeconds:
      expectFiniteNumber(
        record['durationSeconds'],
        'INVALID_TRANSITION',
        `transition ${index}.durationSeconds`,
      ),

    curve:
      expectCurve(
        record['curve'],
        'INVALID_TRANSITION',
        `transition ${index}.curve`,
      ),

    usesDefault:
      expectBoolean(
        record['usesDefault'],
        'INVALID_TRANSITION',
        `transition ${index}.usesDefault`,
      ),
  };
}


function parseTransitionDefaults(
  input: unknown,
): BuildV2ProjectTransitionDefaultsV1 {
  const record =
    expectRecord(
      input,
      'INVALID_TRANSITION',
      'transitionDefaults must be an object.',
    );

  expectExactKeys(
    record,
    [
      'durationSeconds',
      'curve',
    ],
    'INVALID_TRANSITION',
    'transitionDefaults',
  );

  const durationSeconds =
    expectFiniteNumber(
      record['durationSeconds'],
      'INVALID_TRANSITION',
      'transitionDefaults.durationSeconds',
    );

  const normalized =
    normalizeBuildV2TransitionDuration(
      durationSeconds,
      durationSeconds,
      BUILD_V2_TRANSITION_MAX_SECONDS,
    );

  if (
    normalized === null
    || !sameNumber(
      normalized,
      durationSeconds,
    )
  ) {
    fail(
      'INVALID_TRANSITION',
      'transitionDefaults.durationSeconds is not canonical.',
    );
  }

  return {
    durationSeconds,

    curve:
      expectCurve(
        record['curve'],
        'INVALID_TRANSITION',
        'transitionDefaults.curve',
      ),
  };
}


function parseFinalFade(
  input: unknown,
): BuildV2ProjectFinalFadeV1 {
  const record =
    expectRecord(
      input,
      'INVALID_FINAL_FADE',
      'finalFade must be an object.',
    );

  expectExactKeys(
    record,
    [
      'enabled',
      'durationSeconds',
      'curve',
    ],
    'INVALID_FINAL_FADE',
    'finalFade',
  );

  const durationSeconds =
    expectFiniteNumber(
      record['durationSeconds'],
      'INVALID_FINAL_FADE',
      'finalFade.durationSeconds',
    );

  if (
    durationSeconds
      < BUILD_V2_FINAL_FADE_MIN_SECONDS
    || durationSeconds
      > BUILD_V2_FINAL_FADE_MAX_SECONDS
  ) {
    fail(
      'INVALID_FINAL_FADE',
      'finalFade.durationSeconds is outside supported limits.',
    );
  }

  return {
    enabled:
      expectBoolean(
        record['enabled'],
        'INVALID_FINAL_FADE',
        'finalFade.enabled',
      ),

    durationSeconds,

    curve:
      expectCurve(
        record['curve'],
        'INVALID_FINAL_FADE',
        'finalFade.curve',
      ),
  };
}


function parseVignette(
  input: unknown,
): BuildV2ProjectVignetteV1 {
  const record =
    expectRecord(
      input,
      'INVALID_VIGNETTE',
      'vignette must be an object.',
    );

  expectExactKeys(
    record,
    [
      'enabled',
      'assetId',
      'mode',
    ],
    'INVALID_VIGNETTE',
    'vignette',
  );

  if (
    record['mode']
    !== 'duck-overlay-v1'
  ) {
    fail(
      'INVALID_VIGNETTE',
      'Unsupported vignette mode.',
    );
  }

  const assetId =
    record['assetId'];

  return {
    enabled:
      expectBoolean(
        record['enabled'],
        'INVALID_VIGNETTE',
        'vignette.enabled',
      ),

    assetId:
      assetId === null
        ? null
        : expectNonEmptyString(
            assetId,
            128,
            'INVALID_VIGNETTE',
            'vignette.assetId',
          ),

    mode:
      'duck-overlay-v1',
  };
}


function parseRender(
  input: unknown,
): BuildV2ProjectRenderV1 {
  const record =
    expectRecord(
      input,
      'INVALID_RENDER',
      'render must be an object.',
    );

  expectExactKeys(
    record,
    [
      'exportName',
      'loudnessMode',
      'outputFormat',
      'sampleRate',
      'channels',
    ],
    'INVALID_RENDER',
    'render',
  );

  if (
    record['outputFormat']
    !== 'wav'
  ) {
    fail(
      'INVALID_RENDER',
      'BUILD V2 project output format must be WAV.',
    );
  }

  if (
    record['sampleRate']
    !== BUILD_V2_PROJECT_SAMPLE_RATE
  ) {
    fail(
      'INVALID_RENDER',
      'BUILD V2 project sample rate must be 48000 Hz.',
    );
  }

  if (
    record['channels']
    !== BUILD_V2_PROJECT_CHANNELS
  ) {
    fail(
      'INVALID_RENDER',
      'BUILD V2 project output must be stereo.',
    );
  }

  const loudnessMode =
    record['loudnessMode'];

  if (
    typeof loudnessMode !== 'string'
    || !VALID_LOUDNESS.includes(
      loudnessMode as SetlistLoudnessMode,
    )
  ) {
    fail(
      'INVALID_RENDER',
      'Unsupported loudness mode.',
    );
  }

  return {
    exportName:
      expectNonEmptyString(
        record['exportName'],
        80,
        'INVALID_RENDER',
        'render.exportName',
      ),

    loudnessMode:
      loudnessMode as SetlistLoudnessMode,

    outputFormat:
      'wav',

    sampleRate:
      BUILD_V2_PROJECT_SAMPLE_RATE,

    channels:
      BUILD_V2_PROJECT_CHANNELS,
  };
}


function validateProject(
  project:
    BuildV2ProjectDocumentV1,
): void {
  const assetsById =
    new Map<
      string,
      BuildV2ProjectAssetV1
    >();

  for (
    const asset
    of project.assets
  ) {
    if (
      assetsById.has(
        asset.assetId,
      )
    ) {
      fail(
        'INVALID_ASSET',
        `Duplicate assetId: ${asset.assetId}`,
      );
    }

    assetsById.set(
      asset.assetId,
      asset,
    );
  }

  const trackIds =
    new Set<string>();

  const referencedAssetIds =
    new Set<string>();

  for (
    const track
    of project.tracks
  ) {
    if (
      trackIds.has(
        track.trackId,
      )
    ) {
      fail(
        'INVALID_TRACK',
        `Duplicate trackId: ${track.trackId}`,
      );
    }

    trackIds.add(
      track.trackId,
    );

    const asset =
      assetsById.get(
        track.assetId,
      );

    if (!asset) {
      fail(
        'INVALID_REFERENCE',
        `Track ${track.trackId} references a missing asset.`,
      );
    }

    referencedAssetIds.add(
      track.assetId,
    );

    validateCanonicalTrackState(
      track,
      asset,
    );
  }

  validateTransitions(
    project,
    assetsById,
  );

  validateFinalFade(
    project,
    assetsById,
  );

  validateVignette(
    project,
    assetsById,
    referencedAssetIds,
  );

  for (
    const asset
    of project.assets
  ) {
    if (
      !referencedAssetIds.has(
        asset.assetId,
      )
    ) {
      fail(
        'INVALID_REFERENCE',
        `Asset ${asset.assetId} is not referenced by the project.`,
      );
    }
  }
}


function validateCanonicalTrackState(
  track:
    BuildV2ProjectTrackV1,
  asset:
    BuildV2ProjectAssetV1,
): void {
  const normalized =
    normalizeBuildV2TrackState(
      track.state,
      asset.durationSeconds,
    );

  if (
    !sameNumber(
      normalized.trimStartSeconds,
      track.state.trimStartSeconds,
    )
    || !sameNullableNumber(
      normalized.trimEndSeconds,
      track.state.trimEndSeconds,
    )
    || !sameNumber(
      normalized.gainDb,
      track.state.gainDb,
    )
    || !sameNumber(
      normalized.pan,
      track.state.pan,
    )
  ) {
    fail(
      'INVALID_TRACK',
      `Track ${track.trackId} state is not canonical.`,
    );
  }
}


function validateTransitions(
  project:
    BuildV2ProjectDocumentV1,
  assetsById:
    ReadonlyMap<
      string,
      BuildV2ProjectAssetV1
    >,
): void {
  const expectedCount =
    Math.max(
      0,
      project.tracks.length - 1,
    );

  if (
    project.transitions.length
    !== expectedCount
  ) {
    fail(
      'INVALID_TRANSITION',
      'Transition count must equal track count minus one.',
    );
  }

  const effectiveDurations =
    project.tracks.map(
      track => {
        const asset =
          assetsById.get(
            track.assetId,
          );

        if (!asset) {
          fail(
            'INVALID_REFERENCE',
            'Track asset disappeared during geometry validation.',
          );
        }

        return buildV2EffectiveRange(
          track.state,
          asset.durationSeconds,
        ).duration;
      },
    );

  project.transitions.forEach(
    (
      transition,
      index,
    ) => {
      const left =
        project.tracks[
          index
        ];

      const right =
        project.tracks[
          index + 1
        ];

      if (
        !left
        || !right
        || transition.fromTrackId
          !== left.trackId
        || transition.toTrackId
          !== right.trackId
      ) {
        fail(
          'INVALID_TRANSITION',
          `Transition ${index} does not match adjacent track order.`,
        );
      }

      const leftIncoming =
        index > 0
          ? project.transitions[
              index - 1
            ].durationSeconds
          : 0;

      const rightOutgoing =
        index + 1
          < project.transitions.length
          ? project.transitions[
              index + 1
            ].durationSeconds
          : 0;

      const maximum =
        buildV2TransitionMaxDuration(
          effectiveDurations[
            index
          ],
          effectiveDurations[
            index + 1
          ],
          leftIncoming,
          rightOutgoing,
        );

      const normalized =
        normalizeBuildV2TransitionDuration(
          transition.durationSeconds,
          transition.durationSeconds,
          maximum,
        );

      if (
        normalized === null
        || !sameNumber(
          normalized,
          transition.durationSeconds,
        )
      ) {
        fail(
          'INVALID_GEOMETRY',
          `Transition ${index} is invalid for the effective track geometry.`,
        );
      }

      if (
        transition.usesDefault
        && (
          !sameNumber(
            transition.durationSeconds,
            project
              .transitionDefaults
              .durationSeconds,
          )
          || transition.curve
            !== project
              .transitionDefaults
              .curve
        )
      ) {
        fail(
          'INVALID_TRANSITION',
          `Transition ${index} claims default inheritance but differs from project defaults.`,
        );
      }
    },
  );
}


function validateFinalFade(
  project:
    BuildV2ProjectDocumentV1,
  assetsById:
    ReadonlyMap<
      string,
      BuildV2ProjectAssetV1
    >,
): void {
  if (
    !project.finalFade.enabled
  ) {
    return;
  }

  const lastTrack =
    project.tracks.at(-1);

  if (!lastTrack) {
    fail(
      'INVALID_FINAL_FADE',
      'Final Fade cannot be enabled without a track.',
    );
  }

  const asset =
    assetsById.get(
      lastTrack.assetId,
    );

  if (!asset) {
    fail(
      'INVALID_REFERENCE',
      'Final Fade track asset is missing.',
    );
  }

  const effectiveDuration =
    buildV2EffectiveRange(
      lastTrack.state,
      asset.durationSeconds,
    ).duration;

  const incomingDuration =
    project.transitions.at(-1)
      ?.durationSeconds
    ?? 0;

  const maximum =
    buildV2FinalFadeMaxDuration(
      effectiveDuration,
      incomingDuration,
    );

  const normalized =
    normalizeBuildV2FinalFadeState(
      {
        enabled:
          project.finalFade.enabled,

        duration:
          project.finalFade
            .durationSeconds,

        curve:
          project.finalFade.curve,
      },
      maximum,
    );

  if (
    !normalized.enabled
    || !sameNumber(
      normalized.duration,
      project.finalFade
        .durationSeconds,
    )
    || normalized.curve
      !== project.finalFade.curve
  ) {
    fail(
      'INVALID_FINAL_FADE',
      'Final Fade is invalid for the last-track geometry.',
    );
  }
}


function validateVignette(
  project:
    BuildV2ProjectDocumentV1,
  assetsById:
    ReadonlyMap<
      string,
      BuildV2ProjectAssetV1
    >,
  referencedAssetIds:
    Set<string>,
): void {
  if (
    !project.vignette.enabled
  ) {
    if (
      project.vignette.assetId
      !== null
    ) {
      fail(
        'INVALID_VIGNETTE',
        'Disabled vignette must use assetId = null.',
      );
    }

    return;
  }

  const vignetteAssetId =
    project.vignette.assetId;

  if (!vignetteAssetId) {
    fail(
      'INVALID_VIGNETTE',
      'Enabled vignette requires an assetId.',
    );
  }

  if (
    referencedAssetIds.has(
      vignetteAssetId,
    )
  ) {
    fail(
      'INVALID_VIGNETTE',
      'Vignette asset must be separate from music-track assets.',
    );
  }

  const asset =
    assetsById.get(
      vignetteAssetId,
    );

  if (!asset) {
    fail(
      'INVALID_REFERENCE',
      'Vignette references a missing asset.',
    );
  }

  if (
    asset.durationSeconds
    > BUILD_V2_VIGNETTE_MAX_SECONDS
  ) {
    fail(
      'INVALID_VIGNETTE',
      `Vignette exceeds ${BUILD_V2_VIGNETTE_MAX_SECONDS} seconds.`,
    );
  }

  referencedAssetIds.add(
    vignetteAssetId,
  );
}


function parseAudioFormat(
  value: unknown,
  index: number,
): BuildV2ProjectAudioFormat {
  if (
    value === 'wav'
    || value === 'mp3'
  ) {
    return value;
  }

  fail(
    'INVALID_ASSET',
    `Asset ${index} has unsupported audio format.`,
  );
}


function expectCurve(
  value: unknown,
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): SetlistCurve {
  if (
    typeof value !== 'string'
    || !VALID_CURVES.includes(
      value as SetlistCurve,
    )
  ) {
    fail(
      code,
      `${label} has unsupported curve.`,
    );
  }

  return value as SetlistCurve;
}


function expectCanonicalTimestamp(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== 'string'
  ) {
    fail(
      'INVALID_FIELD',
      `${label} must be an ISO timestamp.`,
    );
  }

  const timestamp =
    Date.parse(value);

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    fail(
      'INVALID_FIELD',
      `${label} must be a valid ISO timestamp.`,
    );
  }

  const canonical =
    new Date(
      timestamp,
    ).toISOString();

  if (
    canonical !== value
  ) {
    fail(
      'INVALID_FIELD',
      `${label} must use canonical UTC ISO format.`,
    );
  }

  return value;
}


function expectNonEmptyString(
  value: unknown,
  maxLength: number,
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): string {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > maxLength
  ) {
    fail(
      code,
      `${label} must be non-empty text with at most ${maxLength} characters.`,
    );
  }

  return value;
}


function expectFiniteNumber(
  value: unknown,
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(
      value,
    )
  ) {
    fail(
      code,
      `${label} must be a finite number.`,
    );
  }

  return value;
}


function expectInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(
      value,
    )
    || value < minimum
    || value > maximum
  ) {
    fail(
      code,
      `${label} must be a safe integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}


function expectBoolean(
  value: unknown,
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): boolean {
  if (
    typeof value !== 'boolean'
  ) {
    fail(
      code,
      `${label} must be boolean.`,
    );
  }

  return value;
}


function expectArray(
  value: unknown,
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): unknown[] {
  if (
    !Array.isArray(value)
  ) {
    fail(
      code,
      `${label} must be an array.`,
    );
  }

  return value;
}


function expectRecord(
  value: unknown,
  code:
    BuildV2ProjectSchemaErrorCode,
  message: string,
): Record<string, unknown> {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    fail(
      code,
      message,
    );
  }

  const prototype =
    Object.getPrototypeOf(
      value,
    );

  if (
    prototype !== Object.prototype
    && prototype !== null
  ) {
    fail(
      code,
      message,
    );
  }

  return value as Record<
    string,
    unknown
  >;
}


function expectExactKeys(
  record:
    Record<string, unknown>,
  expected:
    readonly string[],
  code:
    BuildV2ProjectSchemaErrorCode,
  label: string,
): void {
  const actual =
    Object.keys(
      record,
    );

  const missing =
    expected.filter(
      key =>
        !Object.prototype
          .hasOwnProperty
          .call(
            record,
            key,
          ),
    );

  const extra =
    actual.filter(
      key =>
        !expected.includes(
          key,
        ),
    );

  if (
    missing.length > 0
    || extra.length > 0
  ) {
    fail(
      code,
      `${label} has non-canonical fields. Missing: [${missing.join(', ')}]. Extra: [${extra.join(', ')}].`,
    );
  }
}


function sameNumber(
  left: number,
  right: number,
): boolean {
  return (
    Math.abs(
      left - right,
    )
    <= EPSILON
  );
}


function sameNullableNumber(
  left: number | null,
  right: number | null,
): boolean {
  if (
    left === null
    || right === null
  ) {
    return (
      left === right
    );
  }

  return sameNumber(
    left,
    right,
  );
}


function fail(
  code:
    BuildV2ProjectSchemaErrorCode,
  message: string,
): never {
  throw new BuildV2ProjectSchemaError(
    code,
    message,
  );
}
