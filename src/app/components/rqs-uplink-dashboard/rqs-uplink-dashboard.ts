import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeepLinkService, DeepLinkRecord } from '../../services/deep-link.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-rqs-uplink-dashboard',
  standalone: true,
  imports: [CommonModule],
  template:`
    <div class="rqs-dashboard-panel">
      <div class="dashboard-header">
        <h3>📊 {{ lang.tr().dashTitle }}</h3>
        <span class="badge-active">{{ links().length }} {{ lang.tr().activeLinks }}</span>
      </div>
      <p class="desc">{{ lang.tr().dashDesc }}</p>

      @if (links().length === 0) {
        <div class="empty-state">
          <p>{{ lang.tr().emptyLinks }}</p>
        </div>
      } @else {
        <div class="links-table-container">
          @for (link of links(); track link.id) {
            <div class="link-card-item">
              <div class="link-main-info">
                <div class="slug-row">
                  <span class="platform-tag">{{ link.platform | uppercase }}</span>
                  <span class="short-url">rqs.link/<strong>{{ link.customSlug }}</strong></span>
                </div>
                <a [href]="link.targetUrl" target="_blank" class="target-link">{{ link.targetUrl }}</a>
              </div>

              <div class="metrics-grid-mini">
                <div class="metric-box">
                  <span class="label">{{ lang.tr().clicksLabel }}</span>
                  <span class="value">{{ link.clicks }}</span>
                </div>
                <div class="metric-box">
                  <span class="label">{{ lang.tr().conversionLabel }}</span>
                  <span class="value highlight">{{ link.conversionRate }}</span>
                </div>
                <div class="metric-sources">
                  <span class="label">{{ lang.tr().trafficSources }}</span>
                  <div class="sources-pills">
                    <span>IG: {{ link.sources.instagram }}</span>
                    <span>TT: {{ link.sources.tiktok }}</span>
                    <span>FB: {{ link.sources.facebook }}</span>
                    <span>YT: {{ link.sources.youtube }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button class="btn-action copy" (click)="copyLink(link.customSlug)">{{ lang.tr().copyUrl }}</button>
                <button class="btn-action delete" (click)="removeLink(link.id)">{{ lang.tr().deleteBtn }}</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./rqs-uplink-dashboard.scss']
})
export class RqsUplinkDashboardComponent implements OnInit {
  private deepLinkService = inject(DeepLinkService);
  readonly lang = inject(LanguageService);
  links = signal<DeepLinkRecord[]>([]);

  ngOnInit() {
    this.loadLinks();
  }

  loadLinks() {
    this.links.set(this.deepLinkService.getAllLinks());
  }

  copyLink(slug: string) {
    const url = `https://rqs.link/${slug}`;
    navigator.clipboard.writeText(url);
    alert(`Link copiado para a área de transferência: ${url}`);
  }

  removeLink(id: string) {
    if (confirm('Tem certeza que deseja excluir este link? Esta ação não pode ser desfeita.')) {
      const updatedLinks = this.links().filter(link => link.id !== id);
      localStorage.setItem('rqs_uplink_database', JSON.stringify(updatedLinks));
      this.loadLinks();
    }
  }
}
