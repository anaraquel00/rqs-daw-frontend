import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeepLinkService } from '../services/deep-link.service';
import { LanguageService } from '../services/language.service';

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

  targetUrl = signal<string>('');
  customSlug = signal<string>('');
  compiledLink = signal<string>('');
  copied = signal<boolean>(false);

  detectedPlatform = computed(() => {
    return this.deepLinkService.detectPlatform(this.targetUrl());
  });

  errorMessage = signal<string>('');

  compileLink(): void {
    this.errorMessage.set('');
    if (!this.targetUrl()) return;

    const slug = this.customSlug();
    const result = this.deepLinkService.compileAndRegisterLink(this.targetUrl(), slug);

    if (!result.success) {
      this.errorMessage.set(result.error || 'Erro ao compilar link.');
      return;
    }

    this.compiledLink.set(result.url!);
    this.copied.set(false);
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
