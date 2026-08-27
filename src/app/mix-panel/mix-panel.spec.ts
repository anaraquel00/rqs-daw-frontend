import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { SafeUrl } from '@angular/platform-browser';
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

describe('MixPanelComponent Setlist Stage 1 contract', () => {
  const session = signal<{ access_token: string; user: { id: string } } | null>({
    access_token: 'test-token',
    user: { id: 'user-id' },
  });
  const userRole = signal<'free' | 'premium'>('premium');

  let generateMixS3: jasmine.Spy;
  let getSetlistPresignedUrl: jasmine.Spy;
  let uploadToS3: jasmine.Spy;
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
        { provide: AuthService, useValue: { session, userRole } },
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