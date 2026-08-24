import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from '../services/analytics.service';
import { DeepLinkService } from '../services/deep-link.service';
import { LanguageService } from '../services/language.service';
import { RqsUplinkEngineComponent } from './rqs-uplink-engine';

describe('RqsUplinkEngineComponent', () => {
  it('always clears creating after an unexpected dependency rejection', async () => {
    const deepLinkService = {
      detectPlatform: () => null,
      compileAndRegisterLink: jasmine.createSpy().and.rejectWith(new Error('internal detail'))
    };

    await TestBed.configureTestingModule({
      imports: [RqsUplinkEngineComponent],
      providers: [
        { provide: DeepLinkService, useValue: deepLinkService },
        { provide: LanguageService, useValue: { tr: () => ({ UPLINK_CREATE_FAILED: 'CREATE_FAILED' }) } },
        { provide: AnalyticsService, useValue: { trackEvent: jasmine.createSpy() } }
      ]
    }).compileComponents();

    const component = TestBed.createComponent(RqsUplinkEngineComponent).componentInstance;
    component.targetUrl.set('https://example.com');
    await component.compileLink();

    expect(component.creating()).toBeFalse();
    expect(component.errorMessage()).toBe('CREATE_FAILED');
  });
});
