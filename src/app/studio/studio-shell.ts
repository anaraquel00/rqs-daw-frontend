import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { UploadZoneComponent } from '../components/upload-zone/upload-zone';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { RqsUplinkEngineComponent } from '../rqs-uplink-engine/rqs-uplink-engine';
import { RqsUplinkDashboardComponent } from '../components/rqs-uplink-dashboard/rqs-uplink-dashboard';
import { AuthPromptComponent } from '../components/auth-prompt/auth-prompt';
import { StudioFooterComponent } from './studio-footer';
import { ModuleSelectorComponent } from './module-selector';
import { STUDIO_COPY } from './studio-copy';
import { SeoService } from '../services/seo.service';
import { StudioSurface, studioSeoConfig } from './studio-seo';

type StudioThemePreference = 'auto' | 'light' | 'dark';
const STUDIO_THEME_KEY = 'rqs_theme';

@Component({
  selector: 'app-studio-shell', standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UploadZoneComponent, MixPanelComponent,
    RqsUplinkEngineComponent, RqsUplinkDashboardComponent, AuthPromptComponent, StudioFooterComponent, ModuleSelectorComponent],
  templateUrl: './studio-shell.html', styleUrl: './studio-shell.scss',
  host: { '[attr.data-theme]': 'resolvedTheme()' },
})
export class StudioShellComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  readonly copy = computed(() => STUDIO_COPY[this.lang.currentLang()]);
  readonly languages = ['pt', 'en', 'pl', 'fr'] as const;
  readonly themes = ['auto', 'light', 'dark'] as const;
  readonly themePreference = signal<StudioThemePreference>('dark');
  private readonly systemTheme = signal<'light' | 'dark'>('dark');
  readonly resolvedTheme = computed(() => this.themePreference() === 'auto' ? this.systemTheme() : this.themePreference());
  readonly modules = ['master', 'build', 'uplink', 'split'] as const;
  readonly surface = signal<StudioSurface>('home');
  readonly visited = signal<ReadonlySet<StudioSurface>>(new Set());
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly seo = inject(SeoService);

  constructor() {
    this.initializeTheme();
    this.syncSurface();
    effect(() => {
      this.seo.update(studioSeoConfig(this.surface(), this.lang.currentLang()));
    });
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncSurface());
    // Drop retained engine views across identity boundaries; no user A audio or
    // upload/job state is handed to user B. Existing services keep their guards.
    let previousUser = this.auth.session()?.user.id ?? null;
    effect(() => {
      const user = this.auth.session()?.user.id ?? null;
      if (user !== previousUser) {
        const previous = previousUser;
        previousUser = user;
        // A sign-in callback must keep its validated V2 destination. A full
        // identity exit or user-to-user switch still disposes retained engines.
        if (previous === null && user !== null) return;
        this.visited.set(new Set());
        // Re-enter the selected surface on the next navigation, after disposal.
        void this.router.navigateByUrl('/app');
      }
    });
  }

  setTheme(theme: StudioThemePreference): void {
    this.themePreference.set(theme);
  }

  private initializeTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const stored = window.localStorage.getItem(STUDIO_THEME_KEY);
      if (stored === 'auto' || stored === 'light' || stored === 'dark') this.themePreference.set(stored);
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }

    const preference = window.matchMedia('(prefers-color-scheme: light)');
    const syncSystemTheme = (matches: boolean) => this.systemTheme.set(matches ? 'light' : 'dark');
    const onPreferenceChange = (event: MediaQueryListEvent) => syncSystemTheme(event.matches);
    syncSystemTheme(preference.matches);
    preference.addEventListener('change', onPreferenceChange);
    this.destroyRef.onDestroy(() => preference.removeEventListener('change', onPreferenceChange));

    effect(() => {
      try {
        window.localStorage.setItem(STUDIO_THEME_KEY, this.themePreference());
      } catch {
        // The selected theme still works for the current session without persistence.
      }
    });
  }

  private syncSurface(): void {
    const next = (this.route.firstChild?.snapshot?.data['surface'] ?? 'home') as StudioSurface;
    this.surface.set(next);
    this.visited.update(current => new Set([...current, next]));
  }
}
