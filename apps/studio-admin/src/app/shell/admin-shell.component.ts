import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';

@Component({
  selector: 'rqs-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin-shell">
      <header class="topbar">
        <div>
          <span class="signal"></span>
          <strong>RQS STUDIO ADMIN</strong>
        </div>
        <span class="read-only">READ ONLY</span>
      </header>
      <aside class="sidebar" aria-label="Admin navigation">
        <p class="nav-label">CONTROL ROOM</p>
        <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active">OVERVIEW</a>
        <a routerLink="/waitlist" routerLinkActive="active">WAITLIST</a>
        <div class="sidebar-spacer"></div>
        <button type="button" (click)="logout()" [disabled]="signingOut()">SIGN OUT</button>
      </aside>
      <main><router-outlet /></main>
      <footer>
        <span>{{ environment }}</span>
        <span>ROLE: {{ role() }}</span>
        <span>VERSION: PHASE 1</span>
      </footer>
    </div>
  `,
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  readonly role = signal('VERIFYING');
  readonly signingOut = signal(false);
  readonly environment = window.location.hostname;

  constructor() {
    void this.api.me()
      .then(identity => this.role.set(identity.role.toUpperCase()))
      .catch(() => this.role.set('N/A'));
  }

  async logout(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/login');
    } finally {
      this.signingOut.set(false);
    }
  }
}
