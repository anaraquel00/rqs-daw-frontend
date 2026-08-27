import { Component, signal, computed, effect, inject } from '@angular/core';
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

  private lastSessionEpoch = this.deepLinkService.sessionEpoch();
  private latestCompileRequest = 0;

  constructor() {
    effect(() => {
      const epoch = this.deepLinkService.sessionEpoch();
      if (epoch === this.lastSessionEpoch) return;

      this.lastSessionEpoch = epoch;
      this.latestCompileRequest += 1;
      this.compiledLink.set('');
      this.errorMessage.set('');
      this.copied.set(false);
      this.creating.set(false);
    });
  }

  async compileLink(): Promise<void> {
    if (this.creating()) return;
    const requestId = ++this.latestCompileRequest;
    this.errorMessage.set('');
    if (!this.targetUrl()) return;

    this.creating.set(true);
    try {
      const result = await this.deepLinkService.compileAndRegisterLink(this.targetUrl(), this.customSlug());

      if (requestId !== this.latestCompileRequest) return;
      if (result.stale) return;
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
      if (requestId === this.latestCompileRequest) {
        this.errorMessage.set(this.lang.tr().UPLINK_CREATE_FAILED);
      }
    } finally {
      if (requestId === this.latestCompileRequest) {
        this.creating.set(false);
      }
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
