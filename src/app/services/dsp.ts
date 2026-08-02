import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CrossfadeCurve, LoudnessMatchMode } from '../mix-panel/mix-panel';
import { inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DspService {

  private baseUrl = environment.baseUrl;
  private readonly apiUrl = 'https://m2ud3r3gh7vocnc3hzvhnv4s4m0dmujw.lambda-url.sa-east-1.on.aws';

  constructor(private http: HttpClient) { }

  generateMixS3(payload: {
    s3Keys: string[];
    crossfades: number[];
    curva: string;
    loudness: string;
    exportName: string;
  }): Observable<{ success: boolean; downloadUrl: string; }> {

    const endpoint = `${this.apiUrl}/mix/generate-s3`;

    // Dispara a requisição HTTP POST enviando o JSON leve de apenas 1 KB [1.1.2]
    return this.http.post<{ success: boolean; downloadUrl: string; }>(endpoint, payload);
  }

  // 1. Dispara para o motor de Masterização (Módulo Alfa - Em lote ou final)
  masterizeTrack(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/mastering/process`, formData, {
      responseType: 'blob'
    });
  }
  // 🟢 NOVA ROTA S3: Processa a master final e recebe a resposta JSON com a URL do S3 (Sem forçar blob!) [1, 1.1.2]
  masterizeTrackS3(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/mastering/process`, formData); // Retorno padrão em JSON [1]
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
  // No seu dsp.service.ts:

// 1. Solicita a URL pré-assinada de upload
getPresignedUrl(filename: string): Observable<any> {
  return this.http.get(`${this.baseUrl}/mastering/presigned-url`, {
    params: { filename }
  });
}

// No seu dsp.service.ts:
uploadToS3(uploadUrl: string, file: File): Observable<any> {
  // 🟢 CORREÇÃO CRÍTICA S3: Envia o Content-Type exato na requisição PUT [1.2.7]
  return this.http.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type }
  });
}

}
