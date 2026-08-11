// src/app/workspace/workspace.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { UploadZoneComponent } from '../components/upload-zone/upload-zone';
import { Footer } from '../footer/footer';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { RqsUplinkEngineComponent } from '../rqs-uplink-engine/rqs-uplink-engine';
import { RqsUplinkDashboardComponent } from '../components/rqs-uplink-dashboard/rqs-uplink-dashboard';

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
            <button
              type="button"
              (click)="lang.setLanguage('en')"
              [attr.aria-pressed]="lang.currentLang() === 'en'"
              [style.color]="lang.currentLang() === 'en' ? '#00ffcc' : '#666'">EN</button>
            <span class="divider">|</span>
            <button
              type="button"
              (click)="lang.setLanguage('pt')"
              [attr.aria-pressed]="lang.currentLang() === 'pt'"
              [style.color]="lang.currentLang() === 'pt' ? '#00ffcc' : '#666'">PT-BR</button>
            <span class="divider">|</span>
            <button
              type="button"
              (click)="lang.setLanguage('pl')"
              [attr.aria-pressed]="lang.currentLang() === 'pl'"
              [style.color]="lang.currentLang() === 'pl' ? '#00ffcc' : '#666'">PL</button>
          </div>

          <div class="user-session">
            @if (!auth.session()) {
              <div class="auth-helper-container" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-right: 10px;">
                <span style="font-size: 9px; font-family: monospace; color: #8b949e; letter-spacing: 0.5px;">
                  {{ lang.currentLang() === 'pl' ? 'ZAPISZ HISTORIĘ I EKSPORTUJ WAV:' : (lang.currentLang() === 'pt' ? 'SALVAR HISTÓRICO & EXPORTAR WAV:' : 'SAVE HISTORY & EXPORT WAV:') }}
                </span>
                <div class="auth-buttons">
                  <button (click)="auth.loginWithProvider('github')" class="btn-auth github">🐈 GITHUB</button>
                  <button (click)="auth.loginWithProvider('google')" class="btn-auth google">🌐 GOOGLE</button>
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
                <img [src]="auth.session()?.user?.user_metadata?.avatar_url || 'assets/default-avatar.png'" class="avatar" alt="Avatar">
                <button (click)="auth.logout()" class="btn-logout">⏏️</button>
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
  `]
})
export class WorkspaceComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
}
