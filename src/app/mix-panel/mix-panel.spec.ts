import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { By, SafeUrl } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { MixPanelComponent, RQSTrack } from './mix-panel';
import { createBuildV2TrackState } from './build-v2-track-state';
import type {
  BuildV2ProjectDocumentV1,
} from './build-v2-project-schema';
import {
  BuildV2RenderDeployRequest,
  BuildV2RenderDeployResponse,
  DspService,
} from '../services/dsp';
import { AuthService } from '../services/auth.service';
import { AudioComparisonService } from '../services/audio-comparison.service';
import { AnalyticsService } from '../services/analytics.service';
import { PreviewWaveformComponent } from '../components/mastering-panel/preview-waveform';
import {
  BuildV2CloudProjectRestoreService,
  type BuildV2CloudProjectRestoreBundle,
} from '../services/build-v2-cloud-project-restore.service';
import {
  BuildV2CloudProjectAuthoringService,
  type BuildV2CloudProjectSaveRequest,
  type BuildV2CloudProjectSaveResult,
} from '../services/build-v2-cloud-project-authoring.service';

describe('MixPanelComponent Setlist Stage 1 contract', () => {
  const session = signal<{ access_token: string; user: { id: string } } | null>({
    access_token: 'test-token',
    user: { id: 'user-id' },
  });
  const userRole = signal<'free' | 'premium'>('premium');

  let generateMixS3: jasmine.Spy;
  let renderDeployBuildV2Setlist: jasmine.Spy;
  let getSetlistPresignedUrl: jasmine.Spy;
  let uploadToS3: jasmine.Spy;
  let requestSignIn: jasmine.Spy;
  let listBuildV2CloudProjects: jasmine.Spy;
  let getBuildV2CloudQuota: jasmine.Spy;
  let restoreBuildV2CloudProject: jasmine.Spy;
  let saveBuildV2CloudProject: jasmine.Spy;
  let deleteBuildV2CloudProject: jasmine.Spy;
  let analytics: { trackEvent: jasmine.Spy };
  let audioComparison: {
    audioProcessed: ReturnType<typeof signal<boolean>>;
    processedFilename: ReturnType<typeof signal<string>>;
  };
  let fixture: ComponentFixture<MixPanelComponent>;
  let component: MixPanelComponent;

  beforeEach(() => {
    generateMixS3 = jasmine.createSpy('generateMixS3').and.returnValue(of(renderResponse()));
    renderDeployBuildV2Setlist = jasmine.createSpy('renderDeployBuildV2Setlist')
      .and.returnValue(of(renderResponse()));
    getSetlistPresignedUrl = jasmine.createSpy('getSetlistPresignedUrl').and.returnValue(NEVER);
    uploadToS3 = jasmine.createSpy('uploadToS3').and.returnValue(NEVER);
    requestSignIn = jasmine.createSpy('requestSignIn');
    listBuildV2CloudProjects = jasmine.createSpy('listBuildV2CloudProjects')
      .and.returnValue(of({ projects: [] }));
    getBuildV2CloudQuota = jasmine.createSpy('getBuildV2CloudQuota')
      .and.returnValue(of({
        plan: 'pro',
        projects: { used: 0, limit: 100, remaining: 100, canCreate: true },
        storage: {
          confirmedBytes: 0,
          reservedBytes: 0,
          usedBytes: 0,
          limitBytes: 50 * 1024 ** 3,
          remainingBytes: 50 * 1024 ** 3,
          canReserve: true,
        },
      }));
    restoreBuildV2CloudProject = jasmine.createSpy('restoreBuildV2CloudProject');
    saveBuildV2CloudProject = jasmine.createSpy('saveBuildV2CloudProject');
    deleteBuildV2CloudProject = jasmine.createSpy('deleteBuildV2CloudProject');
    analytics = { trackEvent: jasmine.createSpy('trackEvent') };
    audioComparison = {
      audioProcessed: signal(false),
      processedFilename: signal(''),
    };
    session.set({ access_token: 'test-token', user: { id: 'user-id' } });
    userRole.set('premium');

    TestBed.configureTestingModule({
      imports: [MixPanelComponent],
      providers: [
        provideRouter([]),
        {
          provide: DspService,
          useValue: {
            generateMixS3,
            renderDeployBuildV2Setlist,
            getSetlistPresignedUrl,
            uploadToS3,
            listBuildV2CloudProjects,
            getBuildV2CloudQuota,
          },
        },
        {
          provide: BuildV2CloudProjectRestoreService,
          useValue: { restoreBuildV2CloudProject },
        },
        {
          provide: BuildV2CloudProjectAuthoringService,
          useValue: {
            save: saveBuildV2CloudProject,
            delete: deleteBuildV2CloudProject,
          },
        },
        { provide: AuthService, useValue: { session, userRole, requestSignIn } },
        { provide: AudioComparisonService, useValue: audioComparison },
        { provide: AnalyticsService, useValue: analytics },
      ],
    });

    fixture = TestBed.createComponent(MixPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
  });

  for (const count of [1, 2, 3]) {
    it(`reconciles ${count} tracks into exactly ${count - 1} directed transitions`, () => {
      component.tracks = readyTracks(count);
      expect(component.transitions.length).toBe(count - 1);
      component.transitions.forEach((t, i) => {
        expect(t.fromTrackId).toBe(component.tracks[i].id);
        expect(t.toTrackId).toBe(component.tracks[i + 1].id);
        expect(t.duration).toBe(8);
        expect(t.curve).toBe('equal-power');
        expect(t.usesDefault).toBeTrue();
      });
    });
  }

  it('preserves stable IDs and exact surviving pair overrides on reorder', () => {
    const [a, b, c, d] = readyTracks(4);
    component.tracks = [a, b, c, d];
    component.editTransition(0, 3, 'fast-cut');
    component.moveUp(3);
    expect(component.tracks.map(t => t.id)).toEqual([a.id, b.id, d.id, c.id]);
    expect(component.transitions[0]).toEqual({ fromTrackId: a.id, toTrackId: b.id, duration: 3, curve: 'fast-cut', usesDefault: false });
    expect(component.transitions.slice(1).every(t => t.usesDefault && t.duration === 8)).toBeTrue();
    component.moveDown(0);
    expect(component.transitions[0].fromTrackId).toBe(b.id);
    expect(component.transitions[0].toTrackId).toBe(a.id);
    expect(component.transitions[0].usesDefault).toBeTrue();
  });

  it('removing a middle track creates a new default pair without transferring overrides', () => {
    component.tracks = readyTracks(3);
    const [a, , c] = component.tracks;
    component.editTransition(0, 3, 'linear');
    component.removeTrack(1);
    expect(component.transitions).toEqual([{ fromTrackId: a.id, toTrackId: c.id, duration: 8, curve: 'equal-power', usesDefault: true }]);
  });

  it('adding a track reconciles the new pair and preserves the existing override', () => {
    component.tracks = readyTracks(2);
    component.editTransition(0, 3, 'linear');
    const preserved = component.transitions[0];
    component.onFileSelect({ target: { files: audioFiles(1, 3), value: '' } } as unknown as Event);
    expect(component.transitions.length).toBe(2);
    expect(component.transitions[0]).toBe(preserved);
    expect(component.transitions[1].toTrackId).toBe(component.tracks[2].id);
    expect(component.transitions[1].usesDefault).toBeTrue();
  });

  it('replacement preserves slot identity and both adjacent transitions', () => {
    component.tracks = readyTracks(3);
    const id = component.tracks[1].id;
    component.editTransition(0, 3, 'linear');
    const before = [...component.transitions];
    component.replaceTrackFile(1, { target: { files: audioFiles(1, 9), value: '' } } as unknown as Event);
    expect(component.tracks[1].id).toBe(id);
    expect(component.transitions).toEqual(before);
  });

  it('individual edit affects only that pair and default changes preserve custom overrides', () => {
    component.tracks = readyTracks(3);
    component.editTransition(0, 3, 'fast-cut');
    expect(component.transitions[0].usesDefault).toBeFalse();
    expect(component.transitions[1].duration).toBe(8);
    component.updateDefaults(5, 'linear');
    expect(component.transitions.map(t => [t.duration, t.curve, t.usesDefault])).toEqual([
      [3, 'fast-cut', false], [5, 'linear', true],
    ]);
  });

  it('Apply to all deliberately replaces overrides and reset restores current defaults', () => {
    component.tracks = readyTracks(3);
    component.editTransition(0, 3, 'fast-cut');
    component.updateDefaults(5, 'linear');
    component.resetTransition(0);
    expect(component.transitions[0].usesDefault).toBeTrue();
    expect(component.transitions[0].duration).toBe(5);
    component.editTransition(1, 4, 'equal-power');
    component.applyDefaultsToAll();
    expect(component.transitions.every(t => t.duration === 5 && t.curve === 'linear' && t.usesDefault)).toBeTrue();
  });

  it('sends ordered heterogeneous curves and durations in the canonical BUILD V2 project', async () => {
    component.tracks = readyTracks(3);
    component.editTransition(1, 3, 'fast-cut');
    spyOn(HTMLAnchorElement.prototype, 'click');
    await component.igniteSetlist();
    const payload = renderDeployBuildV2Setlist.calls.mostRecent().args[0] as BuildV2RenderDeployRequest;
    expect(payload.project.transitions.map(item => item.durationSeconds)).toEqual([8, 3]);
    expect(payload.project.transitions.map(item => item.curve)).toEqual(['equal-power', 'fast-cut']);
    expect(payload.project.transitionDefaults.curve).toBe('equal-power');
    expect(generateMixS3).not.toHaveBeenCalled();
    expect(component.calculateCrossfadeDuration()).toBe(11);
    expect(component.calculateEstimatedOutputDuration()).toBe(169);
  });

  for (const testCase of [
    { input: 0, expected: 0.5 },
    { input: 0.49, expected: 0.5 },
    { input: 16, expected: 15 },
    { input: 60, expected: 15 },
    { input: NaN, expected: 8 },
  ]) {
    it(
      `normalizes transition duration ${testCase.input} to ${testCase.expected}`,
      () => {
        component.tracks = readyTracks(2);

        component.editTransition(
          0,
          testCase.input,
          'linear',
        );

        expect(
          component.transitions[0].duration,
        ).toBe(testCase.expected);

        expect(
          component.transitions[0].curve,
        ).toBe('linear');

        expect(
          component.canPreviewTransition(0),
        ).toBeTrue();

        expect(
          component.canIgniteSetlist(),
        ).toBeTrue();
      },
    );
  }

  it('renders fixed track controls and one shared timeline lane per track', () => {
    component.tracks = readyTracks(3);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.daw-track-row').length
    ).toBe(3);

    expect(
      fixture.nativeElement.querySelectorAll('.daw-track-controls').length
    ).toBe(3);

    expect(
      fixture.nativeElement.querySelectorAll('.daw-track-lane').length
    ).toBe(3);

    expect(
      fixture.nativeElement.querySelectorAll('.daw-transition-row').length
    ).toBe(2);

    expect(
      fixture.nativeElement.querySelector('.daw-track-row.selected')
    ).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector('.transition-editor')
    ).toBeNull();

    component.toggleTransition(component.transitions[0]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.transition-editor').length
    ).toBe(1);
  });

  for (const language of ['en', 'pt', 'pl', 'fr'] as const) {
    it(`provides localized transition editing in ${language}`, () => {
      component.lang.currentLang.set(language);
      component.tracks = readyTracks(2);
      component.toggleTransition(component.transitions[0]);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(component.transitionCopy('defaults'));
      expect(fixture.nativeElement.textContent).toContain(component.transitionCopy('reset'));
      expect(component.transitionCopy('limits').length).toBeGreaterThan(10);
      component.lang.currentLang.set('en');
    });
  }

  it('clears transitions with the existing owner-switch lifecycle', fakeAsync(() => {
    component.tracks = readyTracks(3);
    component.editTransition(0, 3, 'fast-cut');
    session.set({ access_token: 'owner-b-token', user: { id: 'owner-b' } });
    fixture.detectChanges();
    flushMicrotasks();
    expect(component.tracks).toEqual([]);
    expect(component.transitions).toEqual([]);
    component.tracks = readyTracks(2);
    expect(component.transitions[0].usesDefault).toBeTrue();
    expect(component.transitions[0].duration).toBe(8);
  }));

  it('previews the exact selected pair, duration and curve independently of the default', fakeAsync(() => {
    component.tracks = readyTracks(3);
    component.editTransition(0, 8, 'linear');
    component.editTransition(1, 3, 'fast-cut');
    const internal = component as any;
    internal.playerElement1 = { src: '', currentTime: 0, play: () => Promise.resolve(), pause: () => {} };
    internal.playerElement2 = { src: '', currentTime: 0, play: () => Promise.resolve(), pause: () => {} };
    internal.audioCtx = { state: 'running', currentTime: 0, close: () => Promise.resolve() };
    internal.gainNode1 = { gain: { setValueAtTime: () => {} } };
    internal.gainNode2 = { gain: { setValueAtTime: () => {} } };
    spyOn(internal, 'initializeWebAudio').and.returnValue(true);
    const apply = spyOn(internal, 'applyCrossfadeCurve');
    for (const [index, duration, curve] of [[0, 8, 'linear'], [1, 3, 'fast-cut']] as const) {
      void component.previewTransition(index);
      flushMicrotasks();
      expect(internal.playerElement1.src).toBe(component.tracks[index].rawUrl);
      expect(internal.playerElement2.src).toBe(component.tracks[index + 1].rawUrl);
      tick(12200);
      flushMicrotasks();
      expect(apply).toHaveBeenCalledWith(duration, curve);
      component.stopTransitionPreview();
    }
  }));

  for (const testCase of [
    { duration: 240, requestedFade: 8 },
    { duration: 10, requestedFade: 3 },
    { duration: 3.5, requestedFade: 3 },
    { duration: 3.001, requestedFade: 3 },
  ]) {
    it(
      `aligns preview overlap for ${testCase.duration}s source and requested ${testCase.requestedFade}s transition`,
      fakeAsync(() => {
        component.tracks = readyTracks(2);

        component.tracks[0].duration =
          testCase.duration;

        component.editTransition(
          0,
          testCase.requestedFade,
          'linear',
        );

        const effectiveFade =
          component.transitions[0].duration;

        const expectedLead =
          Math.min(
            12,
            Math.max(
              0,
              testCase.duration
                - effectiveFade,
            ),
          );

        const expectedStart =
          Math.max(
            0,
            testCase.duration
              - expectedLead
              - effectiveFade,
          );

        const outgoing =
          component.transitionRegion(
            0,
            'out',
          );

        const incoming =
          component.transitionRegion(
            1,
            'in',
          );

        const internal =
          component as any;

        const incomingPlay =
          jasmine
            .createSpy('incomingPlay')
            .and.returnValue(
              Promise.resolve(),
            );

        internal.playerElement1 = {
          src: '',
          currentTime: 0,
          play: () =>
            Promise.resolve(),
          pause: () => {},
        };

        internal.playerElement2 = {
          src: '',
          currentTime: 0,
          play: incomingPlay,
          pause: () => {},
        };

        internal.audioCtx = {
          state: 'running',
          currentTime: 0,
          close: () =>
            Promise.resolve(),
        };

        internal.gainNode1 = {
          gain: {
            setValueAtTime: () => {},
          },
        };

        internal.gainNode2 = {
          gain: {
            setValueAtTime: () => {},
          },
        };

        spyOn(
          internal,
          'initializeWebAudio',
        ).and.returnValue(true);

        const apply =
          spyOn(
            internal,
            'applyCrossfadeCurve',
          );

        void component.previewTransition(0);

        flushMicrotasks();

        expect(
          internal.playerElement1.currentTime,
        ).toBeCloseTo(
          expectedStart,
          8,
        );

        expect(
          expectedStart + expectedLead,
        ).toBeCloseTo(
          outgoing!.start,
          8,
        );

        const beforeOverlapMs =
          Math.max(
            0,
            Math.floor(
              expectedLead * 1000,
            ) - 100,
          );

        tick(beforeOverlapMs);
        flushMicrotasks();

        expect(
          incomingPlay,
        ).not.toHaveBeenCalled();

        tick(200);
        flushMicrotasks();

        expect(
          incomingPlay,
        ).toHaveBeenCalledTimes(1);

        expect(
          internal.playerElement2.currentTime,
        ).toBe(
          incoming!.start,
        );

        expect(
          apply,
        ).toHaveBeenCalledWith(
          effectiveFade,
          'linear',
        );

        component.stopTransitionPreview();
      }),
    );
  }

  it(
    'clamps an oversized overlap to valid track geometry',
    () => {
      component.tracks = readyTracks(2);

      component.tracks[0].duration = 2;

      component.editTransition(
        0,
        3,
        'linear',
      );

      expect(
        component.transitions[0].duration,
      ).toBe(1.5);

      expect(
        component.canPreviewTransition(0),
      ).toBeTrue();

      const outgoing =
        component.transitionRegion(
          0,
          'out',
        );

      expect(
        outgoing?.start,
      ).toBeCloseTo(
        0.5,
        8,
      );

      expect(
        outgoing?.end,
      ).toBeCloseTo(
        2,
        8,
      );
    },
  );

  it('allows render preparation when a music upload is not ready yet', () => {
    component.tracks = [
      track('track-01.wav', 60, 'ready', 'uploads/user-id/setlist/track-01.wav'),
      track('track-02.wav', 60, 'uploading', null),
    ];

    expect(component.canIgniteSetlist()).toBeTrue();

    component.tracks[1].uploadState = 'ready';
    component.tracks[1].s3Key = 'uploads/user-id/setlist/track-02.wav';
    expect(component.canIgniteSetlist()).toBeTrue();
  });

  it('reuses ready inputs, uploads missing inputs and preserves exact asset identity', async () => {
    const ready = track(
      'ready.wav',
      60,
      'ready',
      'uploads/user-id/setlist/ready.wav',
    );
    const missing = track('missing.wav', 60, 'idle', null);
    component.tracks = [ready, missing];
    getSetlistPresignedUrl.and.returnValue(of({
      uploadUrl: 'https://s3.example.test/missing-put',
      s3Key: 'uploads/user-id/setlist/missing.wav',
    }));
    uploadToS3.and.returnValue(of(null));
    spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    expect(getSetlistPresignedUrl).toHaveBeenCalledOnceWith('missing.wav');
    expect(uploadToS3).toHaveBeenCalledTimes(1);
    const payload = renderDeployBuildV2Setlist.calls.mostRecent().args[0] as BuildV2RenderDeployRequest;
    expect(payload.sources).toEqual([
      { assetId: ready.assetId, s3Key: 'uploads/user-id/setlist/ready.wav' },
      { assetId: missing.assetId, s3Key: 'uploads/user-id/setlist/missing.wav' },
    ]);
    expect(payload.project.assets.map(asset => asset.assetId)).toEqual(
      payload.sources.map(source => source.assetId),
    );
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('aborts before the render request when any missing input upload fails', async () => {
    component.tracks = [
      track('first.wav', 60, 'ready', 'uploads/user-id/setlist/first.wav'),
      track('missing.wav', 60, 'idle', null),
    ];
    getSetlistPresignedUrl.and.returnValue(of({
      uploadUrl: 'https://s3.example.test/missing-put',
      s3Key: 'uploads/user-id/setlist/missing.wav',
    }));
    uploadToS3.and.returnValue(throwError(() => new Error('UPLOAD_FAILED')));

    await component.igniteSetlist();

    expect(renderDeployBuildV2Setlist).not.toHaveBeenCalled();
    expect(generateMixS3).not.toHaveBeenCalled();
    expect(component.isProcessing).toBeFalse();
    expect(component.setlistError).toBe(component.localCopy('serverError'));
  });

  it('blocks normalize explicitly before upload and server render', async () => {
    component.tracks = readyTracks(2);
    component.setLoudnessMode('normalize');

    await component.igniteSetlist();

    expect(component.canIgniteSetlist()).toBeFalse();
    expect(component.setlistError).toBe(component.buildV2Copy('renderBlocked'));
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(renderDeployBuildV2Setlist).not.toHaveBeenCalled();
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('keeps BUILD V2 neutral by default so server render remains available', () => {
    component.tracks = readyTracks(2);
    expect(component.hasBuildV2Adjustments()).toBeFalse();
    expect(component.canIgniteSetlist()).toBeTrue();
  });

  it('applies non-destructive BUILD V2 trim, gain and pan to the local track contract', () => {
    component.tracks = readyTracks(2);
    component.updateBuildV2Track(0, {
      trimStartSeconds: 10,
      trimEndSeconds: 50,
      gainDb: -6,
      pan: 0.25,
    });

    expect(component.tracks[0].v2).toEqual({
      trimStartSeconds: 10,
      trimEndSeconds: 50,
      gainDb: -6,
      pan: 0.25,
    });
    expect(component.effectiveRange(component.tracks[0])).toEqual({
      start: 10,
      end: 50,
      duration: 40,
    });
    expect(component.hasBuildV2Adjustments()).toBeTrue();
  });

  it('renders BUILD V2 adjustments on the new endpoint without invoking the legacy renderer', async () => {
    component.tracks = readyTracks(2);
    component.updateBuildV2Track(0, { gainDb: -3 });
    const download = spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    expect(generateMixS3).not.toHaveBeenCalled();
    expect(renderDeployBuildV2Setlist).toHaveBeenCalledTimes(1);
    const payload = renderDeployBuildV2Setlist.calls.mostRecent().args[0] as BuildV2RenderDeployRequest;
    expect(payload.project.tracks[0].state.gainDb).toBe(-3);
    expect(component.setlistError).toBeNull();
    expect(download).toHaveBeenCalledTimes(1);

    component.resetAllBuildV2Tracks();
    expect(component.hasBuildV2Adjustments()).toBeFalse();
    expect(component.canIgniteSetlist()).toBeTrue();
  });

  it('prepares a user-activated BUILD V2 WAV download without upload or server render', async () => {
    component.tracks = readyTracks(2);
    component.setlistName = 'Gate 4D / Restore';

    const rendered = {
      length: 1,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: () => new Float32Array([0]),
    } as unknown as AudioBuffer;

    spyOn(component, 'renderBuildV2PocAudioBuffer')
      .and.resolveTo(rendered);

    const createObjectUrl = spyOn(URL, 'createObjectURL')
      .and.returnValue('blob:gate-4d');

    const revokeObjectUrl = spyOn(URL, 'revokeObjectURL');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    await component.bounceBuildV2Wav();

    expect(createObjectUrl).toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(component.buildV2BounceDownloadUrl).toBe('blob:gate-4d');
    expect(component.buildV2BounceDownloadName).toBe('Gate_4D_Restore.wav');
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    expect(generateMixS3).not.toHaveBeenCalled();
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledOnceWith(
      'build_v2_local_wav_bounced',
    );
    expect(component.buildV2BounceRendering()).toBeFalse();
    expect(component.setlistError).toBeNull();

    fixture.destroy();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:gate-4d');
  });

  it('moves transition regions to the trimmed source boundaries', () => {
    component.tracks = readyTracks(2);
    component.updateBuildV2Track(0, { trimStartSeconds: 10, trimEndSeconds: 50 });
    component.updateBuildV2Track(1, { trimStartSeconds: 5, trimEndSeconds: 55 });

    const outgoing = component.transitionRegion(0, 'out');
    const incoming = component.transitionRegion(1, 'in');

    expect(outgoing?.start).toBe(42);
    expect(outgoing?.end).toBe(50);
    expect(incoming?.start).toBe(5);
    expect(incoming?.end).toBe(13);
  });

  it(
    'keeps compact track rows plus one fixed selected-track inspector',
    () => {
      component.tracks = readyTracks(2);

      fixture.detectChanges();

      expect(
        fixture.nativeElement
          .querySelectorAll(
            '.daw-track-controls',
          ).length,
      ).toBe(2);

      expect(
        fixture.nativeElement
          .querySelectorAll(
            '.daw-track-trim',
          ).length,
      ).toBe(0);

      expect(
        fixture.nativeElement
          .querySelector(
            '.daw-inspector',
          ),
      ).not.toBeNull();

      expect(
        fixture.nativeElement
          .querySelector(
            '.build-v2-advanced-panel',
          ),
      ).toBeNull();

      expect(
        fixture.nativeElement
          .querySelector(
            '.build-v2-daw',
          ),
      ).not.toBeNull();

      expect(
        getSetlistPresignedUrl,
      ).not.toHaveBeenCalled();

      expect(
        uploadToS3,
      ).not.toHaveBeenCalled();

      expect(
        generateMixS3,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'places gain, pan and trim controls in the selected-track inspector',
    () => {
      component.tracks = readyTracks(2);

      fixture.detectChanges();

      const gainSliders =
        fixture.nativeElement
          .querySelectorAll(
            '.track-control-gain',
          );

      const panSliders =
        fixture.nativeElement
          .querySelectorAll(
            '.track-control-pan',
          );

      const trimStartSliders =
        fixture.nativeElement
          .querySelectorAll(
            '.track-trim-start',
          );

      const trimEndSliders =
        fixture.nativeElement
          .querySelectorAll(
            '.track-trim-end',
          );

      expect(
        gainSliders.length,
      ).toBe(1);

      expect(
        panSliders.length,
      ).toBe(1);

      expect(
        trimStartSliders.length,
      ).toBe(1);

      expect(
        trimEndSliders.length,
      ).toBe(1);

      expect(
        gainSliders[0]
          .getAttribute('min'),
      ).toBe('-24');

      expect(
        gainSliders[0]
          .getAttribute('max'),
      ).toBe('6');

      expect(
        panSliders[0]
          .getAttribute('min'),
      ).toBe('-1');

      expect(
        panSliders[0]
          .getAttribute('max'),
      ).toBe('1');

      component.selectTrack(
        component.tracks[1],
      );

      fixture.detectChanges();

      expect(
        component.selectedTrackId,
      ).toBe(
        component.tracks[1].id,
      );
    },
  );

  it('maps sequential tracks onto one shared setlist timeline', () => {
    component.tracks = readyTracks(3);

    expect(component.calculateEstimatedOutputDuration()).toBe(164);

    expect(component.trackTimelineStartSeconds(0)).toBe(0);
    expect(component.trackTimelineStartSeconds(1)).toBe(52);
    expect(component.trackTimelineStartSeconds(2)).toBe(104);

    expect(component.trackTimelineLeftPercent(0)).toBe(0);
    expect(component.trackTimelineLeftPercent(1)).toBeCloseTo(
      100 * 52 / 164,
      6,
    );

    expect(
      component.trackTimelineLeftPercent(2)
      + component.trackTimelineWidthPercent(2)
    ).toBeCloseTo(100, 6);
  });

  it('preserves selected-track identity across a reorder', () => {
    component.tracks = readyTracks(3);
    const selected = component.tracks[1];

    component.selectTrack(selected);
    component.moveUp(1);

    expect(component.selectedTrack()?.id).toBe(selected.id);
    expect(component.selectedTrackIndex()).toBe(0);
  });

  it('falls back safely when the selected track is removed', () => {
    component.tracks = readyTracks(3);
    component.selectTrack(component.tracks[1]);

    component.removeTrack(1);

    expect(component.selectedTrack()).not.toBeNull();
    expect(component.tracks.some(track => (
      track.id === component.selectedTrack()?.id
    ))).toBeTrue();
  });

  it(
    'renders one compact interactive waveform for every local track',
    () => {
      component.tracks = readyTracks(3);

      fixture.detectChanges();

      const waveforms =
        fixture.debugElement.queryAll(
          By.directive(
            PreviewWaveformComponent,
          ),
        );

      expect(
        waveforms.length,
      ).toBe(3);

      for (
        const waveform
        of waveforms
      ) {
        const instance =
          waveform.componentInstance as PreviewWaveformComponent;

        expect(
          instance.compact,
        ).toBeTrue();

        expect(
          instance.compactInteractive,
        ).toBeTrue();

        expect(
          waveform.query(
            By.css('.preview-region'),
          ),
        ).toBeNull();
      }

      /*
       * Transport starts at global t=0.
       * Only Track 01 owns a local playhead then.
       */
      expect(
        fixture.debugElement
          .queryAll(
            By.css(
              '.waveform-local-playhead',
            ),
          ).length,
      ).toBe(1);
    },
  );

  it(
    'restores a canonical BUILD V2 project without network upload',
    () => {
      const fileA =
        new File(
          ['aaa'],
          'a.wav',
          {
            type:
              'audio/wav',
          },
        );

      const fileB =
        new File(
          ['bbbb'],
          'b.wav',
          {
            type:
              'audio/wav',
          },
        );

      const vignette =
        new File(
          ['id'],
          'id.wav',
          {
            type:
              'audio/wav',
          },
        );

      const project:
        BuildV2ProjectDocumentV1 = {
        kind:
          'rqs-build-project',

        schemaVersion:
          1,

        projectId:
          'restore-project',

        name:
          'RESTORE PROJECT',

        createdAt:
          '2026-11-13T18:00:00.000Z',

        updatedAt:
          '2026-11-13T19:00:00.000Z',

        assets: [
          {
            assetId:
              'asset-a',

            originalFileName:
              fileA.name,

            format:
              'wav',

            sizeBytes:
              fileA.size,

            durationSeconds:
              60,
          },
          {
            assetId:
              'asset-b',

            originalFileName:
              fileB.name,

            format:
              'wav',

            sizeBytes:
              fileB.size,

            durationSeconds:
              70,
          },
          {
            assetId:
              'asset-id',

            originalFileName:
              vignette.name,

            format:
              'wav',

            sizeBytes:
              vignette.size,

            durationSeconds:
              3,
          },
        ],

        tracks: [
          {
            trackId:
              'track-a',

            assetId:
              'asset-a',

            state: {
              trimStartSeconds:
                2,

              trimEndSeconds:
                55,

              gainDb:
                -3,

              pan:
                -0.25,
            },
          },
          {
            trackId:
              'track-b',

            assetId:
              'asset-b',

            state: {
              trimStartSeconds:
                1,

              trimEndSeconds:
                65,

              gainDb:
                1,

              pan:
                0.4,
            },
          },
        ],

        transitions: [
          {
            fromTrackId:
              'track-a',

            toTrackId:
              'track-b',

            durationSeconds:
              4,

            curve:
              'fast-cut',

            usesDefault:
              false,
          },
        ],

        transitionDefaults: {
          durationSeconds:
            8,

          curve:
            'equal-power',
        },

        finalFade: {
          enabled:
            true,

          durationSeconds:
            6,

          curve:
            'linear',
        },

        vignette: {
          enabled:
            true,

          assetId:
            'asset-id',

          mode:
            'duck-overlay-v1',
        },

        render: {
          exportName:
            'RESTORE_PROJECT',

          loudnessMode:
            'off',

          outputFormat:
            'wav',

          sampleRate:
            48_000,

          channels:
            2,
        },
      };

      component.restoreBuildV2Project(
        project,
        new Map([
          [
            'asset-a',
            fileA,
          ],
          [
            'asset-b',
            fileB,
          ],
          [
            'asset-id',
            vignette,
          ],
        ]),
      );

      expect(
        component.tracks.map(
          track =>
            track.id,
        ),
      ).toEqual([
        'track-a',
        'track-b',
      ]);

      expect(
        component.tracks.map(
          track =>
            track.assetId,
        ),
      ).toEqual([
        'asset-a',
        'asset-b',
      ]);

      expect(
        component.tracks[0].v2,
      ).toEqual({
        trimStartSeconds:
          2,

        trimEndSeconds:
          55,

        gainDb:
          -3,

        pan:
          -0.25,
      });

      expect(
        component.transitions[0],
      ).toEqual({
        fromTrackId:
          'track-a',

        toTrackId:
          'track-b',

        duration:
          4,

        curve:
          'fast-cut',

        usesDefault:
          false,
      });

      expect(
        component.finalFade,
      ).toEqual({
        enabled:
          true,

        duration:
          6,

        curve:
          'linear',
      });

      expect(
        component.vignetteEnabled,
      ).toBeTrue();

      expect(
        component.vignetteTrack
          ?.assetId,
      ).toBe(
        'asset-id',
      );

      expect(
        component.setlistName,
      ).toBe(
        'RESTORE_PROJECT',
      );

      /*
       * Local restore must never silently upload.
       */
      expect(
        getSetlistPresignedUrl,
      ).not.toHaveBeenCalled();

      expect(
        uploadToS3,
      ).not.toHaveBeenCalled();

      expect(
        generateMixS3,
      ).not.toHaveBeenCalled();
    },
  );

  it('keeps the CLOUD PROJECTS browser visible with an empty runtime', () => {
    component.tracks = [];
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[aria-label="BUILD V2 cloud projects"]'),
    ).not.toBeNull();
  });

  it('opens a cloud bundle through the existing restore pipeline and isolates local identity', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000011',
      'CLOUD B',
      4,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.activeLocalProjectId = 'local-a';
    component.activeLocalProjectCreatedAt = '2026-11-13T18:00:00.000Z';
    component.selectedCloudProjectId = bundle.project.projectId;

    await component.openBuildV2CloudProject();

    expect(component.tracks.map(track => track.id)).toEqual(['cloud-track-a', 'cloud-track-b']);
    expect(component.activeCloudProjectId).toBe(bundle.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(4);
    expect(component.activeCloudProjectBaseline).toEqual(bundle.project);
    expect(component.activeLocalProjectId).toBeNull();
    expect(component.activeLocalProjectCreatedAt).toBeNull();
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('commits a new cloud identity only after the authoring request succeeds', async () => {
    component.tracks = readyTracks(2);
    component.activeLocalProjectId = 'local-before-cloud';
    component.activeLocalProjectCreatedAt = '2026-11-13T18:00:00.000Z';
    listBuildV2CloudProjects.calls.reset();
    getBuildV2CloudQuota.calls.reset();
    saveBuildV2CloudProject.and.callFake((request: BuildV2CloudProjectSaveRequest) => {
      const result = cloudSaveResult(request, 1);
      listBuildV2CloudProjects.and.returnValue(of({
        projects: [result.response!.project],
      }));
      return of(result);
    });

    await component.saveBuildV2CloudProject();

    const request = saveBuildV2CloudProject.calls.mostRecent()
      .args[0] as BuildV2CloudProjectSaveRequest;
    expect(request.baseline).toBeNull();
    expect(request.expectedRevision).toBeNull();
    expect(component.activeCloudProjectId).toBe(request.snapshot.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(1);
    expect(component.activeCloudProjectBaseline).toEqual(request.snapshot.project);
    expect(component.activeLocalProjectId).toBeNull();
    expect(component.buildV2CloudStatus).toBe('saved');
    expect(component.cloudProjects.map(project => project.projectId)).toEqual([
      request.snapshot.project.projectId,
    ]);
    expect(listBuildV2CloudProjects).toHaveBeenCalledTimes(1);
    expect(getBuildV2CloudQuota).toHaveBeenCalledTimes(1);
  });

  it('preserves cloud identity and exposes the explicit no-op state', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000031',
      'NO OP',
      6,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.selectedCloudProjectId = bundle.project.projectId;
    await component.openBuildV2CloudProject();
    saveBuildV2CloudProject.and.callFake((request: BuildV2CloudProjectSaveRequest) => of({
      kind: 'upToDate' as const,
      project: request.baseline as BuildV2ProjectDocumentV1,
      response: null,
      quota: null,
      uploadedAssetIds: [],
      removedAssetIds: [],
    }));

    await component.saveBuildV2CloudProject();

    expect(component.activeCloudProjectId).toBe(bundle.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(6);
    expect(component.buildV2CloudStatus).toBe('upToDate');
  });

  it('keeps runtime and identities intact on a revision conflict', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000032',
      'CONFLICT',
      3,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.selectedCloudProjectId = bundle.project.projectId;
    await component.openBuildV2CloudProject();
    const tracksBefore = component.tracks;
    saveBuildV2CloudProject.and.returnValue(throwError(() => ({
      status: 412,
      error: { code: 'BUILD_PROJECT_REVISION_CONFLICT' },
    })));

    await component.saveBuildV2CloudProject();

    expect(component.tracks).toBe(tracksBefore);
    expect(component.activeCloudProjectId).toBe(bundle.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(3);
    expect(component.activeCloudProjectBaseline).toEqual(bundle.project);
    expect(component.buildV2CloudStatus).toBe('conflict');
  });

  it('maps a server-side quota race to the upgrade CTA without committing identity', async () => {
    component.tracks = readyTracks(2);
    saveBuildV2CloudProject.and.returnValue(throwError(() => ({
      status: 429,
      error: { code: 'BUILD_STORAGE_QUOTA_EXCEEDED' },
    })));

    await component.saveBuildV2CloudProject();

    expect(component.activeCloudProjectId).toBeNull();
    expect(component.activeCloudProjectRevision).toBeNull();
    expect(component.pricingUpgradeRequired()).toBeTrue();
    expect(component.buildV2CloudStatus).toBe('storageQuota');
  });

  it('preserves runtime and local identity when cloud project save fails', async () => {
    component.tracks = readyTracks(2);
    const tracksBefore = component.tracks;
    component.activeLocalProjectId = 'local-safe';
    component.activeLocalProjectCreatedAt = '2026-11-13T18:00:00.000Z';
    saveBuildV2CloudProject.and.returnValue(
      throwError(() => new Error('PROJECT_SAVE_FAILED')),
    );

    await component.saveBuildV2CloudProject();

    expect(component.tracks).toBe(tracksBefore);
    expect(component.activeLocalProjectId).toBe('local-safe');
    expect(component.activeCloudProjectId).toBeNull();
    expect(component.activeCloudProjectRevision).toBeNull();
    expect(component.buildV2CloudStatus).toBe('saveError');
    expect(renderDeployBuildV2Setlist).not.toHaveBeenCalled();
  });

  it('saves a conflicted runtime as a new cloud project with a fresh identity', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000033',
      'SAVE AS NEW',
      4,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.selectedCloudProjectId = bundle.project.projectId;
    await component.openBuildV2CloudProject();
    saveBuildV2CloudProject.and.callFake((request: BuildV2CloudProjectSaveRequest) => (
      of(cloudSaveResult(request, 1))
    ));

    await component.saveBuildV2CloudProject(true);

    const request = saveBuildV2CloudProject.calls.mostRecent()
      .args[0] as BuildV2CloudProjectSaveRequest;
    expect(request.baseline).toBeNull();
    expect(request.expectedRevision).toBeNull();
    expect(request.snapshot.project.projectId).not.toBe(bundle.project.projectId);
    expect(component.activeCloudProjectId).toBe(request.snapshot.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(1);
  });

  it('deletes a selected non-active project without changing active identity or runtime', async () => {
    const active = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000034',
      'ACTIVE',
      5,
    );
    restoreBuildV2CloudProject.and.returnValue(of(active));
    component.selectedCloudProjectId = active.project.projectId;
    await component.openBuildV2CloudProject();
    const tracksBefore = component.tracks;
    const otherId = '20000000-0000-4000-8000-000000000035';
    component.cloudProjects = [cloudSummary(otherId, 'OTHER', 2)];
    component.selectedCloudProjectId = otherId;
    deleteBuildV2CloudProject.and.returnValue(of({
      success: true,
      alreadyDeleted: false,
      projectId: otherId,
      finalRevision: 3,
      cleanupComplete: true,
      deletedAssets: 2,
      pendingAssets: 0,
    }));
    spyOn(window, 'confirm').and.returnValue(true);

    await component.deleteBuildV2CloudProject();

    expect(deleteBuildV2CloudProject).toHaveBeenCalledOnceWith(otherId, 2);
    expect(component.activeCloudProjectId).toBe(active.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(5);
    expect(component.tracks).toBe(tracksBefore);
    expect(component.buildV2CloudStatus).toBe('deleted');
  });

  it('clears only active cloud identity after deleting the active project', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000036',
      'DELETE ACTIVE',
      7,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.selectedCloudProjectId = bundle.project.projectId;
    await component.openBuildV2CloudProject();
    const tracksBefore = component.tracks;
    component.cloudProjects = [cloudSummary(bundle.project.projectId, bundle.project.name, 7)];
    deleteBuildV2CloudProject.and.returnValue(of({
      success: true,
      alreadyDeleted: false,
      projectId: bundle.project.projectId,
      finalRevision: 8,
      cleanupComplete: false,
      deletedAssets: 1,
      pendingAssets: 1,
    }));
    spyOn(window, 'confirm').and.returnValue(true);

    await component.deleteBuildV2CloudProject();

    expect(component.activeCloudProjectId).toBeNull();
    expect(component.activeCloudProjectRevision).toBeNull();
    expect(component.activeCloudProjectBaseline).toBeNull();
    expect(component.tracks).toBe(tracksBefore);
    expect(component.buildV2CloudStatus).toBe('cleanupPending');
  });

  it('preserves selected project and runtime when revision-aware delete is stale', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000037',
      'STALE DELETE',
      4,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.selectedCloudProjectId = bundle.project.projectId;
    await component.openBuildV2CloudProject();
    const summary = cloudSummary(bundle.project.projectId, bundle.project.name, 4);
    component.cloudProjects = [summary];
    const tracksBefore = component.tracks;
    deleteBuildV2CloudProject.and.returnValue(throwError(() => ({
      status: 412,
      error: { code: 'BUILD_PROJECT_REVISION_CONFLICT' },
    })));
    spyOn(window, 'confirm').and.returnValue(true);

    await component.deleteBuildV2CloudProject();

    expect(deleteBuildV2CloudProject).toHaveBeenCalledOnceWith(
      bundle.project.projectId,
      4,
    );
    expect(component.cloudProjects).toEqual([summary]);
    expect(component.tracks).toBe(tracksBefore);
    expect(component.activeCloudProjectId).toBe(bundle.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(4);
    expect(component.buildV2CloudStatus).toBe('conflict');
  });

  it('ignores a cloud save completion after logout', async () => {
    component.tracks = readyTracks(2);
    const pending = new Subject<BuildV2CloudProjectSaveResult>();
    saveBuildV2CloudProject.and.returnValue(pending);

    const saving = component.saveBuildV2CloudProject();
    session.set(null);
    const request = saveBuildV2CloudProject.calls.mostRecent()
      .args[0] as BuildV2CloudProjectSaveRequest;
    pending.next(cloudSaveResult(request, 1));
    pending.complete();
    await saving;

    expect(component.activeCloudProjectId).toBeNull();
    expect(component.activeCloudProjectRevision).toBeNull();
    expect(component.activeCloudProjectBaseline).toBeNull();
  });

  it('auto-uploads and renders a restored local project without changing its identity', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000021',
      'LOCAL RESTORE',
      1,
    );
    component.restoreBuildV2Project(bundle.project, bundle.files);
    component.activeLocalProjectId = 'local-restored-id';
    component.activeLocalProjectCreatedAt = bundle.project.createdAt;
    getSetlistPresignedUrl.and.callFake((filename: string) => of({
      uploadUrl: `https://s3.example.test/${filename}`,
      s3Key: `uploads/user-id/setlist/${filename}`,
    }));
    uploadToS3.and.returnValue(of(null));
    spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    expect(getSetlistPresignedUrl).toHaveBeenCalledTimes(2);
    expect(uploadToS3).toHaveBeenCalledTimes(2);
    expect(renderDeployBuildV2Setlist).toHaveBeenCalledTimes(1);
    expect(component.activeLocalProjectId).toBe('local-restored-id');
    expect(component.activeLocalProjectCreatedAt).toBe(bundle.project.createdAt);
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('auto-uploads and renders a restored cloud project without mutating cloud revision', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000022',
      'CLOUD RESTORE',
      7,
    );
    restoreBuildV2CloudProject.and.returnValue(of(bundle));
    component.selectedCloudProjectId = bundle.project.projectId;
    await component.openBuildV2CloudProject();
    getSetlistPresignedUrl.and.callFake((filename: string) => of({
      uploadUrl: `https://s3.example.test/${filename}`,
      s3Key: `uploads/user-id/setlist/${filename}`,
    }));
    uploadToS3.and.returnValue(of(null));
    spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    expect(getSetlistPresignedUrl).toHaveBeenCalledTimes(2);
    expect(uploadToS3).toHaveBeenCalledTimes(2);
    expect(renderDeployBuildV2Setlist).toHaveBeenCalledTimes(1);
    expect(component.activeCloudProjectId).toBe(bundle.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(7);
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('preserves the current runtime when cloud bundle preparation fails', async () => {
    const originalTracks = readyTracks(2);
    component.tracks = originalTracks;
    const originalTransitions = component.transitions;
    component.selectedCloudProjectId = '20000000-0000-4000-8000-000000000012';
    restoreBuildV2CloudProject.and.returnValue(
      throwError(() => new Error('asset 3 failed')),
    );

    await component.openBuildV2CloudProject();

    expect(component.tracks).toBe(originalTracks);
    expect(component.transitions).toBe(originalTransitions);
    expect(component.buildV2CloudStatus).toBe('error');
  });

  it('commits only the latest concurrent cloud open', async () => {
    const projectA = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000013',
      'CLOUD A',
      2,
    );
    const projectB = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000014',
      'CLOUD B',
      5,
    );
    const first = new Subject<BuildV2CloudProjectRestoreBundle>();
    const second = new Subject<BuildV2CloudProjectRestoreBundle>();
    restoreBuildV2CloudProject.and.returnValues(first, second);

    component.selectedCloudProjectId = projectA.project.projectId;
    const openA = component.openBuildV2CloudProject();
    component.selectedCloudProjectId = projectB.project.projectId;
    const openB = component.openBuildV2CloudProject();

    second.next(projectB);
    second.complete();
    await openB;
    first.next(projectA);
    first.complete();
    await openA;

    expect(component.activeCloudProjectId).toBe(projectB.project.projectId);
    expect(component.activeCloudProjectRevision).toBe(5);
    expect(component.setlistName).toBe('CLOUD B');
  });

  it('does not commit a cloud restore after logout', async () => {
    const bundle = cloudRestoreBundle(
      '20000000-0000-4000-8000-000000000015',
      'USER A CLOUD',
      3,
    );
    const pending = new Subject<BuildV2CloudProjectRestoreBundle>();
    restoreBuildV2CloudProject.and.returnValue(pending);
    component.selectedCloudProjectId = bundle.project.projectId;
    const originalTracks = readyTracks(1);
    component.tracks = originalTracks;

    const opening = component.openBuildV2CloudProject();
    session.set(null);
    pending.next(bundle);
    pending.complete();
    await opening;

    expect(component.tracks).toBe(originalTracks);
    expect(component.activeCloudProjectId).toBeNull();
    expect(component.activeCloudProjectRevision).toBeNull();
  });

  it('clears both local and cloud active identities on NEW', () => {
    component.activeLocalProjectId = 'local-a';
    component.activeLocalProjectCreatedAt = '2026-11-13T18:00:00.000Z';
    component.activeCloudProjectId = '20000000-0000-4000-8000-000000000016';
    component.activeCloudProjectRevision = 8;
    component.tracks = readyTracks(1);

    component.newBuildV2Project();

    expect(component.activeLocalProjectId).toBeNull();
    expect(component.activeLocalProjectCreatedAt).toBeNull();
    expect(component.activeCloudProjectId).toBeNull();
    expect(component.activeCloudProjectRevision).toBeNull();
  });


  it('renders local waveforms without starting additional network operations', () => {
    component.tracks = readyTracks(2);
    fixture.detectChanges();

    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('keeps Track 01 first and sends no vignette when the option is disabled', async () => {
    component.tracks = readyTracks(2);
    component.vignetteEnabled = false;
    spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    const payload = renderDeployBuildV2Setlist.calls.mostRecent().args[0] as BuildV2RenderDeployRequest;
    expect(payload.sources.map(item => item.s3Key)).toEqual([
      'uploads/user-id/setlist/track-01.wav',
      'uploads/user-id/setlist/track-02.wav',
    ]);
    expect(payload.project.vignette).toEqual({
      enabled: false,
      assetId: null,
      mode: 'duck-overlay-v1',
    });
    expect(payload.project.transitions.map(item => item.durationSeconds)).toEqual([8]);
    expect(payload.project.render.outputFormat).toBe('wav');
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('sends an enabled vignette separately instead of consuming Track 01', async () => {
    component.tracks = readyTracks(2);
    component.vignetteEnabled = true;
    component.vignetteTrack = track('id-drop.wav', 5, 'ready', 'uploads/user-id/setlist/id-drop.wav');
    spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    const payload = renderDeployBuildV2Setlist.calls.mostRecent().args[0] as BuildV2RenderDeployRequest;
    expect(payload.sources[0].s3Key).toBe('uploads/user-id/setlist/track-01.wav');
    expect(payload.project.vignette.assetId).toBe(component.vignetteTrack?.assetId ?? null);
    expect(payload.sources.at(-1)?.s3Key).toBe('uploads/user-id/setlist/id-drop.wav');
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('invalidates stale credentials when a track is removed', () => {
    const first = track('track-01.wav', 60, 'ready', 'uploads/user-id/setlist/track-01.wav');
    component.tracks = [first, ...readyTracks(1, 2)];
    spyOn(URL, 'revokeObjectURL');

    component.removeTrack(0);

    expect(first.s3Key).toBeNull();
    expect(first.uploadState).toBe('idle');
    expect(component.tracks[0].name).toBe('track-02.wav');
  });

  it('adds at most three local music files for Free without legacy upload', () => {
    userRole.set('free');
    stubTrackCreation();

    (component as any).addFiles(audioFiles(4));

    expect(component.tracks.length).toBe(3);
    expect(component.tracks.every(track => track.s3Key === null)).toBeTrue();
    expect(component.tracks.every(track => track.uploadState === 'idle')).toBeTrue();
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(component.setlistError).toContain('3');
  });

  it('selects two WAVs as local idle tracks without legacy upload', () => {
    stubTrackCreation();
    const input = {
      files: audioFiles(2),
      value: 'selected',
    } as unknown as HTMLInputElement;

    component.onFileSelect({ target: input } as unknown as Event);

    expect(component.tracks.length).toBe(2);
    expect(component.tracks.map(track => track.s3Key)).toEqual([null, null]);
    expect(component.tracks.map(track => track.uploadState)).toEqual(['idle', 'idle']);
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('adds at most eight local music files for Premium without legacy upload', () => {
    userRole.set('premium');
    stubTrackCreation();

    (component as any).addFiles(audioFiles(9));

    expect(component.tracks.length).toBe(8);
    expect(component.tracks.every(track => track.s3Key === null)).toBeTrue();
    expect(component.tracks.every(track => track.uploadState === 'idle')).toBeTrue();
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(component.setlistError).toContain('8');
  });

  it('keeps drag-and-drop tracks local without legacy upload', () => {
    stubTrackCreation();
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component.onFileDrop({
      preventDefault,
      stopPropagation,
      dataTransfer: { files: audioFiles(2) },
    } as unknown as DragEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(component.tracks.length).toBe(2);
    expect(component.tracks.every(track => track.s3Key === null)).toBeTrue();
    expect(component.tracks.every(track => track.uploadState === 'idle')).toBeTrue();
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('does not start presign or upload for a Free fourth music file', () => {
    userRole.set('free');
    component.tracks = readyTracks(3);
    stubTrackCreation();

    (component as any).addFiles(audioFiles(1, 4));

    expect(component.tracks.length).toBe(3);
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    fixture.detectChanges();
    const pricingLink = fixture.nativeElement.querySelector('.build-upgrade-card [data-testid="plan-upgrade-link"]') as HTMLAnchorElement;
    expect(pricingLink.getAttribute('href')).toBe('/pricing?from=build&intent=upgrade');
  });

  it('blocks anonymous track drop before accepting a local File', () => {
    session.set(null);
    stubTrackCreation();
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component.onFileDrop({
      preventDefault,
      stopPropagation,
      dataTransfer: { files: audioFiles(1) },
    } as unknown as DragEvent);

    expect(component.tracks.length).toBe(0);
    expect(requestSignIn).toHaveBeenCalledOnceWith('build');
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('blocks the anonymous BUILD picker before the native dialog opens', () => {
    session.set(null);
    const input = { click: jasmine.createSpy('click') } as unknown as HTMLInputElement;

    component.requestFileSelection(input);

    expect(requestSignIn).toHaveBeenCalledOnceWith('build');
    expect(input.click).not.toHaveBeenCalled();
  });

  it('keeps selection local while session restoration has no access token', () => {
    session.set({ access_token: '   ', user: { id: 'user-id' } });
    stubTrackCreation();

    (component as any).addFiles(audioFiles(1));

    expect(component.tracks.length).toBe(1);
    expect(component.tracks[0].s3Key).toBeNull();
    expect(component.tracks[0].uploadState).toBe('idle');
    expect(requestSignIn).not.toHaveBeenCalled();
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('re-reads the current session token when retrying after authentication', () => {
    const pendingTrack = track('retry.wav', 60, 'error', null);
    component.tracks = [pendingTrack];
    session.set(null);

    component.retryTrackUpload(0);

    expect(requestSignIn).toHaveBeenCalledWith('general');
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(pendingTrack.uploadState).toBe('error');

    session.set({ access_token: 'current-token', user: { id: 'user-id' } });
    component.retryTrackUpload(0);

    expect(getSetlistPresignedUrl).toHaveBeenCalledOnceWith('retry.wav');
    expect(pendingTrack.uploadState).toBe('uploading');
  });

  it('blocks anonymous vignette selection without accepting or uploading the File', () => {
    session.set(null);
    stubTrackCreation();
    const vignette = new File(['audio'], 'id-drop.wav', { type: 'audio/wav' });
    const input = { files: [vignette], value: 'selected' } as unknown as HTMLInputElement;

    component.onVignetteSelect({ target: input } as unknown as Event);

    expect(component.vignetteTrack).toBeNull();
    expect(requestSignIn).toHaveBeenCalledOnceWith('build');
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('blocks anonymous track replacement without mutating the existing track', () => {
    session.set(null);
    component.tracks = readyTracks(1);
    const existing = component.tracks[0];
    const replacement = new File(['audio'], 'replacement.wav', { type: 'audio/wav' });
    const input = { files: [replacement], value: 'selected' } as unknown as HTMLInputElement;

    component.replaceTrackFile(0, { target: input } as unknown as Event);

    expect(component.tracks[0]).toBe(existing);
    expect(requestSignIn).toHaveBeenCalledOnceWith('build');
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('uploads a local vignette only when server render starts', async () => {
    component.tracks = readyTracks(2);
    component.vignetteEnabled = true;
    component.vignetteTrack = track('local-vignette.wav', 5, 'idle', null);
    getSetlistPresignedUrl.and.returnValue(of({
      uploadUrl: 'https://s3.example.test/local-vignette-put',
      s3Key: 'uploads/user-id/setlist/local-vignette.wav',
    }));
    uploadToS3.and.returnValue(of(null));
    spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();

    expect(getSetlistPresignedUrl).toHaveBeenCalledOnceWith('local-vignette.wav');
    expect(uploadToS3).toHaveBeenCalledTimes(1);
    expect(component.vignetteTrack?.s3Key).toBe(
      'uploads/user-id/setlist/local-vignette.wav',
    );
    expect(component.vignetteTrack?.uploadState).toBe('ready');
    expect(renderDeployBuildV2Setlist).toHaveBeenCalledTimes(1);
  });

  it('blocks generate-s3 before processing-state mutation when authentication is unavailable', () => {
    component.tracks = readyTracks(2);
    component.setlistError = 'preserved';
    session.set(null);

    component.igniteSetlist();

    expect(requestSignIn).toHaveBeenCalledWith('general');
    expect(generateMixS3).not.toHaveBeenCalled();
    expect(component.isProcessing).toBeFalse();
    expect(component.setlistError).toBe('preserved');
  });

  it('allows replacement while Free already has three music tracks', () => {
    userRole.set('free');
    component.tracks = readyTracks(3);
    const previous = component.tracks[1];
    stubTrackCreation();
    spyOn(URL, 'revokeObjectURL');
    const replacement = new File(['audio'], 'replacement.wav', { type: 'audio/wav' });
    const input = { files: [replacement], value: 'selected' } as unknown as HTMLInputElement;

    component.replaceTrackFile(1, { target: input } as unknown as Event);

    expect(component.tracks.length).toBe(3);
    expect(component.tracks[1].name).toBe('replacement.wav');
    expect(component.tracks[1].id).toBe(previous.id);
    expect(component.tracks[1].s3Key).toBeNull();
    expect(component.tracks[1].uploadState).toBe('idle');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(previous.rawUrl);
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('safely maps the authoritative backend plan-limit error', async () => {
    component.tracks = readyTracks(2);
    renderDeployBuildV2Setlist.and.returnValue(throwError(() => ({
      error: { code: 'SETLIST_PLAN_LIMIT_EXCEEDED', detail: 'PRIVATE_DETAIL' },
    })));

    await component.igniteSetlist();

    expect(component.setlistError).toBe(component.localCopy('trackLimitServer'));
    expect(component.setlistError).not.toContain('PRIVATE_DETAIL');
    expect(component.pricingUpgradeRequired()).toBeTrue();
    fixture.detectChanges();
    const pricingLink = fixture.nativeElement.querySelector('.build-upgrade-card [data-testid="plan-upgrade-link"]') as HTMLAnchorElement;
    expect(pricingLink.getAttribute('href')).toBe('/pricing?from=build&intent=upgrade');
  });

  it('cancels an active render on logout and ignores a delayed success', fakeAsync(() => {
    let emitDelayedSuccess = () => {};
    let subscribed = false;
    let unsubscribed = false;
    renderDeployBuildV2Setlist.and.returnValue(new Observable<BuildV2RenderDeployResponse>((subscriber) => {
      subscribed = true;
      emitDelayedSuccess = () => {
        subscriber.next(renderResponse());
        subscriber.complete();
      };
      return () => { unsubscribed = true; };
    }));
    component.tracks = readyTracks(2);
    const staleTracks = [...component.tracks];
    const anchorClick = spyOn(HTMLAnchorElement.prototype, 'click');

    component.igniteSetlist();
    flushMicrotasks();
    expect(component.isProcessing).toBeTrue();
    expect(subscribed).toBeTrue();

    session.set(null);
    fixture.detectChanges();
    flushMicrotasks();

    expect(unsubscribed).toBeTrue();
    expect(component.isProcessing).toBeFalse();
    expect(component.mixSuccess).toBeFalse();
    expect(component.tracks).toEqual([]);
    expect(staleTracks.every((item) => item.s3Key === null)).toBeTrue();

    emitDelayedSuccess();


    expect(anchorClick).not.toHaveBeenCalled();
    expect(component.isProcessing).toBeFalse();
    expect(component.mixSuccess).toBeFalse();
    expect(audioComparison.audioProcessed()).toBeFalse();
    expect(audioComparison.processedFilename()).toBe('');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('setlist_created');
    expect(component.tracks).toEqual([]);
  }));

  it('clears user A Setlist state on A to B switch and ignores a delayed A success', fakeAsync(() => {
    let emitDelayedSuccess = () => {};
    let unsubscribed = false;
    renderDeployBuildV2Setlist.and.returnValue(new Observable<BuildV2RenderDeployResponse>((subscriber) => {
      emitDelayedSuccess = () => {
        subscriber.next(renderResponse());
        subscriber.complete();
      };
      return () => { unsubscribed = true; };
    }));
    component.tracks = readyTracks(2);
    component.vignetteEnabled = true;
    component.vignetteTrack = track(
      'user-a-vignette.wav',
      5,
      'ready',
      'uploads/user-id/setlist/user-a-vignette.wav',
    );
    const staleTracks = [...component.tracks];
    const staleVignette = component.vignetteTrack;
    const revokeObjectUrl = spyOn(URL, 'revokeObjectURL');
    const anchorClick = spyOn(HTMLAnchorElement.prototype, 'click');

    component.igniteSetlist();
    flushMicrotasks();
    expect(component.isProcessing).toBeTrue();

    session.set({ access_token: 'user-b-token', user: { id: 'user-b' } });
    fixture.detectChanges();
    flushMicrotasks();

    expect(unsubscribed).toBeTrue();
    expect(component.isProcessing).toBeFalse();
    expect(component.mixSuccess).toBeFalse();
    expect(component.tracks).toEqual([]);
    expect(component.vignetteTrack).toBeNull();
    expect(component.vignetteEnabled).toBeFalse();
    expect(staleTracks.every((item) => item.s3Key === null && item.uploadState === 'idle')).toBeTrue();
    expect(staleVignette?.s3Key).toBeNull();
    expect(staleVignette?.uploadState).toBe('idle');
    for (const item of [...staleTracks, staleVignette!]) {
      expect(revokeObjectUrl).toHaveBeenCalledWith(item.rawUrl);
    }

    emitDelayedSuccess();
    flushMicrotasks();

    expect(anchorClick).not.toHaveBeenCalled();
    expect(component.isProcessing).toBeFalse();
    expect(component.mixSuccess).toBeFalse();
    expect(audioComparison.audioProcessed()).toBeFalse();
    expect(audioComparison.processedFilename()).toBe('');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('setlist_created');
    expect(component.tracks).toEqual([]);
    expect(component.vignetteTrack).toBeNull();
  }));

  it('preserves Setlist state and active render on same-user token refresh', fakeAsync(() => {
    let unsubscribed = false;
    renderDeployBuildV2Setlist.and.returnValue(new Observable<BuildV2RenderDeployResponse>(() => (
      () => { unsubscribed = true; }
    )));
    component.tracks = readyTracks(2);
    component.vignetteEnabled = true;
    component.vignetteTrack = track(
      'same-user-vignette.wav',
      5,
      'ready',
      'uploads/user-id/setlist/same-user-vignette.wav',
    );
    const originalTracks = component.tracks;
    const originalVignette = component.vignetteTrack;
    const revokeObjectUrl = spyOn(URL, 'revokeObjectURL');

    component.igniteSetlist();
    flushMicrotasks();
    session.set({ access_token: 'refreshed-token', user: { id: 'user-id' } });
    fixture.detectChanges();
    flushMicrotasks();

    expect(unsubscribed).toBeFalse();
    expect(component.isProcessing).toBeTrue();
    expect(component.tracks).toBe(originalTracks);
    expect(component.vignetteTrack).toBe(originalVignette);
    expect(component.vignetteEnabled).toBeTrue();
    expect(component.tracks.map((item) => item.s3Key)).toEqual([
      'uploads/user-id/setlist/track-01.wav',
      'uploads/user-id/setlist/track-02.wav',
    ]);
    expect(component.vignetteTrack?.s3Key).toBe('uploads/user-id/setlist/same-user-vignette.wav');
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  }));

  it('accepts only the latest render attempt for download and success UI', async () => {
    const first = new Subject<BuildV2RenderDeployResponse>();
    const second = new Subject<BuildV2RenderDeployResponse>();
    renderDeployBuildV2Setlist.and.returnValues(first, second);
    component.tracks = readyTracks(2);
    const download = spyOn(HTMLAnchorElement.prototype, 'click');

    await component.igniteSetlist();
    await component.igniteSetlist();
    first.next(renderResponse());
    first.complete();

    expect(download).not.toHaveBeenCalled();
    expect(component.mixSuccess).toBeFalse();

    second.next(renderResponse());
    second.complete();

    expect(download).toHaveBeenCalledTimes(1);
    expect(component.mixSuccess).toBeTrue();
    expect(audioComparison.processedFilename()).toBe('RQS_TEST_SETLIST.wav');
  });

  it('cancels an active render when the component is destroyed', fakeAsync(() => {
    let unsubscribed = false;
    renderDeployBuildV2Setlist.and.returnValue(new Observable<BuildV2RenderDeployResponse>(() => (
      () => { unsubscribed = true; }
    )));
    component.tracks = readyTracks(2);

    component.igniteSetlist();
    flushMicrotasks();
    fixture.destroy();

    expect(unsubscribed).toBeTrue();
    expect(component.isProcessing).toBeFalse();
    expect(component.mixSuccess).toBeFalse();
  }));

  function stubTrackCreation(): void {
    spyOn<any>(component, 'createTrack').and.callFake((file: File) => (
      track(file.name, 60, 'idle', null)
    ));
  }
});

function renderResponse(): BuildV2RenderDeployResponse {
  return {
    success: true,
    engine: 'build-v2',
    downloadUrl: 'https://s3.example.test/result',
    fileName: 'RQS_TEST_SETLIST.wav',
    output: {
      format: 'wav',
      codec: 'pcm_s24le',
      sampleRate: 48000,
      channels: 2,
      durationSeconds: 112,
      bytes: 32_256_000,
    },
  };
}

function cloudSaveResult(
  request: BuildV2CloudProjectSaveRequest,
  revision: number,
): BuildV2CloudProjectSaveResult {
  const project = request.snapshot.project;
  return {
    kind: 'saved',
    project,
    response: {
      success: true,
      alreadySaved: false,
      updated: request.baseline !== null,
      project: {
        projectId: project.projectId,
        name: project.name,
        schemaVersion: project.schemaVersion,
        revision,
        assetCount: project.assets.length,
        trackCount: project.tracks.length,
        documentCreatedAt: project.createdAt,
        documentUpdatedAt: project.updatedAt,
      },
    },
    quota: null,
    uploadedAssetIds: project.assets.map(asset => asset.assetId),
    removedAssetIds: [],
  };
}

function cloudSummary(projectId: string, name: string, revision: number) {
  return {
    projectId,
    name,
    schemaVersion: 1,
    revision,
    assetCount: 2,
    trackCount: 2,
    documentCreatedAt: '2026-11-13T18:00:00.000Z',
    documentUpdatedAt: '2026-11-14T01:00:00.000Z',
  };
}

function cloudRestoreBundle(
  projectId: string,
  name: string,
  revision: number,
): BuildV2CloudProjectRestoreBundle {
  const fileA = new File(['aaaaa'], 'cloud-a.wav', { type: 'audio/wav' });
  const fileB = new File(['bbbbbb'], 'cloud-b.mp3', { type: 'audio/mpeg' });
  const project: BuildV2ProjectDocumentV1 = {
    kind: 'rqs-build-project',
    schemaVersion: 1,
    projectId,
    name,
    createdAt: '2026-11-13T18:00:00.000Z',
    updatedAt: '2026-11-14T01:00:00.000Z',
    assets: [
      {
        assetId: '30000000-0000-4000-8000-000000000001',
        originalFileName: fileA.name,
        format: 'wav',
        sizeBytes: fileA.size,
        durationSeconds: 60,
      },
      {
        assetId: '30000000-0000-4000-8000-000000000002',
        originalFileName: fileB.name,
        format: 'mp3',
        sizeBytes: fileB.size,
        durationSeconds: 70,
      },
    ],
    tracks: [
      {
        trackId: 'cloud-track-a',
        assetId: '30000000-0000-4000-8000-000000000001',
        state: { trimStartSeconds: 2, trimEndSeconds: 55, gainDb: -3, pan: -0.25 },
      },
      {
        trackId: 'cloud-track-b',
        assetId: '30000000-0000-4000-8000-000000000002',
        state: { trimStartSeconds: 1, trimEndSeconds: 65, gainDb: 1, pan: 0.4 },
      },
    ],
    transitions: [{
      fromTrackId: 'cloud-track-a',
      toTrackId: 'cloud-track-b',
      durationSeconds: 4,
      curve: 'fast-cut',
      usesDefault: false,
    }],
    transitionDefaults: { durationSeconds: 8, curve: 'equal-power' },
    finalFade: { enabled: true, durationSeconds: 6, curve: 'linear' },
    vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' },
    render: {
      exportName: name,
      loudnessMode: 'off',
      outputFormat: 'wav',
      sampleRate: 48_000,
      channels: 2,
    },
  };
  return {
    project,
    revision,
    files: new Map([
      [project.assets[0].assetId, fileA],
      [project.assets[1].assetId, fileB],
    ]),
  };
}

function audioFiles(count: number, start = 1): File[] {
  return Array.from({ length: count }, (_, index) => (
    new File(['audio'], `track-${String(start + index).padStart(2, '0')}.wav`, { type: 'audio/wav' })
  ));
}

function readyTracks(count: number, start = 1): RQSTrack[] {
  return Array.from({ length: count }, (_, index) => {
    const number = start + index;
    const name = `track-${String(number).padStart(2, '0')}.wav`;
    return track(name, 60, 'ready', `uploads/user-id/setlist/${name}`);
  });
}

function track(
  name: string,
  duration: number,
  uploadState: RQSTrack['uploadState'],
  s3Key: string | null,
): RQSTrack {
  return {
    id: crypto.randomUUID(),
    assetId: crypto.randomUUID(),
    file: new File(['audio'], name, { type: 'audio/wav' }),
    name,
    crossfadeNext: 8,
    previewUrl: `blob:${name}` as unknown as SafeUrl,
    rawUrl: `blob:${name}`,
    duration,
    s3Key,
    uploadState,
    uploadError: null,
    uploadAttempt: 1,
    v2: createBuildV2TrackState(),
  };
}
