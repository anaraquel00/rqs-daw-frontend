import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';

export type MasterFeedbackPlacement =
  | 'master_landing'
  | 'master_workspace_header';

@Injectable({
  providedIn: 'root'
})
export class MasterFeedbackSurveyService {
  readonly surveyId = 'master_experience_beta_202611';

  readonly surveyUrl =
    'https://docs.google.com/forms/d/e/1FAIpQLSejrsprLW_VVIgagnRSwoZK9GO6QQ8USJfMigckmBYRZ8qOZA/viewform';

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
