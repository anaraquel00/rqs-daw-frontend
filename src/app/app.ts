// src/app/app.component.ts
import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './services/language.service';
import { AuthService } from './services/auth.service';
import { AnalyticsService } from './services/analytics.service';
import { CookieConsentComponent } from './cookie-consent/cookie-consent';
import { AuthModalComponent } from './auth-modal/auth-modal';
import { AuthPromptService } from './services/auth-prompt.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CookieConsentComponent, AuthModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly authPrompt = inject(AuthPromptService);

  constructor() {
    this.analytics.initialize();

    effect(() => {
      if (this.auth.authCallbackError()) {
        this.authPrompt.open('general');
      }
    });
  }
}
