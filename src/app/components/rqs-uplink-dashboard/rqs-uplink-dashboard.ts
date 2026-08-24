import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeepLinkService } from '../../services/deep-link.service';
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

      @if (loading()) {
        <div class="empty-state"><p>Loading...</p></div>
      } @else if (error()) {
        <div class="empty-state"><p>{{ error() }}</p></div>
      } @else if (links().length === 0) {
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
                  <span class="short-url">go.raquelsynths.com/<strong>{{ link.customSlug }}</strong></span>
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
                  <span class="value highlight">N/A</span>
                </div>
                <div class="metric-sources">
                  <span class="label">{{ lang.tr().trafficSources }}</span>
                  <div class="sources-pills">
                    <span>IG: {{ link.sources.instagram }}</span>
                    <span>TT: {{ link.sources.tiktok }}</span>
                    <span>FB: {{ link.sources.facebook }}</span>
                    <span>YT: {{ link.sources.youtube }}</span>
                    <span>Direct: {{ link.sources.direct }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button class="btn-action copy" (click)="copyLink(link.customSlug)">{{ lang.tr().copyUrl }}</button>
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
  readonly links = this.deepLinkService.links;
  readonly loading = this.deepLinkService.loading;
  readonly error = this.deepLinkService.error;

  ngOnInit() {
    void this.deepLinkService.refreshLinks();
  }

  copyLink(slug: string) {
    const url = `https://go.raquelsynths.com/${slug}`;
    navigator.clipboard.writeText(url);
    alert(`Link copiado para a área de transferência: ${url}`);
  }
}
