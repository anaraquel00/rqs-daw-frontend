import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  REQUEST,
  computed,
  inject,
  signal,
} from '@angular/core';
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
export type UiLanguage = 'en' | 'pt' | 'pl' | 'fr';
export type SupportedUiLanguage = UiLanguage;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storageKey = 'rqs_language';
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly request = inject(REQUEST, { optional: true });

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
    this.applyLanguage(lang);

    // Persist only an explicit user choice. Automatic browser/request detection
    // must remain transient so first-run language follows the user's locale.
    if (isPlatformBrowser(this.platformId)) {
      window.localStorage.setItem(this.storageKey, lang);
    }
  }

  isLanguage(lang: SupportedUiLanguage): boolean {
    return this.selectedLang() === lang;
  }

  private detectLanguage(): void {
    const stored = this.readStoredLanguage();
    if (stored) {
      this.applyLanguage(stored);
      return;
    }

    const detected = isPlatformBrowser(this.platformId)
      ? this.getBrowserLanguage()
      : this.getRequestLanguage(this.request?.headers.get('accept-language'));

    this.applyLanguage(detected);
  }

  private readStoredLanguage(): SupportedUiLanguage | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return this.normalizeLanguage(window.localStorage.getItem(this.storageKey));
  }

  private getBrowserLanguage(): SupportedUiLanguage {
    const browserLanguages =
      window.navigator.languages?.length
        ? window.navigator.languages
        : [window.navigator.language];

    for (const language of browserLanguages) {
      const normalized = this.normalizeLanguage(language);
      if (normalized) {
        return normalized;
      }
    }

    return 'en';
  }

  private getRequestLanguage(
    acceptLanguage: string | null | undefined,
  ): SupportedUiLanguage {
    if (!acceptLanguage) {
      return 'en';
    }

    const preferences = acceptLanguage
      .split(',')
      .map((preference, index) => {
        const [languageRange, ...parameters] = preference
          .trim()
          .toLowerCase()
          .split(';');
        const language = this.normalizeLanguage(languageRange);
        const qualityParameter = parameters.find((parameter) =>
          parameter.trim().startsWith('q='),
        );
        const parsedQuality = qualityParameter
          ? Number.parseFloat(qualityParameter.trim().slice(2))
          : 1;

        return {
          language,
          quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
          index,
        };
      })
      .filter(
        (
          preference,
        ): preference is {
          language: SupportedUiLanguage;
          quality: number;
          index: number;
        } => Boolean(preference.language) && preference.quality > 0,
      )
      .sort((a, b) => b.quality - a.quality || a.index - b.index);

    return preferences[0]?.language ?? 'en';
  }

  private normalizeLanguage(
    language: string | null | undefined,
  ): SupportedUiLanguage | null {
    const baseLanguage = language?.trim().toLowerCase().split('-')[0];

    if (baseLanguage === 'pt') return 'pt';
    if (baseLanguage === 'pl') return 'pl';
    if (baseLanguage === 'fr') return 'fr';
    if (baseLanguage === 'en') return 'en';

    return null;
  }

  private applyLanguage(language: SupportedUiLanguage): void {
    this.selectedLang.set(language);
    this.currentLang.set(language);
    this.document.documentElement.lang = this.toHtmlLanguage(language);
  }

  private toHtmlLanguage(language: SupportedUiLanguage): string {
    if (language === 'pt') return 'pt-BR';
    if (language === 'pl') return 'pl-PL';
    if (language === 'fr') return 'fr-FR';
    return 'en-US';
  }
}
