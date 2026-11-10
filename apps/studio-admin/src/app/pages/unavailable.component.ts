import { Component } from '@angular/core';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-unavailable',
  standalone: true,
  template: `
    <main class="access-screen"><section class="access-card">
      <p class="eyebrow">SERVICE STATE</p><h1>API UNAVAILABLE</h1>
      <p class="lede">The administrative control plane could not be reached. No data was changed.</p>
      <button type="button" (click)="retry()">RETRY</button>
    </section></main>
  `,
  styleUrl: './access.component.scss',
})
export class UnavailableComponent {
  constructor(seo: AdminSeoService) { seo.setCanonical('/unavailable'); }
  retry(): void { window.location.assign('/'); }
}
