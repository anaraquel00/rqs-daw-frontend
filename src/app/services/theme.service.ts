import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type StudioThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedStudioTheme = 'light' | 'dark';

const STUDIO_THEME_KEY = 'rqs_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes = ['auto', 'light', 'dark'] as const;
  readonly themePreference = signal<StudioThemePreference>('dark');
  private readonly systemTheme = signal<ResolvedStudioTheme>('dark');
  readonly resolvedTheme = computed<ResolvedStudioTheme>(() =>
    this.themePreference() === 'auto' ? this.systemTheme() : this.themePreference()
  );

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.initialize();
  }

  setTheme(theme: StudioThemePreference): void {
    this.themePreference.set(theme);
  }

  private initialize(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const stored = window.localStorage.getItem(STUDIO_THEME_KEY);
      if (stored === 'auto' || stored === 'light' || stored === 'dark') {
        this.themePreference.set(stored);
      }
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }

    const preference = window.matchMedia('(prefers-color-scheme: light)');
    const syncSystemTheme = (matches: boolean) =>
      this.systemTheme.set(matches ? 'light' : 'dark');
    const onPreferenceChange = (event: MediaQueryListEvent) =>
      syncSystemTheme(event.matches);

    syncSystemTheme(preference.matches);
    preference.addEventListener('change', onPreferenceChange);
    this.destroyRef.onDestroy(() =>
      preference.removeEventListener('change', onPreferenceChange)
    );

    effect(() => {
      try {
        window.localStorage.setItem(STUDIO_THEME_KEY, this.themePreference());
      } catch {
        // The selected theme still works for the current session without persistence.
      }
    });
  }
}
