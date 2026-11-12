import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import { LanguageService, type UiLanguage } from './language.service';

export type MasterFeedbackPlacement =
  | 'master_landing'
  | 'master_workspace_header';

const SURVEY_URLS: Record<UiLanguage, string> = {
  pt: 'https://docs.google.com/forms/d/e/1FAIpQLScGDnx4BurVwvQbGBUvWi0j4v1L60KKKDcIeU2GYSQDDeK0AQ/viewform',
  en: 'https://docs.google.com/forms/d/e/1FAIpQLSejrsprLW_VVIgagnRSwoZK9GO6QQ8USJfMigckmBYRZ8qOZA/viewform',
  fr: 'https://docs.google.com/forms/d/e/1FAIpQLSfXARQgscMZaiZwyC9b5T3gj56VpAsuIxdlP4LP0vEmv7F-PQ/viewform',
  pl: 'https://docs.google.com/forms/d/e/1FAIpQLSdE-dHdhrLNqtahlALt1B0ioY_7C6JtLDyyDtxaoCYEQCA0bA/viewform'
};

@Injectable({
  providedIn: 'root'
})
export class MasterFeedbackSurveyService {
  readonly surveyId = 'master_experience_beta_202611';

  get surveyUrl(): string {
    return SURVEY_URLS[this.lang.currentLang()];
  }

  private readonly workspaceDismissedKey =
    'rqs_master_feedback_dismissed_v1';

  private readonly platformId = inject(PLATFORM_ID);
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);

  readonly workspaceDismissed = signal(this.readWorkspaceDismissed());

  trackClick(placement: MasterFeedbackPlacement): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.analytics.trackEvent('master_feedback_clicked', {
      placement,
      page_path: window.location.pathname || '/',
      survey_id: this.surveyId,
      ui_language: this.lang.currentLang(),
      auth_state: this.auth.isLoggedIn()
        ? 'authenticated'
        : 'anonymous'
    });
  }

  dismissWorkspace(): void {
    if (!isPlatformBrowser(this.platformId) || this.workspaceDismissed()) {
      return;
    }

    window.sessionStorage.setItem(this.workspaceDismissedKey, 'true');
    this.workspaceDismissed.set(true);

    this.analytics.trackEvent('master_feedback_dismissed', {
      placement: 'master_workspace_header',
      survey_id: this.surveyId
    });
  }

  private readWorkspaceDismissed(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;

    return window.sessionStorage.getItem(this.workspaceDismissedKey) === 'true';
  }
}
