// frontend/src/app/components/stereo-control/stereo-control.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MasteringService } from '../../services/mastering.service';

@Component({
  selector: 'app-stereo-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stereo-card">
      <h3>Largura Estéreo & Saturação M/S</h3>

      <div class="control-group">
        <label>Abertura do Campo Estéreo: x{{ widthMultiplier() }}</label>
        <input type="range" min="0.5" max="2.0" step="0.1"
               [value]="widthMultiplier()"
               (input)="updateWidth($event)">
      </div>

      <div class="control-group">
        <label>Brilho Harmônico Lateral: {{ satAmountPercent() }}%</label>
        <input type="range" min="0" max="100" step="5"
               [value]="satAmountPercent()"
               (input)="updateSaturation($event)">
      </div>

      <div class="control-group">
        <label>Foco de Mono Bass: {{ monoBassHz() }} Hz</label>
        <input type="range" min="80" max="200" step="10"
               [value]="monoBassHz()"
               (input)="updateMonoBass($event)">
      </div>
    </div>
  `,
  //styleUrls: ['./stereo-control.css']
})
export class StereoControlComponent {
  private masteringService = inject(MasteringService);

  public widthMultiplier = this.masteringService.stereoWidth;
  public satAmount = this.masteringService.satAmount;
  public monoBassHz = this.masteringService.monoBassHz;

  public satAmountPercent() {
    return Math.round(this.satAmount() * 100);
  }

  updateWidth(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setStereoWidth(value);
  }

  updateSaturation(event: Event) {
    const value = +(event.target as HTMLInputElement).value / 100;
    this.masteringService.setSatAmount(value);
  }

  updateMonoBass(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setMonoBass(value);
  }
}
