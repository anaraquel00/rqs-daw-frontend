import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DspService {

  // 🔗 Aponta para o Monólito (No deploy, trocaremos localhost pela URL do Railway)
  private baseUrl = 'http://localhost:3000/api/v1';

  constructor(private http: HttpClient) { }

 // 1. Dispara para o motor de Masterização (Módulo Alfa)
  masterizeTrack(formData: FormData): Observable<any> {
    // 🛡️ CORREÇÃO CRÍTICA: Use CRASE (`) no lugar de aspas simples (') para a variável funcionar!
    return this.http.post(`${this.baseUrl}/mastering/process`, formData, {
      responseType: 'blob'
    });
  }

 // 1. Dispara para o motor de DSP
  processMastering(file: File, estilo: string = 'equilibrado', intensidade: string = 'media'): Observable<any> {
    const formData = new FormData();

    // ⚠️ Atenção ao nome 'audio' aqui, pois é o que o seu back-end em Node.js aguarda!
    formData.append('audio', file);
    formData.append('estilo', estilo);
    formData.append('intensidade', intensidade);

    return this.http.post(`${this.baseUrl}/mastering/process`, formData, {
      responseType: 'blob' // Mantém a exigência do blob para baixar o .wav
    });
  }

  // 2. Dispara para o motor de Setlist/Mixer
  generateMix(files: File[], crossfadeTime: number): Observable<any> {
    const formData = new FormData();

    // Empacota as 5 (ou mais) faixas no barramento
    files.forEach(f => formData.append('tracks', f));
    formData.append('crossfade', crossfadeTime.toString());

    // 🛡️ PROTOCOLO BLOB: Avisa ao Angular para esperar um arquivo físico, não um JSON
    return this.http.post(`${this.baseUrl}/mix/generate`, formData, {
      responseType: 'blob'
    });
  }

  // 3. Dispara para a anomalia do FFmpeg do Jonah (Vídeo)
  renderVideo(audioUrl: string, preset: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/video/render`, { audioUrl, preset }, {
      responseType: 'blob'
    });
  }
}
