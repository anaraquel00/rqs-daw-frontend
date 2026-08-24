import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';

interface UplinkRow {
  id: string;
  target_url: string;
  custom_slug: string;
  created_at: string;
  clicks: number;
  source_instagram: number;
  source_tiktok: number;
  source_facebook: number;
  source_youtube: number;
  source_direct: number;
}

export interface DeepLinkRecord {
  id: string;
  targetUrl: string;
  customSlug: string;
  platform: string | null;
  createdAt: string;
  clicks: number;
  sources: {
    instagram: number;
    facebook: number;
    tiktok: number;
    youtube: number;
    direct: number;
  };
}

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly links = signal<DeepLinkRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly limitReached = signal(false);

  private readonly regexPatterns = {
    spotify: /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|artist)\/([a-zA-Z0-9]+)/,
    bandcamp: /[a-zA-Z0-9-]+\.bandcamp\.com\/(track|album)/,
    youtube: /(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    soundcloud: /soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/
  };

  constructor() {
    effect(() => {
      const userId = this.auth.session()?.user.id;
      if (!this.isBrowser || !userId) {
        this.links.set([]);
        this.loading.set(false);
        this.error.set(null);
        this.limitReached.set(false);
        return;
      }
      void this.refreshLinks();
    });
  }

  detectPlatform(url: string): string | null {
    if (this.regexPatterns.spotify.test(url)) return 'spotify';
    if (this.regexPatterns.bandcamp.test(url)) return 'bandcamp';
    if (this.regexPatterns.youtube.test(url)) return 'youtube';
    if (this.regexPatterns.soundcloud.test(url)) return 'soundcloud';
    return null;
  }

  async refreshLinks(): Promise<void> {
    if (!this.isBrowser || !this.auth.session()?.user) {
      this.links.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const { data, error } = await this.auth.getSupabaseClient()
      .from('rqs_uplinks')
      .select('id,target_url,custom_slug,created_at,clicks,source_instagram,source_tiktok,source_facebook,source_youtube,source_direct')
      .order('created_at', { ascending: false });

    if (error) {
      this.links.set([]);
      this.error.set(error.message);
    } else {
      this.links.set(((data ?? []) as UplinkRow[]).map((row) => this.mapRow(row)));
      this.limitReached.set(!this.auth.isPremium() && this.links().length >= 3);
    }
    this.loading.set(false);
  }

  async compileAndRegisterLink(targetUrl: string, customSlug: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    if (!this.isBrowser || !this.auth.session()?.user) {
      return { success: false, error: this.lang.tr().UPLINK_LOGIN_REQUIRED };
    }

    this.error.set(null);
    const { data, error } = await this.auth.getSupabaseClient().rpc('create_rqs_uplink', {
      target_url: targetUrl,
      requested_slug: customSlug.trim() || null
    });

    if (error) {
      const limitReached = error.message.includes('UPLINK_FREE_LIMIT_REACHED');
      this.limitReached.set(limitReached);
      return {
        success: false,
        error: limitReached ? this.lang.tr().UPLINK_LIMIT_REACHED : error.message
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as UplinkRow | null;
    await this.refreshLinks();
    if (!row) return { success: false, error: 'UPLINK_CREATE_EMPTY_RESULT' };
    return { success: true, url: `https://go.raquelsynths.com/${row.custom_slug}` };
  }

  private mapRow(row: UplinkRow): DeepLinkRecord {
    return {
      id: row.id,
      targetUrl: row.target_url,
      customSlug: row.custom_slug,
      platform: this.detectPlatform(row.target_url),
      createdAt: row.created_at,
      clicks: Number(row.clicks),
      sources: {
        instagram: Number(row.source_instagram),
        tiktok: Number(row.source_tiktok),
        facebook: Number(row.source_facebook),
        youtube: Number(row.source_youtube),
        direct: Number(row.source_direct)
      }
    };
  }
}
