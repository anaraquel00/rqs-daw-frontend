import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AnalyticsService } from '../services/analytics.service';
import { SeoService } from '../services/seo.service';
import { MasterLandingPageComponent, masterLandingSeoConfig } from './master-landing-page';

describe('MasterLandingPageComponent', () => {
  it('uses dedicated indexable canonical SEO', () => {
    const config = masterLandingSeoConfig('pt');
    expect(config.url).toBe('https://studio.raquelsynths.com/master/online');
    expect(config.robots).toBe('index, follow');
    expect(config.title).toContain('Masterização Online');
  });

  it('preserves only approved attribution parameters for CTA navigation', () => {
    TestBed.configureTestingModule({
      imports: [MasterLandingPageComponent],
      providers: [
        provideRouter([]),
        SeoService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                gclid: 'test-gclid',
                utm_source: 'google',
                utm_campaign: 'master-search',
                access_token: 'must-not-pass',
                arbitrary: 'must-not-pass'
              })
            }
          }
        }
      ]
    });

    const component = TestBed.createComponent(MasterLandingPageComponent).componentInstance;
    expect(component.attributionParams).toEqual({
      gclid: 'test-gclid',
      utm_source: 'google',
      utm_campaign: 'master-search'
    });
  });

  it('emits one privacy-safe CTA event', () => {
    const analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MasterLandingPageComponent],
      providers: [
        provideRouter([]),
        SeoService,
        { provide: AnalyticsService, useValue: analytics },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    });

    const component = TestBed.createComponent(MasterLandingPageComponent).componentInstance;
    component.trackCta('hero');

    expect(analytics.trackEvent).toHaveBeenCalledOnceWith('master_landing_cta', {
      cta_position: 'hero',
      source_page: '/master/online',
      destination: '/app/master'
    });
  });
});
