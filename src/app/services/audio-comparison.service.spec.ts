import { TestBed } from '@angular/core/testing';
import { AudioComparisonService } from './audio-comparison.service';

interface DiagnosticApi {
  summary(): string;
  clear(): void;
}

interface AudioComparisonInternals {
  originalAudio: HTMLAudioElement;
  masterAudio: HTMLAudioElement;
  audioCtx: AudioContext | null;
  iniciarContextoDeAudio(): void;
  playActiveSource(): Promise<void>;
  pauseAll(callerOperation?: string): void;
}

function diagnosticApi(): DiagnosticApi {
  const api = (window as typeof window & {
    __RQS_GATE140_FIRST_PLAY_DIAG__?: DiagnosticApi;
  }).__RQS_GATE140_FIRST_PLAY_DIAG__;
  if (!api) throw new Error('Gate 140 diagnostic API is unavailable');
  return api;
}

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (reason: unknown) => void } {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function abortError(message = 'Playback interrupted'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function audioContextStub(
  state: AudioContextState,
  resume: () => Promise<void> = () => Promise.resolve(),
): AudioContext {
  return {
    state,
    resume,
    close: () => Promise.resolve(),
  } as unknown as AudioContext;
}

describe('AudioComparisonService V2 preview mapping', () => {
  let service: AudioComparisonService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioComparisonService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('maps preview seeks to the centered source window and clamps both ends', () => {
    service.duration.set(60);
    service.previewStart.set(22.5);
    service.previewEnd.set(37.5);
    service.previewStatus.set('ready');
    service.playbackMode.set('preview-15s');

    const media = service as unknown as {
      originalAudio: HTMLAudioElement;
      masterAudio: HTMLAudioElement;
    };

    service.seek(25);
    expect(media.originalAudio.currentTime).toBeCloseTo(25, 3);
    expect(media.masterAudio.currentTime).toBeCloseTo(2.5, 3);
    expect(service.displayCurrentTime()).toBeCloseTo(2.5, 3);

    service.seek(0);
    expect(media.originalAudio.currentTime).toBeCloseTo(22.5, 3);
    expect(media.masterAudio.currentTime).toBeCloseTo(0, 3);

    service.seek(99);
    expect(media.originalAudio.currentTime).toBeCloseTo(37.5, 3);
    expect(media.masterAudio.currentTime).toBeCloseTo(15, 3);
  });

  it('clears stale master state and returns to selected Preview audition', () => {
    service.duration.set(60);
    service.setPreviewStart(18);
    service.previewStatus.set('ready');
    service.playbackMode.set('preview-15s');
    service.activeVariant.set('master');

    service.clearMasterSrc();

    expect(service.previewStatus()).toBe('not-generated');
    expect(service.playbackMode()).toBe('preview-15s');
    expect(service.activeVariant()).toBe('original');
    expect(service.canUseMaster()).toBeFalse();
    expect(service.currentTime()).toBeCloseTo(18, 3);
  });

  it('uses the actual preview duration for tracks shorter than fifteen seconds', () => {
    service.previewStart.set(0);
    service.previewEnd.set(8.25);
    service.previewStatus.set('ready');
    service.playbackMode.set('preview-15s');

    expect(service.displayDuration()).toBeCloseTo(8.25, 3);
  });

  it('physically positions the source when the initial Preview window resolves', () => {
    const media = service as unknown as {
      originalAudio: HTMLAudioElement;
    };

    spyOnProperty(media.originalAudio, 'duration', 'get').and.returnValue(60);
    media.originalAudio.currentTime = 0;

    media.originalAudio.dispatchEvent(new Event('durationchange'));

    expect(service.previewStart()).toBeCloseTo(22.5, 3);
    expect(service.previewEnd()).toBeCloseTo(37.5, 3);
    expect(media.originalAudio.currentTime).toBeCloseTo(22.5, 3);
    expect(service.currentTime()).toBeCloseTo(22.5, 3);
  });

  it('constrains source-only audition to the selected Preview range before a master exists', async () => {
    service.duration.set(60);
    service.setPreviewStart(20);
    service.previewStatus.set('not-generated');
    service.playbackMode.set('preview-15s');

    const media = service as unknown as {
      originalAudio: HTMLAudioElement;
    };
    const internal = service as unknown as {
      playActiveSource(): Promise<void>;
    };

    spyOn(media.originalAudio, 'play').and.returnValue(Promise.resolve());
    media.originalAudio.currentTime = 0;

    await internal.playActiveSource();

    expect(media.originalAudio.currentTime).toBeCloseTo(20, 3);
    expect(service.displayCurrentTime()).toBeCloseTo(0, 3);
    expect(service.displayDuration()).toBeCloseTo(15, 3);

    service.seek(0);
    expect(media.originalAudio.currentTime).toBeCloseTo(20, 3);

    service.seek(59);
    expect(media.originalAudio.currentTime).toBeCloseTo(35, 3);

    service.stopAndReset();
    expect(media.originalAudio.currentTime).toBeCloseTo(20, 3);
    expect(service.currentTime()).toBeCloseTo(20, 3);
  });

  describe('Gate 140 passive first-play diagnostic', () => {
    let internal: AudioComparisonInternals;

    beforeEach(() => {
      internal = service as unknown as AudioComparisonInternals;
      diagnosticApi().clear();
      service.previewStatus.set('ready');
      service.playbackMode.set('preview-15s');
    });

    it('A records source-specific resolve events when both first-play promises resolve', async () => {
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await internal.playActiveSource();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('FIRST_PLAY_RESULT = PASS');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = RESOLVE');
      expect(summary).toContain('MASTER_PLAY_RESULT = RESOLVE');
      expect(summary).toContain('operation=ORIGINAL_PLAY_RESOLVE');
      expect(summary).toContain('operation=MASTER_PLAY_RESOLVE');
    });

    it('B attributes an original first-play AbortError and never calls master play', async () => {
      spyOn(console, 'error');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.reject(abortError()));
      const masterPlay = spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await internal.playActiveSource();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('FIRST_PLAY_RESULT = FAIL:AbortError');
      expect(summary).toContain('PLAY_STAGE_AT_FAILURE = ORIGINAL_PENDING');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = REJECT:AbortError');
      expect(summary).toContain('MASTER_PLAY_RESULT = NOT_CALLED');
      expect(masterPlay).not.toHaveBeenCalled();
    });

    it('C attributes a master AbortError after original play resolves', async () => {
      spyOn(console, 'error');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(Promise.reject(abortError()));

      await internal.playActiveSource();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('PLAY_STAGE_AT_FAILURE = MASTER_PENDING');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = RESOLVE');
      expect(summary).toContain('MASTER_PLAY_RESULT = REJECT:AbortError');
      expect(summary).toContain('operation=MASTER_PLAY_REJECT');
    });

    it('D attributes pauseAll while original play is pending', async () => {
      service.previewStatus.set('not-generated');
      const original = deferred();
      spyOn(internal.originalAudio, 'play').and.returnValue(original.promise);

      const playback = internal.playActiveSource();
      expect(diagnosticApi().summary()).toContain('ORIGINAL_PLAY_RESULT = PENDING');
      internal.pauseAll('TEST_PAUSE_DURING_ORIGINAL');
      original.resolve();
      await playback;

      expect(diagnosticApi().summary()).toContain(
        'INTERRUPTION_WHILE_PLAY_PENDING = PAUSE_ALL_ENTER[TEST_PAUSE_DURING_ORIGINAL]',
      );
    });

    it('E attributes pauseAll while master play is pending', async () => {
      const master = deferred();
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(master.promise);

      const playback = internal.playActiveSource();
      await Promise.resolve();
      expect(diagnosticApi().summary()).toContain('MASTER_PLAY_RESULT = PENDING');
      internal.pauseAll('TEST_PAUSE_DURING_MASTER');
      master.resolve();
      await playback;

      expect(diagnosticApi().summary()).toContain(
        'PAUSE_ALL_ENTER[TEST_PAUSE_DURING_MASTER]',
      );
    });

    it('F attributes setMasterSrc and load while master play is pending', async () => {
      const master = deferred();
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(master.promise);
      spyOn(internal.masterAudio, 'load');

      const playback = internal.playActiveSource();
      await Promise.resolve();
      service.setMasterSrc('blob:replacement-preview', 'preview-15s', 'TEST_PREVIEW_REPLACEMENT');
      master.resolve();
      await playback;

      const summary = diagnosticApi().summary();
      expect(summary).toContain('SET_MASTER_SRC_ENTER[TEST_PREVIEW_REPLACEMENT]');
      expect(summary).toContain('MASTER_LOAD_CALL[TEST_PREVIEW_REPLACEMENT]');
    });

    it('G labels the second playback as attempt two while retaining the first-play result', async () => {
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await internal.playActiveSource();
      await internal.playActiveSource();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('PLAY_ATTEMPT = 2');
      expect(summary).toContain('FIRST_PLAY_RESULT = PASS');
      expect(summary).toContain('attempt=2 source=ORIGINAL operation=ORIGINAL_PLAY_CALL');
    });

    it('H never includes raw src, URL, token or authorization content in the summary', async () => {
      spyOn(console, 'error');
      spyOn(internal.originalAudio, 'load');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.reject(abortError(
        'Failed https://example.invalid/master.wav?token=SUPERSECRET Authorization: Bearer JWTSECRET',
      )));
      service.previewStatus.set('not-generated');
      service.setOriginalSrc(
        'https://example.invalid/original.wav?token=SUPERSECRET',
        null,
        'TEST_SECRET_SANITIZATION',
      );

      await internal.playActiveSource();

      const summary = diagnosticApi().summary();
      expect(summary).not.toContain('https://example.invalid');
      expect(summary).not.toContain('SUPERSECRET');
      expect(summary).not.toContain('JWTSECRET');
      expect(summary).toContain('SRC_KIND=HTTP');
      expect(summary).toContain('SECRET_OR_URL_CONTENT_INCLUDED = NO');
    });

    it('I records successful init and skips resume when AudioContext is already running', async () => {
      internal.audioCtx = audioContextStub('running');
      spyOn(internal, 'iniciarContextoDeAudio');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await service.togglePlayback();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('PLAY_ATTEMPT = 1');
      expect(summary).toContain('AUDIO_CONTEXT_INIT_RESULT = PASS');
      expect(summary).toContain('AUDIO_CONTEXT_RESUME_RESULT = NOT_REQUIRED');
      expect(summary).toContain('operation=PLAY_ACTIVE_SOURCE_ENTER');
    });

    it('J records successful resume before entering playActiveSource', async () => {
      const resume = jasmine.createSpy('resume').and.returnValue(Promise.resolve());
      internal.audioCtx = audioContextStub('suspended', resume);
      spyOn(internal, 'iniciarContextoDeAudio');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await service.togglePlayback();

      const summary = diagnosticApi().summary();
      expect(resume).toHaveBeenCalledTimes(1);
      expect(summary).toContain('AUDIO_CONTEXT_INIT_RESULT = PASS');
      expect(summary).toContain('AUDIO_CONTEXT_RESUME_RESULT = PASS');
      expect(summary).toContain('operation=AUDIO_CONTEXT_RESUME_RESOLVE');
      expect(summary).toContain('operation=PLAY_ACTIVE_SOURCE_ENTER');
    });

    it('K classifies AudioContext initialization failure and propagates the same exception', async () => {
      const error = new Error('AudioContext initialization failed');
      error.name = 'InvalidStateError';
      spyOn(internal, 'iniciarContextoDeAudio').and.callFake(() => { throw error; });
      const originalPlay = spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      const masterPlay = spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await expectAsync(service.togglePlayback()).toBeRejectedWith(error);

      const summary = diagnosticApi().summary();
      expect(summary).toContain('PLAY_ATTEMPT = 1');
      expect(summary).toContain('FIRST_PLAY_RESULT = FAIL:InvalidStateError');
      expect(summary).toContain('AUDIO_CONTEXT_INIT_RESULT = FAIL:InvalidStateError');
      expect(summary).toContain('AUDIO_CONTEXT_RESUME_RESULT = NOT_REACHED');
      expect(summary).toContain('FAILURE_STAGE = AUDIO_CONTEXT_INIT');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = NOT_CALLED');
      expect(summary).toContain('MASTER_PLAY_RESULT = NOT_CALLED');
      expect(originalPlay).not.toHaveBeenCalled();
      expect(masterPlay).not.toHaveBeenCalled();
    });

    it('L classifies AudioContext resume failure and propagates the same rejection', async () => {
      const error = new Error('AudioContext resume rejected');
      error.name = 'NotAllowedError';
      const resume = jasmine.createSpy('resume').and.returnValue(Promise.reject(error));
      internal.audioCtx = audioContextStub('suspended', resume);
      spyOn(internal, 'iniciarContextoDeAudio');
      const originalPlay = spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      const masterPlay = spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await expectAsync(service.togglePlayback()).toBeRejectedWith(error);

      const summary = diagnosticApi().summary();
      expect(summary).toContain('PLAY_ATTEMPT = 1');
      expect(summary).toContain('FIRST_PLAY_RESULT = FAIL:NotAllowedError');
      expect(summary).toContain('AUDIO_CONTEXT_INIT_RESULT = PASS');
      expect(summary).toContain('AUDIO_CONTEXT_RESUME_RESULT = FAIL:NotAllowedError');
      expect(summary).toContain('FAILURE_STAGE = AUDIO_CONTEXT_RESUME');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = NOT_CALLED');
      expect(summary).toContain('MASTER_PLAY_RESULT = NOT_CALLED');
      expect(originalPlay).not.toHaveBeenCalled();
      expect(masterPlay).not.toHaveBeenCalled();
    });

    it('M retains original AbortError attribution through the full toggle path', async () => {
      spyOn(console, 'error');
      internal.audioCtx = audioContextStub('running');
      spyOn(internal, 'iniciarContextoDeAudio');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.reject(abortError()));
      const masterPlay = spyOn(internal.masterAudio, 'play').and.returnValue(Promise.resolve());

      await service.togglePlayback();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('FAILURE_STAGE = ORIGINAL_PENDING');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = REJECT:AbortError');
      expect(summary).toContain('MASTER_PLAY_RESULT = NOT_CALLED');
      expect(masterPlay).not.toHaveBeenCalled();
    });

    it('N retains master AbortError attribution through the full toggle path', async () => {
      spyOn(console, 'error');
      internal.audioCtx = audioContextStub('running');
      spyOn(internal, 'iniciarContextoDeAudio');
      spyOn(internal.originalAudio, 'play').and.returnValue(Promise.resolve());
      spyOn(internal.masterAudio, 'play').and.returnValue(Promise.reject(abortError()));

      await service.togglePlayback();

      const summary = diagnosticApi().summary();
      expect(summary).toContain('FAILURE_STAGE = MASTER_PENDING');
      expect(summary).toContain('ORIGINAL_PLAY_RESULT = RESOLVE');
      expect(summary).toContain('MASTER_PLAY_RESULT = REJECT:AbortError');
    });

    it('O sanitizes pre-media AudioContext failures without exposing raw URL or token content', async () => {
      const error = new Error(
        'Init failed https://example.invalid/context?token=SUPERSECRET Authorization: Bearer JWTSECRET',
      );
      error.name = 'InvalidStateError';
      spyOn(internal, 'iniciarContextoDeAudio').and.callFake(() => { throw error; });

      await expectAsync(service.togglePlayback()).toBeRejectedWith(error);

      const summary = diagnosticApi().summary();
      expect(summary).not.toContain('https://example.invalid');
      expect(summary).not.toContain('SUPERSECRET');
      expect(summary).not.toContain('JWTSECRET');
      expect(summary).toContain('AUDIO_CONTEXT_INIT_RESULT = FAIL:InvalidStateError');
      expect(summary).toContain('SECRET_OR_URL_CONTENT_INCLUDED = NO');
    });
  });

});
