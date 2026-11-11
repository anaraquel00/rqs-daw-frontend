import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AnalyticsService } from '../services/analytics.service';
import { SeoService } from '../services/seo.service';
import { LanguageService } from '../services/language.service';
import { MasterFeedbackSurveyService } from '../services/master-feedback-survey.service';
import { MasterLandingPageComponent, masterLandingSeoConfig } from './master-landing-page';

describe('MasterLandingPageComponent', () => {
  const feedbackSurvey = {
    surveyUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLSejrsprLW_VVIgagnRSwoZK9GO6QQ8USJfMigckmBYRZ8qOZA/viewform',
    trackClick: jasmine.createSpy('trackClick')
  };

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
        { provide: MasterFeedbackSurveyService, useValue: feedbackSurvey },
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
        { provide: MasterFeedbackSurveyService, useValue: feedbackSurvey },
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

  it('renders the PT-BR hero heading as three indivisible visual lines', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MasterLandingPageComponent],
      providers: [
        provideRouter([]),
        SeoService,
        { provide: MasterFeedbackSurveyService, useValue: feedbackSurvey },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    });

    TestBed.inject(LanguageService).setLanguage('pt');
    const fixture = TestBed.createComponent(MasterLandingPageComponent);
    fixture.detectChanges();

    const lines = Array.from(
      fixture.nativeElement.querySelectorAll('.hero-title-line') as NodeListOf<HTMLElement>
    ).map(line => line.textContent?.trim());

    expect(lines).toEqual(['Masterização', 'online para', 'sua música.']);
  });

  it('renders the external survey after the workflow and tracks one feedback click', () => {
    TestBed.resetTestingModule();
    feedbackSurvey.trackClick.calls.reset();

    TestBed.configureTestingModule({
      imports: [MasterLandingPageComponent],
      providers: [
        provideRouter([]),
        SeoService,
        { provide: MasterFeedbackSurveyService, useValue: feedbackSurvey },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    });

    TestBed.inject(LanguageService).setLanguage('pt');

    const fixture = TestBed.createComponent(MasterLandingPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const workflow = root.querySelector('#workflow') as HTMLElement;
    const feedback = root.querySelector('.feedback-section') as HTMLElement;
    const link = feedback.querySelector('a') as HTMLAnchorElement;

    expect(workflow).not.toBeNull();
    expect(feedback).not.toBeNull();
    expect(
      Boolean(workflow.compareDocumentPosition(feedback) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBeTrue();

    expect(link.href).toBe(feedbackSurvey.surveyUrl);
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(feedback.textContent).toContain('Pesquisa em português');

    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(feedbackSurvey.trackClick).toHaveBeenCalledOnceWith('master_landing');
  });

  it('isolates the landing header controls from the legacy global header-controls selector', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MasterLandingPageComponent],
      providers: [
        provideRouter([]),
        SeoService,
        { provide: MasterFeedbackSurveyService, useValue: feedbackSurvey },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    });

    const fixture = TestBed.createComponent(MasterLandingPageComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.site-header') as HTMLElement;
    expect(header.querySelector('.master-header-controls')).not.toBeNull();
    expect(header.querySelector('.header-controls')).toBeNull();
  });
});
