import { Component, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { RouterLink, RouterModule } from '@angular/router';
import { CookieConsentService } from '../services/cookie-consent.service';

@Component({
  selector: 'app-footer',
  imports: [RouterModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  readonly lang = inject(LanguageService);
  readonly consent = inject(CookieConsentService);

  cookiesLabel(): string {
    if (this.lang.currentLang() === 'pl') return 'Pliki cookie';
    if (this.lang.currentLang() === 'fr') return 'Cookies';
    return 'Cookies';
  }

  cookiePreferencesLabel(): string {
    if (this.lang.currentLang() === 'pt') return 'Preferências de Cookies';
    if (this.lang.currentLang() === 'pl') return 'Preferencje cookie';
    if (this.lang.currentLang() === 'fr') return 'Préférences de cookies';
    return 'Cookie Preferences';
  }
}
