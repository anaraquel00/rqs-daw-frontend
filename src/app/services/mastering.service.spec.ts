import { TestBed } from '@angular/core/testing';
import { MasteringService } from './mastering.service';

describe('MasteringService V2 contract', () => {
  let service: MasteringService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MasteringService);
  });

  it('starts with the validated V2 defaults', () => {
    expect(service.getRequest()).toEqual({
      destination: 'streaming',
      platform: 'spotify',
      atmosphere: 'clear_sky',
      intensityPercent: 50,
      requestedLufs: null,
      soundcloudMode: 'standard',
    });
  });

  it('clamps intensity to the 0-100 V2 contract', () => {
    service.setIntensityPercent(-12);
    expect(service.intensityPercent()).toBe(0);

    service.setIntensityPercent(101.7);
    expect(service.intensityPercent()).toBe(100);

    service.setIntensityPercent(42.6);
    expect(service.intensityPercent()).toBe(43);
  });

  it('clears streaming-only state for club and festival', () => {
    service.setPlatform('soundcloud');
    service.setSoundCloudMode('loud');
    service.setRequestedLufs(-12);
    service.setDestination('club');

    expect(service.getRequest()).toEqual({
      destination: 'club',
      platform: null,
      atmosphere: 'clear_sky',
      intensityPercent: 50,
      requestedLufs: null,
      soundcloudMode: 'standard',
    });
  });

  it('does not serialize legacy precision-control compatibility state', () => {
    service.setLowCutoff(350);
    service.setHighCutoff(4200);
    service.setStereoWidth(1.4);
    service.setSatAmount(0.9);
    service.setMonoBass(160);
    service.setCeiling(-0.2);
    service.setThreshold(-6);

    const request = service.getRequest() as unknown as Record<string, unknown>;
    expect(Object.keys(request).sort()).toEqual([
      'atmosphere',
      'destination',
      'intensityPercent',
      'platform',
      'requestedLufs',
      'soundcloudMode',
    ]);
  });
});
