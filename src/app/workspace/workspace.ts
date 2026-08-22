// src/app/workspace/workspace.ts
import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { UploadZoneComponent } from '../components/upload-zone/upload-zone';
import { Footer } from '../footer/footer';
import { AuthService } from '../services/auth.service';
import { AuthPromptService } from '../services/auth-prompt.service';
import { LanguageService } from '../services/language.service';
import { RqsUplinkEngineComponent } from '../rqs-uplink-engine/rqs-uplink-engine';
import { RqsUplinkDashboardComponent } from '../components/rqs-uplink-dashboard/rqs-uplink-dashboard';
import { SeoService } from '../services/seo.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, MixPanelComponent, UploadZoneComponent, Footer, RqsUplinkEngineComponent, RqsUplinkDashboardComponent],
  template: `
    <div class="rqs-mainframe-container" style="padding: 20px; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between;">
      <header class="rqs-mainframe-header" style="margin-bottom: 30px;">
        <div class="header-branding">
          <span class="satellite-icon">🛰️</span>
          <h1 class="header-title">RAQUEL SYNTHS DIGITAL AUDIO WORKSTATION</h1>
        </div>

        <div class="header-controls">
          <div class="lang-selector" aria-label="Interface language">
            <button type="button" (click)="lang.setLanguage('pt')"
              [attr.aria-pressed]="lang.currentLang() === 'pt'"
              [style.color]="lang.currentLang() === 'pt' ? '#00ffcc' : '#666'">PT</button>
            <span class="divider">|</span>
            <button type="button" (click)="lang.setLanguage('en')"
              [attr.aria-pressed]="lang.currentLang() === 'en'"
              [style.color]="lang.currentLang() === 'en' ? '#00ffcc' : '#666'">EN</button>
            <span class="divider">|</span>
            <button type="button" (click)="lang.setLanguage('pl')"
              [attr.aria-pressed]="lang.currentLang() === 'pl'"
              [style.color]="lang.currentLang() === 'pl' ? '#00ffcc' : '#666'">PL</button>
            <span class="divider">|</span>
            <button type="button" (click)="lang.setLanguage('fr')"
              [attr.aria-pressed]="lang.currentLang() === 'fr'"
              [style.color]="lang.currentLang() === 'fr' ? '#00ffcc' : '#666'">FR</button>
          </div>

          <div class="user-session">
            @if (!auth.session()) {
              <div class="auth-helper-container" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-right: 10px;">
                <span style="font-size: 9px; font-family: monospace; color: #8b949e; letter-spacing: 0.5px;">
                  {{ authHelperText() }}
                </span>
                <div class="auth-buttons">
                  <button (click)="auth.loginWithProvider('github')" class="btn-auth github">🐈 GITHUB</button>
                  <button (click)="auth.loginWithProvider('google')" class="btn-auth google">🌐 GOOGLE</button>
                  <button (click)="authPrompt.open('general')" class="btn-auth email">✉ EMAIL</button>
                </div>
              </div>
            } @else {
              <div class="user-profile">
                <div class="profile-info">
                  <p class="email">{{ auth.session()?.user?.email }}</p>
                  <span class="badge" [style.color]="auth.userRole() === 'premium' ? '#00ff88' : '#888'">
                    {{ auth.userRole() === 'premium' ? 'RQS PRO' : 'FREE USER' }}
                  </span>
                </div>
                <img [src]="auth.session()?.user?.user_metadata?.[avatar_url] || 'assets/default-avatar.png'" class="avatar" alt="Avatar">
                <button (click)="auth.logout()" class="btn-logout" aria-label="Sign out">⏏️</button>
              </div>
            }
          </div>
        </div>

        <div class="header-status">
          <span class="status-led"></span>
          <span class="status-text">CORE STATUS: OPERATIONAL</span>
        </div>
      </header>

      <div class="workspace-grid" style="margin-bottom: 25px;">
         <div class="left-workstation-column">
           <app-upload-zone></app-upload-zone>
         </div>
         <div class="right-workstation-column">
           <app-mix-panel></app-mix-panel>
           <app-rqs-uplink-engine></app-rqs-uplink-engine>
           <app-rqs-uplink-dashboard></app-rqs-uplink-dashboard>
         </div>
      </div>

      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .workspace-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      width: 100%;
      max-width: 98%;
      margin: 0 auto;
      align-items: start;
    }

    .auth-buttons {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }

    @media (min-width: 768px) {
      .workspace-grid {
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }

      .left-workstation-column {
        position: sticky;
        top: 20px;
      }
    }

    .left-workstation-column {
      width: 100%;
    }

    .right-workstation-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
    }

    @media (max-width: 640px) {
      .rqs-mainframe-container {
        padding-inline: 12px !important;
      }

      .header-controls,
      .auth-helper-container {
        align-items: flex-start !important;
      }

      .auth-buttons {
        justify-content: flex-start;
      }
    }
  `]
})
export class WorkspaceComponent {
  readonly auth = inject(AuthService);
  readonly authPrompt = inject(AuthPromptService);
  readonly lang = inject(LanguageService);
  private seo = inject(SeoService);

  avatarUrl = this.auth.session()?.user?.user_metadata?.['avatar_url'] || 'assets/default-avatar.png';
  avatar_url: string = 'avatar_url';

  constructor() {
    effect(() => {
      const currentLang = this.lang.currentLang();
      const canonicalUrl = 'https://studio.raquelsynths.com/app';

      const meta = {
        pt: {
          title: 'RQS Studio | Masterização, DSP, Setlists e Deep Links',
          description: 'Acesse o RQS Studio: masterização inteligente de áudio, RQS DSP Core, Setlist Engine e Uplink Engine em uma workstation musical integrada.',
          locale: 'pt_BR'
        },
        en: {
          title: 'RQS Studio | Mastering, DSP, Setlists & Deep Links',
          description: 'Access RQS Studio: intelligent audio mastering, RQS DSP Core, Setlist Engine and Uplink Engine in one integrated music workstation.',
          locale: 'en_US'
        },
        pl: {
          title: 'RQS Studio | Mastering, DSP, Setlisty i Deep Linki',
          description: 'RQS Studio łączy mastering audio, RQS DSP Core, Setlist Engine i Uplink Engine w jednym webowym środowisku pracy.',
          locale: 'pl_PL'
        },
        fr: {
          title: 'RQS Studio | Mastering, DSP, Setlists et Deep Links',
          description: 'RQS Studio réunit mastering audio, RQS DSP Core, Setlist Engine et Uplink Engine dans une station de travail musicale web intégrée.',
          locale: 'fr_FR'
        }
      }[currentLang];

      this.seo.update({
        title: meta.title,
        description: meta.description,
        url: canonicalUrl,
        type: 'website',
        locale: meta.locale,
        siteName: 'RQS Studio',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RQS Studio',
          alternateName: 'RaQuel Synths Digital Audio Workstation',
          applicationCategory: 'MultimediaApplication',
          applicationSubCategory: 'Digital Audio Workstation',
          operatingSystem: 'Web Browser',
          url: canonicalUrl,
          description: meta.description,
          creator: {
            '@type': 'Organization',
            name: 'RaQuel Synths',
            url: 'https://raquelsynths.com'
          },
          offers: {
            '@type': 'Offer',
            category: 'SaaS'
          }
        }
      });
    });
  }

  authHelperText(): string {
    if (this.lang.currentLang() === 'pt') return 'SALVAR HISTÓRICO & EXPORTAR WAV:';
    if (this.lang.currentLang() === 'pl') return 'ZAPISZ HISTORIĘ I EKSPORTUJ WAV:';
    if (this.lang.currentLang() === 'fr') return 'ENREGISTRER L’HISTORIQUE & EXPORTER WAV :';
    return 'SAVE HISTORY & EXPORT WAV:';
  }
}
