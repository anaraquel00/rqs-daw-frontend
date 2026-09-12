import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RqsUplinkDashboardComponent } from './rqs-uplink-dashboard';
import { DeepLinkRecord, DeepLinkService } from '../../services/deep-link.service';
import { LanguageService } from '../../services/language.service';
import { EN_TRANSLATIONS, FR_TRANSLATIONS, PL_TRANSLATIONS, PT_TRANSLATIONS } from '../../services/language.service';

describe('RqsUplinkDashboardComponent', () => {
  const link: DeepLinkRecord = {
    id: 'owner-link', customSlug: 'song-slug', targetUrl: 'https://example.org/song',
    platform: 'spotify', createdAt: '2026-08-24T00:00:00Z', clicks: 5,
    sources: { instagram: 1, tiktok: 1, facebook: 1, youtube: 1, direct: 1 }
  };
  let links: ReturnType<typeof signal<DeepLinkRecord[]>>;
  let loading: ReturnType<typeof signal<boolean>>;
  let error: ReturnType<typeof signal<string | null>>;
  let sessionEpoch: ReturnType<typeof signal<number>>;
  let refreshLinks: jasmine.Spy;
  let deleteLink: jasmine.Spy;
  let writeText: jasmine.Spy;

  beforeEach(async () => {
    links = signal<DeepLinkRecord[]>([link]);
    loading = signal(false);
    error = signal<string | null>(null);
    sessionEpoch = signal(0);
    refreshLinks = jasmine.createSpy().and.resolveTo();
    deleteLink = jasmine.createSpy().and.resolveTo({ success: true });
    writeText = jasmine.createSpy().and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText }
    });
    await TestBed.configureTestingModule({
      imports: [RqsUplinkDashboardComponent],
      providers: [
        { provide: DeepLinkService, useValue: { links, loading, error, sessionEpoch, refreshLinks, deleteLink } },
        { provide: LanguageService, useValue: { tr: () => EN_TRANSLATIONS } }
      ]
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(RqsUplinkDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists existing owner-scoped records with compact clicks, not Conversion N/A', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelectorAll('.dashboard-kpis .kpi').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.activity-panel').textContent).toContain('Most-clicked Uplink');
    expect(fixture.nativeElement.textContent).toContain('5');
    expect(fixture.nativeElement.querySelector('.metric-box').textContent).toContain('5');
    expect(fixture.nativeElement.querySelector('.link-details')).toBeNull();
    expect(fixture.nativeElement.querySelector('.link-name').textContent).toContain('song slug');
    expect(fixture.nativeElement.querySelector('.short-url').textContent).toContain('go.raquelsynths.com/song-slug');
    expect(fixture.nativeElement.querySelector('.target-text')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('N/A');
    expect(fixture.nativeElement.textContent).not.toContain('Conversion');
  });

  it('searches existing slug, short URL and destination without a backend request', () => {
    links.set([link, { ...link, id: 'second', customSlug: 'another-release', targetUrl: 'https://elsewhere.org/another' }]);
    const fixture = render();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    for (const term of ['song-slug', 'go.raquelsynths.com/song-slug', 'example.org/song']) {
      input.value = term;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.link-card-item').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.link-card-item').textContent).toContain('song slug');
    }
    input.value = 'does-not-exist';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.link-card-item').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(EN_TRANSLATIONS.UPLINK_NO_RESULTS);
    expect(refreshLinks).not.toHaveBeenCalled();
  });

  it('filters only loaded platform categories and maps unknown platforms to Other', () => {
    links.set([link, { ...link, id: 'other', platform: null, customSlug: 'unknown-platform' }]);
    const fixture = render();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.filter-control select');
    select.value = 'other';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.link-card-item').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.link-card-item').textContent).toContain('unknown platform');
    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.link-card-item').length).toBe(2);
  });

  it('keeps source counters inside Details while retaining lifetime clicks', () => {
    links.set([{ ...link, sources: { instagram: 0, tiktok: 0, facebook: 0, youtube: 0, direct: 3 } }]);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('.metric-box').textContent).toContain('5');
    expect(fixture.nativeElement.querySelector('.top-source').textContent).toContain('Direct');
    expect(fixture.nativeElement.querySelector('.source-breakdown')).toBeNull();
    fixture.nativeElement.querySelector('.card-actions button[aria-expanded="false"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.source-breakdown').textContent).toContain('Direct');
    expect(fixture.nativeElement.querySelector('.source-breakdown').textContent).toContain('60%');
    expect(fixture.nativeElement.querySelector('.target-text').textContent).toContain('Destination');
  });

  it('opens Details for only the selected card and closes it accessibly', () => {
    links.set([link, { ...link, id: 'another-link', customSlug: 'another-slug' }]);
    const fixture = render();
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.link-card-item'));
    const button = cards[0].querySelector<HTMLButtonElement>('.card-actions button[aria-expanded="false"]')!;
    expect(button.textContent).toContain('Details');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(cards[0].querySelector('.link-details')).not.toBeNull();
    expect(cards[1].querySelector('.link-details')).toBeNull();
    cards[1].querySelector<HTMLButtonElement>('.card-actions button[aria-expanded="false"]')!.click();
    fixture.detectChanges();
    expect(cards[0].querySelector('.link-details')).toBeNull();
    expect(cards[1].querySelector('.link-details')).not.toBeNull();
    cards[1].querySelector<HTMLButtonElement>('.card-actions button[aria-expanded="true"]')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.link-details')).toBeNull();
  });

  it('calculates source breakdown percentages from current click counts', () => {
    links.set([{ ...link, clicks: 16, sources: { instagram: 0, tiktok: 0, facebook: 5, youtube: 0, direct: 11 } }]);
    const fixture = render();
    fixture.componentInstance.toggleDetails(link.id);
    fixture.detectChanges();
    const breakdown: HTMLElement = fixture.nativeElement.querySelector('.source-breakdown');
    expect(breakdown.textContent).toContain('69%');
    expect(breakdown.textContent).toContain('31%');
    expect(breakdown.querySelector('.total-row')!.textContent).toContain('16');
  });

  it('renders zero-percent breakdown safely for a link without clicks', () => {
    links.set([{ ...link, clicks: 0, sources: { instagram: 0, tiktok: 0, facebook: 0, youtube: 0, direct: 0 } }]);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('.top-source')).toBeNull();
    fixture.componentInstance.toggleDetails(link.id);
    fixture.detectChanges();
    const breakdown: HTMLElement = fixture.nativeElement.querySelector('.source-breakdown');
    expect(breakdown.textContent).not.toContain('NaN');
    expect(breakdown.querySelectorAll('.source-row.zero').length).toBe(5);
    expect(breakdown.textContent).toContain('0%');
  });

  it('exposes Delete only in the overflow menu and retains the existing confirmation', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelector('.card-actions .delete')).toBeNull();
    const more: HTMLButtonElement = fixture.nativeElement.querySelector('.card-actions .more');
    more.click();
    fixture.detectChanges();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fixture.nativeElement.querySelector('.menu-panel .delete').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmDeleteId()).toBe(link.id);
    expect(fixture.nativeElement.querySelector('.delete-confirm')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.menu-panel')).toBeNull();
    expect(deleteLink).not.toHaveBeenCalled();
  });

  it('opens only the tracked short URL with noopener and noreferrer', () => {
    const fixture = render();
    const anchor: HTMLAnchorElement = fixture.nativeElement.querySelector('.card-actions a');
    expect(anchor.href).toBe('https://go.raquelsynths.com/song-slug');
    expect(anchor.rel).toContain('noopener');
    expect(anchor.rel).toContain('noreferrer');
    expect(anchor.target).toBe('_blank');
    expect(fixture.nativeElement.querySelector('a[href="https://example.org/song"]')).toBeNull();
  });

  it('copies only the short URL with accessible localized feedback, without alert', async () => {
    const fixture = render();
    const alertSpy = spyOn(window, 'alert');
    await fixture.componentInstance.copyLink('song-slug');
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledOnceWith('https://go.raquelsynths.com/song-slug');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Link copied');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('requires confirmation, refreshes on success, and can cancel safely', async () => {
    const fixture = render();
    fixture.componentInstance.requestDelete(link.id);
    fixture.detectChanges();
    expect(deleteLink).not.toHaveBeenCalled();
    fixture.componentInstance.cancelDelete();
    expect(deleteLink).not.toHaveBeenCalled();
    fixture.componentInstance.requestDelete(link.id);
    await fixture.componentInstance.confirmDelete(link.id);
    fixture.detectChanges();
    expect(deleteLink).toHaveBeenCalledOnceWith(link.id);
    expect(fixture.componentInstance.confirmDeleteId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Link deleted');
  });

  it('keeps the item visible after a failed Delete and shows safe feedback', async () => {
    deleteLink.and.resolveTo({ success: false, error: EN_TRANSLATIONS.UPLINK_DELETE_FAILED });
    const fixture = render();
    fixture.componentInstance.requestDelete(link.id);
    await fixture.componentInstance.confirmDelete(link.id);
    fixture.detectChanges();
    expect(links()).toEqual([link]);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Could not delete');
  });

  it('clears confirmation and feedback across user switches', async () => {
    const fixture = render();
    fixture.componentInstance.requestDelete(link.id);
    await fixture.componentInstance.copyLink(link.customSlug);
    fixture.componentInstance.toggleDetails(link.id);
    fixture.componentInstance.toggleMenu(link.id);
    fixture.componentInstance.search.set('private-source');
    fixture.componentInstance.platformFilter.set('spotify');
    sessionEpoch.set(1);
    fixture.detectChanges();
    expect(fixture.componentInstance.confirmDeleteId()).toBeNull();
    expect(fixture.componentInstance.feedback()).toBeNull();
    expect(fixture.componentInstance.expandedDetailsId()).toBeNull();
    expect(fixture.componentInstance.openMenuId()).toBeNull();
    expect(fixture.componentInstance.search()).toBe('');
    expect(fixture.componentInstance.platformFilter()).toBe('all');
  });

  it('renders loading, empty and error states with an accessible retry', () => {
    links.set([]);
    loading.set(true);
    const fixture = render();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Loading');
    loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(EN_TRANSLATIONS.emptyLinks);
    error.set('Could not load');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Could not load');
    fixture.nativeElement.querySelector('.empty-state button').click();
    expect(refreshLinks).toHaveBeenCalled();
  });

  it('provides all required action and state labels in EN, PT-BR, PL and FR', () => {
    for (const language of [EN_TRANSLATIONS, PT_TRANSLATIONS, PL_TRANSLATIONS, FR_TRANSLATIONS]) {
      for (const key of [
        'UPLINK_OPEN', 'copyUrl', 'UPLINK_COPIED', 'deleteBtn', 'UPLINK_CANCEL',
        'UPLINK_DELETE_CONFIRM', 'UPLINK_DELETE_SUCCESS', 'UPLINK_DELETE_FAILED',
        'UPLINK_LOADING', 'emptyLinks', 'UPLINK_DESTINATION', 'UPLINK_TOP_SOURCE',
        'UPLINK_DETAILS', 'UPLINK_HIDE_DETAILS', 'UPLINK_MORE_ACTIONS', 'UPLINK_DELETE_LINK', 'UPLINK_TOTAL',
        'UPLINK_PAGE_TITLE', 'UPLINK_PAGE_DESC', 'UPLINK_CREATE_LINK', 'UPLINK_HIDE_CREATE', 'UPLINK_ABOUT',
        'UPLINK_SUMMARY', 'UPLINK_TOTAL_CLICKS', 'UPLINK_SEARCH', 'UPLINK_FILTER', 'UPLINK_ALL',
        'UPLINK_OTHER', 'UPLINK_NO_RESULTS', 'UPLINK_ACTIVITY', 'UPLINK_MOST_CLICKED'
      ] as const) {
        expect(language[key].trim()).not.toBe('');
      }
    }
  });

  it('keeps the tracking URL wrap-capable and actions accessible at narrow widths', () => {
    const fixture = render();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.short-url')).not.toBeNull();
    expect(host.querySelector('.card-actions button[disabled]')).toBeNull();
    expect(host.querySelectorAll('.card-actions a, .card-actions button').length).toBe(4);
  });
});
