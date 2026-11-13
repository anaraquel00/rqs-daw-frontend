import { parseBuildV2ProjectDocument } from './build-v2-project-schema';
import type { BuildV2ProjectDocumentV1 } from './build-v2-project-schema';

describe('BUILD V2 cloud project semantic parity fixtures', () => {
  function validProject(): BuildV2ProjectDocumentV1 {
    return {
      kind: 'rqs-build-project',
      schemaVersion: 1,
      projectId: '20000000-0000-4000-8000-000000000001',
      name: 'RQS PARITY',
      createdAt: '2026-11-13T20:30:00.000Z',
      updatedAt: '2026-11-13T20:30:00.000Z',
      assets: [
        {
          assetId: '30000000-0000-4000-8000-000000000001',
          originalFileName: 'track-a.wav',
          format: 'wav',
          sizeBytes: 1001,
          durationSeconds: 30,
        },
        {
          assetId: '30000000-0000-4000-8000-000000000002',
          originalFileName: 'track-b.mp3',
          format: 'mp3',
          sizeBytes: 1002,
          durationSeconds: 30,
        },
      ],
      tracks: [
        {
          trackId: 'track-1',
          assetId: '30000000-0000-4000-8000-000000000001',
          state: { trimStartSeconds: 1, trimEndSeconds: null, gainDb: -3, pan: -0.25 },
        },
        {
          trackId: 'track-2',
          assetId: '30000000-0000-4000-8000-000000000002',
          state: { trimStartSeconds: 0, trimEndSeconds: null, gainDb: 0, pan: 0.25 },
        },
      ],
      transitions: [{
        fromTrackId: 'track-1',
        toTrackId: 'track-2',
        durationSeconds: 4,
        curve: 'equal-power',
        usesDefault: true,
      }],
      transitionDefaults: { durationSeconds: 4, curve: 'equal-power' },
      finalFade: { enabled: true, durationSeconds: 6, curve: 'linear' },
      vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' },
      render: {
        exportName: 'RQS_PARITY',
        loudnessMode: 'off',
        outputFormat: 'wav',
        sampleRate: 48_000,
        channels: 2,
      },
    };
  }

  function invalid(mutator: (project: BuildV2ProjectDocumentV1) => void): void {
    const project = structuredClone(validProject());
    mutator(project);
    expect(() => parseBuildV2ProjectDocument(project)).toThrow();
  }

  it('accepts valid minimal', () => {
    const project = validProject();
    project.assets = [project.assets[0]];
    project.tracks = [project.tracks[0]];
    project.transitions = [];
    project.finalFade.enabled = false;
    expect(parseBuildV2ProjectDocument(project)).toEqual(project);
  });

  it('accepts valid complex', () => {
    expect(parseBuildV2ProjectDocument(validProject())).toEqual(validProject());
  });

  it('rejects invalid gain', () => invalid(project => {
    project.tracks[0].state.gainDb = 7;
  }));

  it('rejects invalid transition', () => invalid(project => {
    project.transitions[0].durationSeconds = 15.5;
  }));

  it('rejects invalid final fade', () => invalid(project => {
    project.finalFade.durationSeconds = 29;
  }));

  it('rejects invalid vignette', () => invalid(project => {
    project.vignette.enabled = true;
  }));

  it('rejects invalid reference', () => invalid(project => {
    project.tracks[0].assetId = '30000000-0000-4000-8000-000000000009';
  }));
});
