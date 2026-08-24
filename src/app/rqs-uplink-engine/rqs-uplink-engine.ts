import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeepLinkService } from '../services/deep-link.service';
import { LanguageService } from '../services/language.service';
import { AnalyticsService } from '../services/analytics.service';

@Component({
  selector: 'app-rqs-uplink-engine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rqs-uplink-engine.html',
  styleUrls: ['./rqs-uplink-engine.scss']
})
export class RqsUplinkEngineComponent {
  private deepLinkService = inject(DeepLinkService);
  readonly lang = inject(LanguageService);
  private readonly analytics = inject(AnalyticsService);

  targetUrl = signal<string>('');
  customSlug = signal<string>('');
  compiledLink = signal<string>('');
  copied = signal<boolean>(false);
  creating = signal<boolean>(false);

  detectedPlatform = computed(() => {
    return this.deepLinkService.detectPlatform(this.targetUrl());
  });

  errorMessage = signal<string>('');

  async compileLink(): Promise<void> {
    if (this.creating()) return;
    this.errorMessage.set('');
    if (!this.targetUrl()) return;

    this.creating.set(true);
    try {
      const result = await this.deepLinkService.compileAndRegisterLink(this.targetUrl(), this.customSlug());

      if (!result.success) {
        this.errorMessage.set(result.error || this.lang.tr().UPLINK_CREATE_FAILED);
        return;
      }

      this.compiledLink.set(result.url!);
      this.copied.set(false);

      const platform = this.detectedPlatform();
      this.analytics.trackEvent('uplink_created', {
        platform:
          platform === 'spotify' ||
          platform === 'soundcloud' ||
          platform === 'youtube' ||
          platform === 'bandcamp'
            ? platform
            : 'other'
      });
    } catch {
      this.errorMessage.set(this.lang.tr().UPLINK_CREATE_FAILED);
    } finally {
      this.creating.set(false);
    }
  }

  copyToClipboard(): void {
    const link = this.compiledLink();
    if (link) {
      navigator.clipboard.writeText(link);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    }
  }
}
