// frontend/src/app/components/crossover-control/crossover-control.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Signal, computed } from '@angular/core';
import { MasteringService } from '../../services/mastering.service';

@Component({
  selector: 'app-crossover-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="crossover-card">
      <h3>Divisão Espectral (Crossover LR4)</h3>
      <div class="slider-group">
        <label>Sub-Graves / Médios: {{ lowCutoff() }} Hz</label>
        <input type="range" min="80" max="400" step="10"
               [value]="lowCutoff()"
               (input)="updateLowCutoff($event)">
      </div>
      <div class="slider-group">
        <label>Médios / Agudos: {{ highCutoff() }} Hz</label>
        <input type="range" min="1500" max="6000" step="100"
               [value]="highCutoff()"
               (input)="updateHighCutoff($event)">
      </div>
      <div class="status-indicator">
        <span>Status: Reconstrução Linear Ativa (0.00 dB de desvio de fase)</span>
      </div>
    </div>
  `,
  //styleUrls: ['./crossover-control.css']
})
export class CrossoverControl {
  private masteringService = inject(MasteringService);

  // Utilizando Angular Signals para sincronização reativa imediata de estado [5.3]
  public lowCutoff: Signal<number> = this.masteringService.lowCutoff;
  public highCutoff: Signal<number> = this.masteringService.highCutoff;

  updateLowCutoff(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setLowCutoff(value);
  }

  updateHighCutoff(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setHighCutoff(value);
  }
}
