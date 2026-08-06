// src/app/components/uplink-engine/uplink-engine.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../services/language.service';
import { AuthService } from '../services/auth.service';
import { AudioComparisonService } from '../services/audio-comparison.service';
import { DspService } from '../services/dsp';


@Component({
  selector: 'app-uplink-engine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rqs-uplink-engine.html',
  styleUrls: ['./rqs-uplink-engine.scss']
})
export class RqsUplinkEngineComponent {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);
  private dspService = inject(DspService);

  // Estados dos inputs
  destinationUrl = signal<string>('');
  customSlug = signal<string>('');
  pixelId = signal<string>('');
  shortUrl = signal<string>('');
  isCompiling = signal<boolean>(false);

  // Estados de Telemetria (Mini Dashboard)
  clicksCount = signal<number>(0);
  conversionRate = signal<number>(0.0);
  pixelStatus = computed(() => this.pixelId().trim() ? 'ACTIVE' : 'INACTIVE');

  // Verifica reativamente se há áudio processado no mainframe [1.1.1]
  readonly audioProcessed = computed(() => this.audioComparison.audioProcessed());

  generateInstantLink() {
    const filename = this.audioComparison.processedFilename();
    const cleanSlug = filename.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30);
    this.customSlug.set(cleanSlug);
    this.destinationUrl.set('https://open.spotify.com/artist/seu-id-ficticio');
    this.audioComparison.audioProcessed.set(false); // Reseta o estado dinâmico após capturar
  }

  compileLink() {
    if (!this.destinationUrl().trim()) return;

    this.isCompiling.set(true);

    // Simula a requisição para a nossa API de redirecionamentos do backend
    setTimeout(() => {
      this.isCompiling.set(false);
      const slug = this.customSlug().trim() || 'rqs-track';
      this.shortUrl.set(`https://rqs.link/${slug}`);
      this.clicksCount.set(Math.floor(Math.random() * 45) + 12);
      this.conversionRate.set(84.6);
    }, 1500);
  }
}
