import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

  // 🔌 Cliente Supabase conectado ao projeto
  private supabase: SupabaseClient = createClient(
    'https://ucearnthodrltkvkmhit.supabase.co',
    'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR' // Substitua pela sua chave anon pública do projeto
  );

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

  async compileAndRegisterLink(targetUrl: string, customSlug: string): Promise<{ success: boolean; url?: string; error?: string }> {
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
    const finalUrl = `https://go.raquelsynths.com/${slug}`;

    const newRecord: DeepLinkRecord = {
      id: crypto.randomUUID(),
      targetUrl,
      customSlug: slug,
      platform,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      clicks: 0, // Inicia zerado na nuvem
      conversionRate: '0.0%',
      sources: { instagram: 0, tiktok: 0, facebook: 0, youtube: 0, direct: 0 }
    };

    // 💾 SALVA NA TABELA DO SUPABASE PARA A EDGE FUNCTION ENCONTRAR
    const { error: dbError } = await this.supabase
      .from('rqs_uplinks')
      .insert([
        {
          custom_slug: slug,
          target_url: targetUrl,
          platform: platform,
          clicks: 0,
          source_instagram: 0,
          source_tiktok: 0,
          source_facebook: 0,
          source_youtube: 0,
          source_direct: 0
        }
      ]);

    if (dbError) {
      console.error('Erro ao sincronizar com o Supabase:', dbError.message);
      return { success: false, error: `DB_ERROR: ${dbError.message}` };
    }

    // Salva localmente no cache da UI
    links.unshift(newRecord);
    localStorage.setItem(this.storageKey, JSON.stringify(links));

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
