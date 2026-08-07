// daw-frontend/src/app/services/mastering.service.ts

import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MasteringService {
  // --- 1. CONFIGURAÇÕES DE CROSSOVER MULTIBANDA [Fase 2] ---
  public lowCutoff: WritableSignal<number> = signal(200);
  public highCutoff: WritableSignal<number> = signal(3000);

  // --- 2. CONFIGURAÇÕES DE IMAGEM ESTÉREO MID/SIDE [Fase 3] ---
  public stereoWidth: WritableSignal<number> = signal(1.0);
  public satAmount: WritableSignal<number> = signal(0.3);
  public monoBassHz: WritableSignal<number> = signal(120);

  // --- 3. CONFIGURAÇÕES DO LIMITADOR DE PICO VERDADEIRO [Fase 5] ---
  // ceiling: Teto máximo de saída em dBTP (padrão -1.0 dBTP)
  public ceiling: WritableSignal<number> = signal(-1.0);
  // threshold: Ganho de entrada de limitação em dB (padrão 0.0 dB)
  public threshold: WritableSignal<number> = signal(0.0);

  // --- SETTERS REATIVOS PARA AJUSTE DE CROSSOVER ---
  public setLowCutoff(value: number): void {
    this.lowCutoff.set(value);
  }

  public setHighCutoff(value: number): void {
    this.highCutoff.set(value);
  }

  // --- SETTERS REATIVOS PARA AJUSTE ESTÉREO ---
  public setStereoWidth(value: number): void {
    this.stereoWidth.set(value);
  }

  public setSatAmount(value: number): void {
    this.satAmount.set(value);
  }

  public setMonoBass(value: number): void {
    this.monoBassHz.set(value);
  }

  // --- SETTERS REATIVOS PARA AJUSTE DO LIMITADOR ---
  public setCeiling(value: number): void {
    this.ceiling.set(value);
  }

  public setThreshold(value: number): void {
    this.threshold.set(value);
  }

  /**
   * Retorna o payload completo de parâmetros reativos formatados
   * no padrão exato exigido pelas classes Pydantic do backend FastAPI.
   */
  public getMasteringPayload() {
    return {
      low_cutoff_hz: this.lowCutoff(),
      high_cutoff_hz: this.highCutoff(),
      stereo_width: this.stereoWidth(),
      saturation_amount: this.satAmount(),
      mono_bass_frequency_hz: this.monoBassHz(),
      ceiling_dbtp: this.ceiling(),
      threshold_db: this.threshold()
    };
  }
}
