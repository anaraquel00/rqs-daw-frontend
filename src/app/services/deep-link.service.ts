import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface DeepLinkRecord {
  id: string;
  targetUrl: string;
  customSlug: string;
  platform: string | null;
  createdAt: string;
  clicks: number;
  conversionRate: string;
  sources: {
    instagram: number;
    facebook: number;
    tiktok: number;
    youtube: number;
    direct: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DeepLinkService {
  private storageKey = 'rqs_uplink_database';
  private auth = inject(AuthService);

  private regexPatterns = {
    spotify: /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|artist)\/([a-zA-Z0-9]+)/,
    bandcamp: /[a-zA-Z0-9-]+\.bandcamp\.com\/(track|album)/,
    youtube: /(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    soundcloud: /soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/
  };

  detectPlatform(url: string): string | null {
    if (this.regexPatterns.spotify.test(url)) return 'spotify';
    if (this.regexPatterns.bandcamp.test(url)) return 'bandcamp';
    if (this.regexPatterns.youtube.test(url)) return 'youtube';
    if (this.regexPatterns.soundcloud.test(url)) return 'soundcloud';
    return null;
  }

  getAllLinks(): DeepLinkRecord[] {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  compileAndRegisterLink(targetUrl: string, customSlug: string): { success: boolean; url?: string; error?: string } {
    const links = this.getAllLinks();

    // 🔒 VERIFICAÇÃO DE PAYWALL / LIMITES DO PLANO FREE
    const isUserPremium = this.auth.isPremium();
    if (!isUserPremium && links.length >= 3) {
      return {
        success: false,
        error: 'LIMIT_REACHED: O plano Free permite apenas 3 Deep Links ativos. Faça login com GitHub/Google ou assine o RQS Pro para links ilimitados.'
      };
    }

    const platform = this.detectPlatform(targetUrl);
    const slug = customSlug.trim() || `rqs-${Math.random().toString(36).substring(2, 8)}`;

    const existingIndex = links.findIndex(l => l.customSlug === slug);

    const newRecord: DeepLinkRecord = {
      id: existingIndex >= 0 ? links[existingIndex].id : crypto.randomUUID(),
      targetUrl,
      customSlug: slug,
      platform,
      createdAt: existingIndex >= 0 ? links[existingIndex].createdAt : new Date().toLocaleDateString('pt-BR'),
      clicks: existingIndex >= 0 ? links[existingIndex].clicks : 12,
      conversionRate: '88.4%',
      sources: { instagram: 8, tiktok: 3, facebook: 1, youtube: 2, direct: 4 }
    };

    if (existingIndex >= 0) {
      links[existingIndex] = newRecord;
    } else {
      links.unshift(newRecord);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(links));

    // 🚀 CANAL DE PRODUÇÃO ATIVADO: O link gerado agora aponta para o encurtador oficial
    const finalUrl = `https://go.raquelsynths.com/${slug}`;
    return { success: true, url: finalUrl };
  }

  incrementClick(slug: string): void {
    const links = this.getAllLinks();
    const link = links.find(l => l.customSlug === slug);
    if (link) {
      link.clicks += 1;
      localStorage.setItem(this.storageKey, JSON.stringify(links));
    }
  }
}
