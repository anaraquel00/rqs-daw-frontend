import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService } from '../core/admin-auth.service';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-forbidden',
  standalone: true,
  template: `
    <main class="access-screen"><section class="access-card">
      <p class="eyebrow">HTTP 403</p><h1>ACCESS DENIED</h1>
      <p class="lede">Your account does not have RQS Studio administrative access.</p>
      <button type="button" (click)="signOut()">SIGN OUT</button>
    </section></main>
  `,
  styleUrl: './access.component.scss',
})
export class ForbiddenComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  constructor(seo: AdminSeoService) { seo.setCanonical('/forbidden'); }
  async signOut(): Promise<void> { await this.auth.signOut(); await this.router.navigateByUrl('/login'); }
}
