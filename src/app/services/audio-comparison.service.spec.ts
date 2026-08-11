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

  it('clears stale master state when the mastering configuration changes', () => {
    service.previewStatus.set('ready');
    service.playbackMode.set('preview-15s');
    service.activeVariant.set('master');

    service.clearMasterSrc();

    expect(service.previewStatus()).toBe('not-generated');
    expect(service.playbackMode()).toBe('full-track');
    expect(service.activeVariant()).toBe('original');
    expect(service.canUseMaster()).toBeFalse();
  });

  it('uses the actual preview duration for tracks shorter than fifteen seconds', () => {
    service.previewStart.set(0);
    service.previewEnd.set(8.25);
    service.previewStatus.set('ready');
    service.playbackMode.set('preview-15s');

    expect(service.displayDuration()).toBeCloseTo(8.25, 3);
  });
});
