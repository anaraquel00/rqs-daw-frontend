import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  MasteringV2Capabilities,
  MasteringV2FinalResponse,
} from './mastering-types';

export type SetlistCurve = 'linear' | 'equal-power' | 'fast-cut';
export type SetlistLoudnessMode = 'off' | 'normalize';

export interface SetlistRenderRequest {
  tracks: string[];
  vignette: string | null;
  crossfades: number[];
  curve: SetlistCurve;
  loudness: SetlistLoudnessMode;
  exportName: string;
  outputFormat: 'wav';
}

export interface SetlistRenderResponse {
  success: true;
  downloadUrl: string;
  fileName: string;
  output: {
    format: 'wav';
    codec: 'pcm_s24le';
    sampleRate: 48000;
    channels: 2;
    durationSeconds: number;
  };
}

export interface SetlistPresignResponse {
  uploadUrl: string;
  s3Key: string;
}

@Injectable({
  providedIn: 'root',
})
export class DspService {
  private readonly baseUrl = environment.baseUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  getMasteringV2Capabilities(): Observable<MasteringV2Capabilities> {
    return this.http.get<MasteringV2Capabilities>(`${this.baseUrl}/mastering/v2/capabilities`);
  }

  masterizeV2Preview(formData: FormData): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/mastering/v2/process`, formData, {
      responseType: 'blob',
      headers: this.masteringV2Headers(),
    });
  }

  masterizeV2Final(formData: FormData): Observable<MasteringV2FinalResponse> {
    return this.http.post<MasteringV2FinalResponse>(`${this.baseUrl}/mastering/v2/process`, formData, {
      headers: this.masteringV2Headers(),
    });
  }

  generateMixS3(payload: SetlistRenderRequest): Observable<SetlistRenderResponse> {
    return this.http.post<SetlistRenderResponse>(`${this.baseUrl}/mix/generate-s3`, payload, {
      headers: this.setlistHeaders(),
    });
  }

  getSetlistPresignedUrl(filename: string): Observable<SetlistPresignResponse> {
    return this.http.get<SetlistPresignResponse>(`${this.baseUrl}/mix/presigned-url`, {
      params: { filename },
      headers: this.setlistHeaders(),
    });
  }

  masterizeTrack(formData: FormData): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/mastering/process`, formData, { responseType: 'blob' });
  }

  masterizeTrackS3(formData: FormData): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/mastering/process`, formData);
  }

  processMastering(file: File, estilo = 'clear_sky', intensidade = 'media'): Observable<Blob> {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('estilo', estilo);
    formData.append('intensidade', intensidade);
    return this.http.post(`${this.baseUrl}/mastering/process`, formData, { responseType: 'blob' });
  }

  generateMix(files: File[], crossfades: number[]): Observable<Blob> {
    const formData = new FormData();
    files.forEach((file) => formData.append('tracks', file));
    formData.append('crossfades', JSON.stringify(crossfades));
    return this.http.post(`${this.baseUrl}/mix/generate`, formData, { responseType: 'blob' });
  }

  renderVideo(audioUrl: string, preset: string): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/video/render`, { audioUrl, preset }, { responseType: 'blob' });
  }

  extractStems(file: File): Observable<Blob> {
    const formData = new FormData();
    formData.append('audio', file);
    return this.http.post(`${this.baseUrl}/stems/split`, formData, {
      responseType: 'blob',
      headers: this.masteringV2Headers(),
    });
  }

  extractStemsS3(s3Key: string): Observable<{ success: boolean; downloadUrl: string }> {
    return this.http.post<{ success: boolean; downloadUrl: string }>(
      `${this.baseUrl}/stems/split-s3`,
      { s3Key },
      { headers: this.masteringV2Headers() },
    );
  }

  // Kept only for unrelated legacy callers. Setlist must use getSetlistPresignedUrl().
  getPresignedUrl(filename: string): Observable<{ uploadUrl: string; s3Key: string }> {
    return this.http.get<{ uploadUrl: string; s3Key: string }>(`${this.baseUrl}/mastering/presigned-url`, {
      params: { filename },
    });
  }

  getMasteringV2PresignedUrl(filename: string): Observable<{ uploadUrl: string; s3Key: string }> {
    return this.http.get<{ uploadUrl: string; s3Key: string }>(`${this.baseUrl}/mastering/v2/presigned-url`, {
      params: { filename },
      headers: this.masteringV2Headers(),
    });
  }

  uploadToS3(uploadUrl: string, file: File): Observable<unknown> {
    const fileName = file.name.toLowerCase();
    const contentType = fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
    return this.http.put(uploadUrl, file, {
      headers: { 'Content-Type': contentType },
    });
  }

  private masteringV2Headers(): HttpHeaders {
    const accessToken = this.auth.session()?.access_token;
    return accessToken
      ? new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
      : new HttpHeaders();
  }

  private setlistHeaders(): HttpHeaders {
    const accessToken = this.auth.session()?.access_token;
    return accessToken
      ? new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
      : new HttpHeaders();
  }
}
