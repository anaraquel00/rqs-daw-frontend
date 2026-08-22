import { TestBed } from '@angular/core/testing';
import { AudioComparisonService } from './audio-comparison.service';

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

});
