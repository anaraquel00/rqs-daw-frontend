import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { By, SafeUrl } from '@angular/platform-browser';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { MixPanelComponent, RQSTrack } from './mix-panel';
import {
  DspService,
  SetlistRenderRequest,
  SetlistRenderResponse,
} from '../services/dsp';
import { AuthService } from '../services/auth.service';
import { AudioComparisonService } from '../services/audio-comparison.service';
import { AnalyticsService } from '../services/analytics.service';
import { PreviewWaveformComponent } from '../components/mastering-panel/preview-waveform';

describe('MixPanelComponent Setlist Stage 1 contract', () => {
  const session = signal<{ access_token: string; user: { id: string } } | null>({
    access_token: 'test-token',
    user: { id: 'user-id' },
  });
  const userRole = signal<'free' | 'premium'>('premium');

  let generateMixS3: jasmine.Spy;
  let getSetlistPresignedUrl: jasmine.Spy;
  let uploadToS3: jasmine.Spy;
  let requestSignIn: jasmine.Spy;
  let analytics: { trackEvent: jasmine.Spy };
  let audioComparison: {
    audioProcessed: ReturnType<typeof signal<boolean>>;
    processedFilename: ReturnType<typeof signal<string>>;
  };
  let fixture: ComponentFixture<MixPanelComponent>;
  let component: MixPanelComponent;

  beforeEach(() => {
    generateMixS3 = jasmine.createSpy('generateMixS3').and.returnValue(of(renderResponse()));
    getSetlistPresignedUrl = jasmine.createSpy('getSetlistPresignedUrl').and.returnValue(NEVER);
    uploadToS3 = jasmine.createSpy('uploadToS3').and.returnValue(NEVER);
    requestSignIn = jasmine.createSpy('requestSignIn');
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
        {
          provide: DspService,
          useValue: { generateMixS3, getSetlistPresignedUrl, uploadToS3 },
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

  it('sends ordered heterogeneous curves and durations while preserving the legacy curve', () => {
    component.tracks = readyTracks(3);
    component.editTransition(1, 3, 'fast-cut');
    spyOn(HTMLAnchorElement.prototype, 'click');
    component.igniteSetlist();
    const payload = generateMixS3.calls.mostRecent().args[0] as SetlistRenderRequest;
    expect(payload.crossfades).toEqual([8, 3]);
    expect(payload.curves).toEqual(['equal-power', 'fast-cut']);
    expect(payload.curve).toBe('equal-power');
    expect(component.calculateCrossfadeDuration()).toBe(11);
    expect(component.calculateEstimatedOutputDuration()).toBe(169);
  });

  for (const duration of [0, 0.49, 16, 60, NaN]) {
    it(`continues to reject invalid transition duration ${duration}`, () => {
      component.tracks = readyTracks(2);
      component.editTransition(0, duration, 'linear');
      expect(component.canIgniteSetlist()).toBeFalse();
      expect(component.canPreviewTransition(0)).toBeFalse();
    });
  }

  it('renders a separate editable transition between each pair of track cards', () => {
    component.tracks = readyTracks(3);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.track-list li');
    expect(Array.from(items).map((item: any) => item.className)).toEqual([
      'track-item', 'transition-item', 'track-item', 'transition-item', 'track-item',
    ]);
    expect(fixture.nativeElement.querySelector('.transition-editor')).toBeNull();
    component.toggleTransition(component.transitions[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.transition-editor').length).toBe(1);
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
    { duration: 240, fade: 8, lead: 12, start: 220 },
    { duration: 10, fade: 3, lead: 7, start: 0 },
    { duration: 3.5, fade: 3, lead: 0.5, start: 0 },
    { duration: 3.001, fade: 3, lead: 0.001, start: 0 },
  ]) {
    it(`aligns preview overlap for ${testCase.duration}s source and ${testCase.fade}s transition`, fakeAsync(() => {
      component.tracks = readyTracks(2);
      component.tracks[0].duration = testCase.duration;
      component.editTransition(0, testCase.fade, 'linear');
      const outgoing = component.transitionRegion(0, 'out');
      const incoming = component.transitionRegion(1, 'in');
      const internal = component as any;
      const incomingPlay = jasmine.createSpy('incomingPlay').and.returnValue(Promise.resolve());
      internal.playerElement1 = { src: '', currentTime: 0, play: () => Promise.resolve(), pause: () => {} };
      internal.playerElement2 = { src: '', currentTime: 0, play: incomingPlay, pause: () => {} };
      internal.audioCtx = { state: 'running', currentTime: 0, close: () => Promise.resolve() };
      internal.gainNode1 = { gain: { setValueAtTime: () => {} } };
      internal.gainNode2 = { gain: { setValueAtTime: () => {} } };
      spyOn(internal, 'initializeWebAudio').and.returnValue(true);
      const apply = spyOn(internal, 'applyCrossfadeCurve');
      void component.previewTransition(0);
      flushMicrotasks();
      expect(internal.playerElement1.currentTime).toBeCloseTo(testCase.start, 8);
      expect(internal.playerElement1.currentTime).toBeGreaterThanOrEqual(0);
      expect(testCase.start + testCase.lead).toBeCloseTo(outgoing!.start, 8);
      const beforeOverlapMs = Math.max(0, Math.floor(testCase.lead * 1000) - 100);
      tick(beforeOverlapMs);
      flushMicrotasks();
      expect(incomingPlay).not.toHaveBeenCalled();
      tick(200);
      flushMicrotasks();
      expect(incomingPlay).toHaveBeenCalledTimes(1);
      expect(internal.playerElement2.currentTime).toBe(incoming!.start);
      expect(apply).toHaveBeenCalledWith(testCase.fade, 'linear');
      expect(component.transitionRegion(0, 'out')).toEqual(outgoing);
      expect(component.transitionRegion(1, 'in')).toEqual(incoming);
      component.stopTransitionPreview();
    }));
  }

  it('blocks an invalid overlap rather than starting a preview with negative available lead', async () => {
    component.tracks = readyTracks(2);
    component.tracks[0].duration = 2;
    component.editTransition(0, 3, 'linear');
    const initialize = spyOn(component as any, 'initializeWebAudio');
    await component.previewTransition(0);
    expect(initialize).not.toHaveBeenCalled();
    expect(component.previewingIndex).toBe(-1);
  });

  it('blocks render until every music upload is ready', () => {
    component.tracks = [
      track('track-01.wav', 60, 'ready', 'uploads/user-id/setlist/track-01.wav'),
      track('track-02.wav', 60, 'uploading', null),
    ];

    expect(component.canIgniteSetlist()).toBeFalse();

    component.tracks[1].uploadState = 'ready';
    component.tracks[1].s3Key = 'uploads/user-id/setlist/track-02.wav';
    expect(component.canIgniteSetlist()).toBeTrue();
  });

  it('renders one compact non-interactive waveform for every local track', () => {
    component.tracks = readyTracks(3);
    fixture.detectChanges();

    const waveforms = fixture.debugElement.queryAll(By.directive(PreviewWaveformComponent));
    expect(waveforms.length).toBe(3);
    for (const waveform of waveforms) {
      const instance = waveform.componentInstance as PreviewWaveformComponent;
      expect(instance.compact).toBeTrue();
      expect(waveform.query(By.css('.preview-region'))).toBeNull();
      expect(waveform.query(By.css('.waveform-playhead'))).toBeNull();
    }
  });

  it('renders local waveforms without starting additional network operations', () => {
    component.tracks = readyTracks(2);
    fixture.detectChanges();

    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(generateMixS3).not.toHaveBeenCalled();
  });

  it('keeps Track 01 first and sends no vignette when the option is disabled', () => {
    component.tracks = readyTracks(2);
    component.vignetteEnabled = false;
    spyOn(HTMLAnchorElement.prototype, 'click');

    component.igniteSetlist();

    const payload = generateMixS3.calls.mostRecent().args[0] as SetlistRenderRequest;
    expect(payload.tracks).toEqual([
      'uploads/user-id/setlist/track-01.wav',
      'uploads/user-id/setlist/track-02.wav',
    ]);
    expect(payload.vignette).toBeNull();
    expect(payload.crossfades).toEqual([8]);
    expect(payload.outputFormat).toBe('wav');
  });

  it('sends an enabled vignette separately instead of consuming Track 01', () => {
    component.tracks = readyTracks(2);
    component.vignetteEnabled = true;
    component.vignetteTrack = track('id-drop.wav', 5, 'ready', 'uploads/user-id/setlist/id-drop.wav');
    spyOn(HTMLAnchorElement.prototype, 'click');

    component.igniteSetlist();

    const payload = generateMixS3.calls.mostRecent().args[0] as SetlistRenderRequest;
    expect(payload.tracks[0]).toBe('uploads/user-id/setlist/track-01.wav');
    expect(payload.vignette).toBe('uploads/user-id/setlist/id-drop.wav');
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

  it('adds at most three music files for Free before presign', () => {
    userRole.set('free');
    stubTrackCreation();

    (component as any).addFiles(audioFiles(4));

    expect(component.tracks.length).toBe(3);
    expect(getSetlistPresignedUrl).toHaveBeenCalledTimes(3);
    expect(component.setlistError).toContain('3');
  });

  it('adds at most eight music files for Premium before presign', () => {
    userRole.set('premium');
    stubTrackCreation();

    (component as any).addFiles(audioFiles(9));

    expect(component.tracks.length).toBe(8);
    expect(getSetlistPresignedUrl).toHaveBeenCalledTimes(8);
    expect(component.setlistError).toContain('8');
  });

  it('does not start presign or upload for a Free fourth music file', () => {
    userRole.set('free');
    component.tracks = readyTracks(3);
    stubTrackCreation();

    (component as any).addFiles(audioFiles(1, 4));

    expect(component.tracks.length).toBe(3);
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('keeps anonymous track selection local and opens auth without presign or upload', () => {
    session.set(null);
    stubTrackCreation();

    (component as any).addFiles(audioFiles(1));

    expect(component.tracks.length).toBe(1);
    expect(component.tracks[0].uploadState).toBe('idle');
    expect(requestSignIn).toHaveBeenCalledWith('general');
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('does not presign while session restoration has no access token', () => {
    session.set({ access_token: '   ', user: { id: 'user-id' } });
    stubTrackCreation();

    (component as any).addFiles(audioFiles(1));

    expect(requestSignIn).toHaveBeenCalledWith('general');
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

  it('protects vignette upload with the same authenticated-session gate', () => {
    session.set(null);
    stubTrackCreation();
    const vignette = new File(['audio'], 'id-drop.wav', { type: 'audio/wav' });
    const input = { files: [vignette], value: 'selected' } as unknown as HTMLInputElement;

    component.onVignetteSelect({ target: input } as unknown as Event);

    expect(component.vignetteTrack?.uploadState).toBe('idle');
    expect(requestSignIn).toHaveBeenCalledWith('general');
    expect(getSetlistPresignedUrl).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
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
    stubTrackCreation();
    spyOn(URL, 'revokeObjectURL');
    const replacement = new File(['audio'], 'replacement.wav', { type: 'audio/wav' });
    const input = { files: [replacement], value: 'selected' } as unknown as HTMLInputElement;

    component.replaceTrackFile(1, { target: input } as unknown as Event);

    expect(component.tracks.length).toBe(3);
    expect(component.tracks[1].name).toBe('replacement.wav');
    expect(getSetlistPresignedUrl).toHaveBeenCalledTimes(1);
  });

  it('safely maps the authoritative backend plan-limit error', () => {
    component.tracks = readyTracks(2);
    generateMixS3.and.returnValue(throwError(() => ({
      error: { code: 'SETLIST_PLAN_LIMIT_EXCEEDED', detail: 'PRIVATE_DETAIL' },
    })));

    component.igniteSetlist();

    expect(component.setlistError).toBe(component.localCopy('trackLimitServer'));
    expect(component.setlistError).not.toContain('PRIVATE_DETAIL');
  });

  it('cancels an active render on logout and ignores a delayed success', fakeAsync(() => {
    let emitDelayedSuccess = () => {};
    let subscribed = false;
    let unsubscribed = false;
    generateMixS3.and.returnValue(new Observable<SetlistRenderResponse>((subscriber) => {
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
    generateMixS3.and.returnValue(new Observable<SetlistRenderResponse>((subscriber) => {
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
    generateMixS3.and.returnValue(new Observable<SetlistRenderResponse>(() => (
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

  it('cancels an active render when the component is destroyed', () => {
    let unsubscribed = false;
    generateMixS3.and.returnValue(new Observable<SetlistRenderResponse>(() => (
      () => { unsubscribed = true; }
    )));
    component.tracks = readyTracks(2);

    component.igniteSetlist();
    fixture.destroy();

    expect(unsubscribed).toBeTrue();
    expect(component.isProcessing).toBeFalse();
    expect(component.mixSuccess).toBeFalse();
  });

  function stubTrackCreation(): void {
    spyOn<any>(component, 'createTrack').and.callFake((file: File) => (
      track(file.name, 60, 'idle', null)
    ));
  }
});

function renderResponse(): SetlistRenderResponse {
  return {
    success: true,
    downloadUrl: 'https://s3.example.test/result',
    fileName: 'RQS_TEST_SETLIST.wav',
    output: {
      format: 'wav',
      codec: 'pcm_s24le',
      sampleRate: 48000,
      channels: 2,
      durationSeconds: 112,
    },
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
  };
}
