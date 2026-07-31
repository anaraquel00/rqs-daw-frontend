// src/app/workspace/workspace.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { UploadZoneComponent } from "../components/upload-zone/upload-zone";
import { Footer } from '../footer/footer';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, MixPanelComponent, UploadZoneComponent, Footer],
  template: `
    <!-- 🛰️ ENVELOPE DO MAINFRAME DA DAW (Movido para cá!) [1.1.2] -->
    <div class="rqs-mainframe-container" style="padding: 20px; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between;">

      <!-- 🛰️ RQS GLOBAL WORKSTATION HEADER -->
      <header class="rqs-mainframe-header" style="margin-bottom: 30px;">
        <!-- Esquerda: Branding -->
        <div class="header-branding">
          <span class="satellite-icon">🛰️</span>
          <h1 class="header-title">RAQUEL SYNTHS DIGITAL AUDIO WORKSTATION</h1>
        </div>

        <!-- Centro: Central de Controle de Acesso e Idiomas Global [1, 1.1] -->
        <div class="header-controls">
          <!-- Seletor de Idiomas -->
          <div class="lang-selector">
            <button (click)="lang.setLanguage('pt')" [style.color]="lang.currentLang() === 'pt' ? '#00ffcc' : '#666'">PT</button>
            <span class="divider">|</span>
            <button (click)="lang.setLanguage('en')" [style.color]="lang.currentLang() === 'en' ? '#00ffcc' : '#666'">EN</button>
          </div>

          <!-- Sessão de Login (Supabase Auth) [1] -->
          <div class="user-session">
            @if (!auth.session()) {
              <div class="auth-helper-container" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-right: 12px;">
                <span style="font-size: 9px; font-family: monospace; color: #8b949e; letter-spacing: 0.5px;">SALVAR HISTÓRICO & EXPORTAR WAV:</span>
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

        <!-- Direita: Status -->
        <div class="header-status">
          <span class="status-led"></span>
          <span class="status-text">CORE STATUS: OPERATIONAL</span>
        </div>
      </header>

      <!-- 🎛️ A GRADE DE ENGENHARIA PRINCIPAL DA WORKSTATION (Lado a lado) -->
      <div class="workspace-grid" style="margin-bottom: 30px;">
         <app-upload-zone></app-upload-zone>
         <app-mix-panel></app-mix-panel>
      </div>

      <!-- Rodapé do Studio -->
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .workspace-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 900px) {
      .workspace-grid {
        grid-template-columns: 1fr 1fr; /* Lado a lado em telas grandes */
      }
    }
  `]
})
export class WorkspaceComponent {
  // Injeta os serviços reativos necessários para o funcionamento do cabeçalho
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
}
