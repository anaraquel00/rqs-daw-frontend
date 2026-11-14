import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import type { BuildV2ProjectDocumentV1 } from '../mix-panel/build-v2-project-schema';
import {
  MasteringAnalysisResponse,
  MasteringAutoRecommendation,
  MasteringAutoRecommendationRequest,
  MasteringV2Analysis,
  MasteringV2Capabilities,
  MasteringV2FinalResponse,
  ArtistConfirmationRequest,
  PersistedAudioIntelligenceAnalysis,
  SpotifyPitchRequest,
  SpotifyPitchQuotaResponse,
  SpotifyPitchResponse,
} from './mastering-types';

export type SetlistCurve = 'linear' | 'equal-power' | 'fast-cut';
export type SetlistLoudnessMode = 'off' | 'normalize';

export interface SetlistRenderRequest {
  tracks: string[];
  vignette: string | null;
  crossfades: number[];
  curve: SetlistCurve;
  curves?: SetlistCurve[];
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

export type BuildV2CloudAssetFormat = 'wav' | 'mp3';

export interface BuildV2CloudAssetRequest {
  assetId: string;
  originalFileName: string;
  format: BuildV2CloudAssetFormat;
  sizeBytes: number;
}

export interface BuildV2CloudAssetRecord {
  projectId: string;
  assetId: string;
  originalFileName: string;
  format: BuildV2CloudAssetFormat;
  contentType: 'audio/wav' | 'audio/mpeg';
  sizeBytes: number;
  etag: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BuildV2CloudAssetPresignResponse =
  | {
      alreadyConfirmed: true;
      asset: BuildV2CloudAssetRecord;
    }
  | {
      alreadyConfirmed: false;
      uploadUrl: string;
      objectKey: string;
      expiresInSeconds: number;
      requiredHeaders: { 'Content-Type': 'audio/wav' | 'audio/mpeg' };
    };

export interface BuildV2CloudAssetConfirmResponse {
  asset: BuildV2CloudAssetRecord;
}

export interface BuildV2CloudProjectSaveResponse {
  success: true;
  alreadySaved: boolean;
  updated: boolean;
  project: {
    projectId: string;
    name: string;
    schemaVersion: number;
    revision: number;
    assetCount: number;
    trackCount: number;
    documentCreatedAt: string;
    documentUpdatedAt: string;
  };
}

export interface BuildV2CloudProjectDeleteResponse {
  success: true;
  alreadyDeleted: boolean;
  projectId: string;
  finalRevision: number;
  cleanupComplete: boolean;
  deletedAssets: number;
  pendingAssets: number;
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

  analyzeMasteringV2(formData: FormData, requestId: string = crypto.randomUUID()): Observable<MasteringAnalysisResponse> {
    return this.http.post<MasteringAnalysisResponse>(`${this.baseUrl}/mastering/v2/analysis`, formData, {
      headers: this.masteringV2Headers().set('Idempotency-Key', requestId),
    });
  }

  getMasteringV2Analysis(analysisId: string): Observable<PersistedAudioIntelligenceAnalysis> {
    return this.http.get<PersistedAudioIntelligenceAnalysis>(
      `${this.baseUrl}/mastering/v2/analyses/${encodeURIComponent(analysisId)}`,
      { headers: this.masteringV2Headers() },
    );
  }

  saveArtistConfirmation(
    analysisId: string,
    request: ArtistConfirmationRequest,
  ): Observable<PersistedAudioIntelligenceAnalysis> {
    return this.http.patch<PersistedAudioIntelligenceAnalysis>(
      `${this.baseUrl}/mastering/v2/analyses/${encodeURIComponent(analysisId)}/artist-confirmation`,
      request,
      { headers: this.masteringV2Headers() },
    );
  }

  recommendMasteringV2Auto(
    request: MasteringAutoRecommendationRequest,
  ): Observable<MasteringAutoRecommendation> {
    return this.http.post<MasteringAutoRecommendation>(
      `${this.baseUrl}/mastering/v2/auto/recommend`,
      request,
      { headers: this.masteringV2Headers() },
    );
  }

  getSpotifyPitchQuota(): Observable<SpotifyPitchQuotaResponse> {
    return this.http.get<SpotifyPitchQuotaResponse>(
      `${this.baseUrl}/mastering/v2/spotify-pitch/quota`,
      { headers: this.masteringV2Headers() },
    );
  }

  generateSpotifyPitch(request: SpotifyPitchRequest, requestId: string): Observable<SpotifyPitchResponse> {
    return this.http.post<SpotifyPitchResponse>(
      `${this.baseUrl}/mastering/v2/spotify-pitch`,
      request,
      { headers: this.masteringV2Headers().set('Idempotency-Key', requestId) },
    );
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

  presignBuildV2Asset(
    projectId: string,
    request: BuildV2CloudAssetRequest,
  ): Observable<BuildV2CloudAssetPresignResponse> {
    return this.http.post<BuildV2CloudAssetPresignResponse>(
      `${this.baseUrl}/build/v2/projects/${encodeURIComponent(projectId)}/assets/presign`,
      request,
      { headers: this.buildV2Headers() },
    );
  }

  confirmBuildV2Asset(
    projectId: string,
    assetId: string,
    request: Omit<BuildV2CloudAssetRequest, 'assetId'>,
  ): Observable<BuildV2CloudAssetConfirmResponse> {
    return this.http.post<BuildV2CloudAssetConfirmResponse>(
      `${this.baseUrl}/build/v2/projects/${encodeURIComponent(projectId)}`
        + `/assets/${encodeURIComponent(assetId)}/confirm`,
      request,
      { headers: this.buildV2Headers() },
    );
  }

  saveBuildV2CloudProject(
    project: BuildV2ProjectDocumentV1,
    expectedRevision?: number,
  ): Observable<BuildV2CloudProjectSaveResponse> {
    return this.http.put<BuildV2CloudProjectSaveResponse>(
      `${this.baseUrl}/build/v2/projects/${encodeURIComponent(project.projectId)}`,
      project,
      { headers: this.buildV2Headers(expectedRevision) },
    );
  }

  deleteBuildV2CloudProject(
    projectId: string,
    expectedRevision: number,
  ): Observable<BuildV2CloudProjectDeleteResponse> {
    return this.http.delete<BuildV2CloudProjectDeleteResponse>(
      `${this.baseUrl}/build/v2/projects/${encodeURIComponent(projectId)}`,
      { headers: this.buildV2Headers(expectedRevision) },
    );
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

  getMasteringV2SourcePlaybackUrl(
    s3Key: string,
  ): Observable<{ playbackUrl: string; expiresInSeconds: number }> {
    return this.http.post<{ playbackUrl: string; expiresInSeconds: number }>(
      `${this.baseUrl}/mastering/v2/source-playback-url`,
      { s3Key },
      { headers: this.masteringV2Headers() },
    );
  }

  uploadToS3(uploadUrl: string, file: File, requiredContentType?: string): Observable<unknown> {
    const fileName = file.name.toLowerCase();
    const contentType = requiredContentType
      || (fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav');
    return this.http.put(uploadUrl, file, {
      headers: { 'Content-Type': contentType },
    });
  }

  private buildV2Headers(expectedRevision?: number): HttpHeaders {
    const accessToken = this.auth.session()?.access_token;
    let headers = accessToken
      ? new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
      : new HttpHeaders();
    if (expectedRevision !== undefined) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
        throw new RangeError('expectedRevision must be a positive safe integer.');
      }
      headers = headers.set('If-Match', `"${expectedRevision}"`);
    }
    return headers;
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
