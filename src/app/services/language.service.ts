import { Injectable, computed, signal } from '@angular/core';
import {
  EN_DICT,
  EN_TRANSLATIONS,
  PL_DICT,
  PL_TRANSLATIONS,
  PT_DICT,
  PT_TRANSLATIONS,
} from './language-base';
import { FR_DICT, FR_TRANSLATIONS } from './language-fr';

export {
  EN_DICT,
  EN_TRANSLATIONS,
  PL_DICT,
  PL_TRANSLATIONS,
  PT_DICT,
  PT_TRANSLATIONS,
  FR_DICT,
  FR_TRANSLATIONS,
};

// Compatibility type used by existing page-local translation maps.
export type UiLanguage = 'en' | 'pt' | 'pl';
export type SupportedUiLanguage = UiLanguage | 'fr';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  // Existing page-local/hardcoded language branches keep receiving EN as the
  // defensive fallback while French is handled by the central dictionaries.
  readonly currentLang = signal<UiLanguage>('en');
  private readonly selectedLang = signal<SupportedUiLanguage>('en');

  readonly t = computed(() => {
    const language = this.selectedLang();
    if (language === 'pt') return PT_DICT;
    if (language === 'pl') return PL_DICT;
    if (language === 'fr') return FR_DICT;
    return EN_DICT;
  });

  readonly tr = computed(() => {
    const language = this.selectedLang();
    if (language === 'pt') return PT_TRANSLATIONS;
    if (language === 'pl') return PL_TRANSLATIONS;
    if (language === 'fr') return FR_TRANSLATIONS;
    return EN_TRANSLATIONS;
  });

  constructor() {
    this.detectLanguage();
  }

  setLanguage(lang: SupportedUiLanguage): void {
    this.selectedLang.set(lang);
    this.currentLang.set(lang === 'fr' ? 'en' : lang);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rqs_language', lang);
    }
  }

  isLanguage(lang: SupportedUiLanguage): boolean {
    return this.selectedLang() === lang;
  }

  private detectLanguage(): void {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem('rqs_language');
    if (stored === 'en' || stored === 'pt' || stored === 'pl' || stored === 'fr') {
      this.selectedLang.set(stored);
      this.currentLang.set(stored === 'fr' ? 'en' : stored);
      return;
    }

    // Product contract: English is the deterministic first-run language.
    // Browser locale must never silently override the primary UI language.
    this.selectedLang.set('en');
    this.currentLang.set('en');
  }
}
