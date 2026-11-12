import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';
import { MasterFeedbackSurveyService } from './master-feedback-survey.service';

describe('MasterFeedbackSurveyService', () => {
  const storageKey = 'rqs_master_feedback_dismissed_v1';

  let analytics: jasmine.SpyObj<AnalyticsService>;
  let loggedIn: ReturnType<typeof signal<boolean>>;
  let language: ReturnType<typeof signal<'pt' | 'en' | 'pl' | 'fr'>>;

  beforeEach(() => {
    sessionStorage.removeItem(storageKey);
    history.replaceState({}, '', '/master/online');

    analytics = jasmine.createSpyObj<AnalyticsService>(
      'AnalyticsService',
      ['trackEvent']
    );

    loggedIn = signal(false);
    language = signal<'pt' | 'en' | 'pl' | 'fr'>('pt');

    TestBed.configureTestingModule({
      providers: [
        MasterFeedbackSurveyService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AnalyticsService, useValue: analytics },
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: loggedIn
          }
        },
        {
          provide: LanguageService,
          useValue: {
            currentLang: language
          }
        }
      ]
    });
  });

  afterEach(() => {
    sessionStorage.removeItem(storageKey);
    history.replaceState({}, '', '/');
  });

  it('routes each supported UI language to its dedicated survey', () => {
    const service = TestBed.inject(MasterFeedbackSurveyService);

    const expected = {
      pt: 'https://docs.google.com/forms/d/e/1FAIpQLScGDnx4BurVwvQbGBUvWi0j4v1L60KKKDcIeU2GYSQDDeK0AQ/viewform',
      en: 'https://docs.google.com/forms/d/e/1FAIpQLSejrsprLW_VVIgagnRSwoZK9GO6QQ8USJfMigckmBYRZ8qOZA/viewform',
      fr: 'https://docs.google.com/forms/d/e/1FAIpQLSfXARQgscMZaiZwyC9b5T3gj56VpAsuIxdlP4LP0vEmv7F-PQ/viewform',
      pl: 'https://docs.google.com/forms/d/e/1FAIpQLSdE-dHdhrLNqtahlALt1B0ioY_7C6JtLDyyDtxaoCYEQCA0bA/viewform'
    } as const;

    for (const code of ['pt', 'en', 'fr', 'pl'] as const) {
      language.set(code);
      expect(service.surveyUrl)
        .withContext(code)
        .toBe(expected[code]);
    }
  });

  it('tracks a privacy-safe survey click for an anonymous landing visitor', () => {
    const service = TestBed.inject(MasterFeedbackSurveyService);

    service.trackClick('master_landing');

    expect(analytics.trackEvent).toHaveBeenCalledOnceWith(
      'master_feedback_clicked',
      {
        placement: 'master_landing',
        page_path: '/master/online',
        survey_id: 'master_experience_beta_202611',
        ui_language: 'pt',
        auth_state: 'anonymous'
      }
    );
  });

  it('tracks authenticated workspace clicks without personal identifiers', () => {
    history.replaceState({}, '', '/app/master');
    loggedIn.set(true);
    language.set('en');

    const service = TestBed.inject(MasterFeedbackSurveyService);

    service.trackClick('master_workspace_header');

    expect(analytics.trackEvent).toHaveBeenCalledOnceWith(
      'master_feedback_clicked',
      {
        placement: 'master_workspace_header',
        page_path: '/app/master',
        survey_id: 'master_experience_beta_202611',
        ui_language: 'en',
        auth_state: 'authenticated'
      }
    );
  });

  it('persists workspace dismissal for the current session and emits it once', () => {
    const service = TestBed.inject(MasterFeedbackSurveyService);

    service.dismissWorkspace();
    service.dismissWorkspace();

    expect(service.workspaceDismissed()).toBeTrue();
    expect(sessionStorage.getItem(storageKey)).toBe('true');

    expect(analytics.trackEvent).toHaveBeenCalledOnceWith(
      'master_feedback_dismissed',
      {
        placement: 'master_workspace_header',
        survey_id: 'master_experience_beta_202611'
      }
    );
  });
});
