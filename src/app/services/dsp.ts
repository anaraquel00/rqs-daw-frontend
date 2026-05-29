import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DspService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) { }

  // 1. Dispara para o motor de Masterização (Módulo Alfa - Em lote ou final)
  masterizeTrack(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/mastering/process`, formData, {
      responseType: 'blob'
    });
  }

  // 2. Dispara para o motor de DSP individual (com controle de intensidade/volume) [1]
  processMastering(file: File, estilo: string = 'clear_sky', intensidade: string = 'media'): Observable<any> {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('estilo', estilo);
    formData.append('intensidade', intensidade); // Garante que a intensidade chegue ao reator

    return this.http.post(`${this.baseUrl}/mastering/process`, formData, {
      responseType: 'blob'
    });
  }

  // 3. Dispara para o motor de Setlist/Mixer (FFmpeg)
  generateMix(files: File[], crossfades: number[]): Observable<any> {
    const formData = new FormData();
    files.forEach(f => formData.append('tracks', f));
    formData.append('crossfades', JSON.stringify(crossfades));

    return this.http.post(`${this.baseUrl}/mix/generate`, formData, {
      responseType: 'blob'
    });
  }

  // 4. Dispara para a renderização de Vídeo (Jonah Mod)
  renderVideo(audioUrl: string, preset: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/video/render`, { audioUrl, preset }, {
      responseType: 'blob'
    });
  }

  // 5. Dispara para o motor de Separação de Stems (Demucs 6 Canais)
  extractStems(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('audio', file);

    return this.http.post(`${this.baseUrl}/stems/split`, formData, {
      responseType: 'blob'
    });
  }
}
