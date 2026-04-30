import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DspService {
  // Arquitetura moderna do Angular: usando inject() no lugar do construtor
  private http = inject(HttpClient);

  // O IP local do nosso reator Python
  private apiUrl = 'http://localhost:8000/masterize/parametric/';

  /**
   * Envia a faixa crua para o reator DSP e retorna a matriz masterizada
   */
  processarAudio(file: File, estilo: string): Observable<Blob> {
    const formData = new FormData();

    // O payload (o arquivo físico da música)
    formData.append('file', file);

    // As diretrizes táticas (Blue Team, Jonah Red, ou Suno Fix)
    formData.append('estilo', estilo);

    // Parâmetros padrão de segurança do nosso reator
    formData.append('controle_sibilancia', 'false');
    formData.append('largura_estereo', 'false');
    formData.append('centro_foco', 'false');

    console.log(`📡 [TRANSMITINDO] Enviando payload para a RQS API. Estilo: ${estilo}`);

    // Exige que o Angular trate a resposta como um arquivo binário (Blob)
    return this.http.post(this.apiUrl, formData, {
      responseType: 'blob'
    });
  }
}
