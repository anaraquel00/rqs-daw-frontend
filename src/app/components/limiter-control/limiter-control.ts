// frontend/src/app/components/limiter-control/limiter-control.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MasteringService } from '../../services/mastering.service';

@Component({
  selector: 'app-limiter-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="limiter-card">
      <h3>Limitador de Pico Verdadeiro (dBTP)</h3>

      <div class="control-group">
        <label>Teto de Segurança (Ceiling): {{ ceiling() }} dBTP</label>
        <input type="range" min="-3.0" max="-0.1" step="0.1"
               [value]="ceiling()"
               (input)="updateCeiling($event)">
      </div>

      <div class="control-group">
        <label>Ganho de Entrada (Threshold): {{ threshold() }} dB</label>
        <input type="range" min="-18.0" max="0.0" step="0.5"
               [value]="threshold()"
               (input)="updateThreshold($event)">
      </div>

      <div class="status-indicator">
        <span>Garantia de True Peak: Ativa (ITU-R BS.1770-4)</span>
      </div>
    </div>
  `,
  //styleUrls: ['./limiter-control.css']
})
export class LimiterControlComponent {
  private masteringService = inject(MasteringService);

  // Reatividade baseada em Signals para sincronizar sliders e medidores instantaneamente [5.3]
  public ceiling = this.masteringService.ceiling;
  public threshold = this.masteringService.threshold;

  updateCeiling(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setCeiling(value);
  }

  updateThreshold(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setThreshold(value);
  }
}
