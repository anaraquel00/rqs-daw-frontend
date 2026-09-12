import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeepLinkRecord, DeepLinkService } from '../../services/deep-link.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-rqs-uplink-dashboard',
  standalone: true,
  imports: [CommonModule],
  template:`
    <div class="rqs-dashboard-panel">
      <div class="dashboard-kpis" [attr.aria-label]="lang.tr().UPLINK_SUMMARY">
        <div class="kpi"><span class="kpi-label">{{ lang.tr().activeLinks }}</span><strong>{{ links().length }}</strong></div>
        <div class="kpi"><span class="kpi-label">{{ lang.tr().UPLINK_TOTAL_CLICKS }}</span><strong>{{ totalClicks() }}</strong></div>
      </div>

      @if (feedback()) { <p class="feedback" role="status" aria-live="polite">{{ feedback() }}</p> }
      @if (actionError()) { <p class="action-error" role="alert">{{ actionError() }}</p> }

      @if (loading() && links().length === 0) {
        <div class="empty-state" role="status"><p>{{ lang.tr().UPLINK_LOADING }}</p></div>
      } @else if (error()) {
        <div class="empty-state" role="alert">
          <p>{{ error() }}</p>
          <button class="btn-action" type="button" (click)="refresh()">{{ lang.tr().UPLINK_RETRY }}</button>
        </div>
      } @else if (links().length === 0) {
        <div class="empty-state">
          <p>{{ lang.tr().emptyLinks }}</p>
        </div>
      } @else {
        <div class="dashboard-content">
          <div class="link-management">
            <div class="dashboard-header">
              <div><h2>{{ lang.tr().dashTitle }}</h2><p class="desc">{{ lang.tr().dashDesc }}</p></div>
              <span class="badge-active">{{ links().length }} {{ lang.tr().activeLinks }}</span>
            </div>
            <div class="list-controls">
              <label class="search-control"><span>{{ lang.tr().UPLINK_SEARCH }}</span>
                <input type="search" [value]="search()" (input)="search.set($any($event.target).value)" [placeholder]="lang.tr().UPLINK_SEARCH" />
              </label>
              <label class="filter-control"><span>{{ lang.tr().UPLINK_FILTER }}</span>
                <select [value]="platformFilter()" (change)="platformFilter.set($any($event.target).value)">
                  <option value="all">{{ lang.tr().UPLINK_ALL }}</option>
                  <option value="spotify">Spotify</option><option value="soundcloud">SoundCloud</option>
                  <option value="youtube">YouTube</option><option value="bandcamp">Bandcamp</option>
                  <option value="other">{{ lang.tr().UPLINK_OTHER }}</option>
                </select>
              </label>
            </div>
            @if (filteredLinks().length === 0) {
              <div class="empty-state">{{ lang.tr().UPLINK_NO_RESULTS }}</div>
            }
            <div class="links-table-container">
          @for (link of filteredLinks(); track link.id) {
            <div class="link-card-item">
              <div class="link-main-info">
                <div class="slug-row">
                  @if (link.platform) { <span class="platform-tag">{{ link.platform | uppercase }}</span> }
                  <span class="link-name">{{ displaySlug(link.customSlug) }}</span>
                </div>
                <span class="short-url">{{ shortUrl(link.customSlug) }}</span>
              </div>

              <div class="metrics-grid-mini">
                <div class="metric-box">
                  <span class="value">{{ link.clicks }}</span>
                  <span class="label">{{ lang.tr().clicksLabel }}</span>
                </div>
                @if (topSource(link); as source) {
                  <span class="top-source">{{ lang.tr().UPLINK_TOP_SOURCE }}: {{ source }}</span>
                }
              </div>

              <div class="card-actions">
                <button class="btn-action copy" type="button" (click)="copyLink(link.customSlug)">{{ lang.tr().copyUrl }}</button>
                <a class="btn-action" [href]="shortUrl(link.customSlug)" target="_blank" rel="noopener noreferrer">{{ lang.tr().UPLINK_OPEN }}</a>
                <button class="btn-action" type="button" [attr.aria-expanded]="expandedDetailsId() === link.id" [attr.aria-controls]="'uplink-details-' + link.id" (click)="toggleDetails(link.id)">{{ expandedDetailsId() === link.id ? lang.tr().UPLINK_HIDE_DETAILS : lang.tr().UPLINK_DETAILS }}</button>
                <div class="menu-wrap" (keydown.escape)="openMenuId.set(null)">
                  <button class="btn-action more" type="button" [attr.aria-label]="lang.tr().UPLINK_MORE_ACTIONS" aria-haspopup="true" [attr.aria-expanded]="openMenuId() === link.id" [attr.aria-controls]="'uplink-menu-' + link.id" (click)="toggleMenu(link.id)">•••</button>
                  @if (openMenuId() === link.id) {
                    <div class="menu-panel" [id]="'uplink-menu-' + link.id">
                      <button class="btn-action delete" type="button" [disabled]="deletingId() !== null" (click)="requestDelete(link.id)">{{ lang.tr().UPLINK_DELETE_LINK }}</button>
                    </div>
                  }
                </div>
              </div>
              @if (expandedDetailsId() === link.id) {
                <div class="link-details" [id]="'uplink-details-' + link.id">
                  <h4>{{ lang.tr().trafficSources }}</h4>
                  <div class="source-breakdown">
                    @for (source of sourceBreakdown(link); track source.label) {
                      <div class="source-row" [class.zero]="source.count === 0">
                        <span>{{ source.label }}</span><span>{{ source.count }}</span><span>{{ source.percent }}%</span>
                      </div>
                    }
                    <div class="source-row total-row"><span>{{ lang.tr().UPLINK_TOTAL }}</span><span>{{ link.clicks }}</span></div>
                  </div>
                  <p class="target-text"><span class="target-label">{{ lang.tr().UPLINK_DESTINATION }}</span><span class="target-url">{{ link.targetUrl }}</span></p>
                </div>
              }
              @if (confirmDeleteId() === link.id) {
                <div class="delete-confirm">
                  <p>{{ lang.tr().UPLINK_DELETE_CONFIRM }}</p>
                  <div class="card-actions">
                    <button class="btn-action" type="button" [disabled]="deletingId() !== null" (click)="cancelDelete()">{{ lang.tr().UPLINK_CANCEL }}</button>
                    <button class="btn-action delete" type="button" [disabled]="deletingId() !== null" (click)="confirmDelete(link.id)">{{ deletingId() === link.id ? lang.tr().UPLINK_DELETING : lang.tr().deleteBtn }}</button>
                  </div>
                </div>
              }
            </div>
          }
            </div>
          </div>
          <aside class="activity-panel" [attr.aria-label]="lang.tr().UPLINK_ACTIVITY">
            <h2>{{ lang.tr().UPLINK_ACTIVITY }}</h2>
            <dl>
              <div><dt>{{ lang.tr().UPLINK_TOTAL_CLICKS }}</dt><dd>{{ totalClicks() }}</dd></div>
              <div><dt>{{ lang.tr().UPLINK_TOP_SOURCE }}</dt><dd>{{ aggregateTopSource() || '—' }}</dd></div>
              <div><dt>{{ lang.tr().UPLINK_MOST_CLICKED }}</dt><dd class="slug-result">{{ mostClicked()?.customSlug || '—' }}</dd></div>
            </dl>
          </aside>
        </div>
      }
    </div>
  `,
  styleUrls: ['./rqs-uplink-dashboard.scss']
})
export class RqsUplinkDashboardComponent {
  private readonly deepLinkService = inject(DeepLinkService);
  readonly lang = inject(LanguageService);
  readonly links = this.deepLinkService.links;
  readonly loading = this.deepLinkService.loading;
  readonly error = this.deepLinkService.error;

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly search = signal('');
  readonly platformFilter = signal('all');
  readonly filteredLinks = computed(() => {
    const term = this.search().trim().toLowerCase();
    const platform = this.platformFilter();
    return this.links().filter(link => {
      const category = ['spotify', 'soundcloud', 'youtube', 'bandcamp'].includes((link.platform || '').toLowerCase())
        ? link.platform!.toLowerCase() : 'other';
      return (platform === 'all' || platform === category) &&
        (!term || [link.customSlug, this.shortUrl(link.customSlug), link.targetUrl]
          .some(value => value.toLowerCase().includes(term)));
    });
  });
  readonly totalClicks = computed(() => this.links().reduce((sum, link) => sum + link.clicks, 0));
  readonly mostClicked = computed(() => this.links().reduce<DeepLinkRecord | null>(
    (best, link) => !best || link.clicks > best.clicks ? link : best, null));
  readonly aggregateTopSource = computed(() => {
    const totals = this.links().reduce((sum, link) => ({
      direct: sum.direct + link.sources.direct,
      facebook: sum.facebook + link.sources.facebook,
      instagram: sum.instagram + link.sources.instagram,
      youtube: sum.youtube + link.sources.youtube,
      tiktok: sum.tiktok + link.sources.tiktok
    }), { direct: 0, facebook: 0, instagram: 0, youtube: 0, tiktok: 0 });
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    return top?.[1] ? top[0] === 'direct' ? this.lang.tr().UPLINK_DIRECT :
      top[0][0].toUpperCase() + top[0].slice(1) : null;
  });
  readonly expandedDetailsId = signal<string | null>(null);
  readonly openMenuId = signal<string | null>(null);
  private lastSessionEpoch = this.deepLinkService.sessionEpoch();

  constructor() {
    effect(() => {
      const epoch = this.deepLinkService.sessionEpoch();
      if (epoch === this.lastSessionEpoch) return;
      this.lastSessionEpoch = epoch;
      this.confirmDeleteId.set(null);
      this.deletingId.set(null);
      this.feedback.set(null);
      this.actionError.set(null);
      this.expandedDetailsId.set(null);
      this.openMenuId.set(null);
      this.search.set('');
      this.platformFilter.set('all');
    });
  }

  shortUrl(slug: string): string {
    return `https://go.raquelsynths.com/${encodeURIComponent(slug)}`;
  }

  displaySlug(slug: string): string {
    return slug.replace(/-/g, ' ');
  }

  sourceBreakdown(link: DeepLinkRecord): { label: string; count: number; percent: number }[] {
    return [
      { label: this.lang.tr().UPLINK_DIRECT, count: link.sources.direct },
      { label: 'Facebook', count: link.sources.facebook },
      { label: 'Instagram', count: link.sources.instagram },
      { label: 'YouTube', count: link.sources.youtube },
      { label: 'TikTok', count: link.sources.tiktok }
    ].sort((a, b) => b.count - a.count).map(source => ({
      ...source, percent: link.clicks > 0 ? Math.round(source.count * 100 / link.clicks) : 0
    }));
  }

  topSource(link: DeepLinkRecord): string | null {
    const top = this.sourceBreakdown(link)[0];
    return top.count > 0 ? top.label : null;
  }

  toggleDetails(linkId: string): void {
    this.expandedDetailsId.update(id => id === linkId ? null : linkId);
    this.openMenuId.set(null);
  }

  toggleMenu(linkId: string): void {
    this.openMenuId.update(id => id === linkId ? null : linkId);
  }

  refresh(): void {
    void this.deepLinkService.refreshLinks();
  }

  async copyLink(slug: string): Promise<void> {
    const epoch = this.deepLinkService.sessionEpoch();
    this.feedback.set(null);
    this.actionError.set(null);
    try {
      await navigator.clipboard.writeText(this.shortUrl(slug));
      if (epoch === this.deepLinkService.sessionEpoch()) this.feedback.set(this.lang.tr().UPLINK_COPIED);
    } catch {
      if (epoch === this.deepLinkService.sessionEpoch()) this.actionError.set(this.lang.tr().UPLINK_COPY_FAILED);
    }
  }

  requestDelete(linkId: string): void {
    if (this.deletingId()) return;
    this.openMenuId.set(null);
    this.feedback.set(null);
    this.actionError.set(null);
    this.confirmDeleteId.set(linkId);
  }

  cancelDelete(): void {
    if (!this.deletingId()) this.confirmDeleteId.set(null);
  }

  async confirmDelete(linkId: string): Promise<void> {
    if (this.deletingId() || this.confirmDeleteId() !== linkId) return;
    const epoch = this.deepLinkService.sessionEpoch();
    this.deletingId.set(linkId);
    try {
      const result = await this.deepLinkService.deleteLink(linkId);
      if (epoch !== this.deepLinkService.sessionEpoch() || result.stale) return;
      if (result.success) {
        this.confirmDeleteId.set(null);
        this.feedback.set(this.lang.tr().UPLINK_DELETE_SUCCESS);
      } else {
        this.actionError.set(result.error || this.lang.tr().UPLINK_DELETE_FAILED);
      }
    } finally {
      if (epoch === this.deepLinkService.sessionEpoch()) this.deletingId.set(null);
    }
  }
}
