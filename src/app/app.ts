// src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './services/language.service';
import { AuthService } from './services/auth.service';
import { AnalyticsService } from './services/analytics.service';
import { CookieConsentComponent } from './cookie-consent/cookie-consent';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, CookieConsentComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  host: { '[attr.data-theme]': 'theme.resolvedTheme()' }
})
export class AppComponent {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly analytics = inject(AnalyticsService);

  constructor() {
    this.analytics.initialize();
  }
}
