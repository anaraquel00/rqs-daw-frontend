import { inject, Injectable } from '@angular/core';
import { Observable, of, switchMap, map, throwError } from 'rxjs';
import {
  BuildV2CloudAssetFormat,
  BuildV2CloudAssetRecord,
  BuildV2CloudAssetRequest,
  DspService,
} from './dsp';

@Injectable({ providedIn: 'root' })
export class BuildV2CloudAssetUploadService {
  private readonly dsp = inject(DspService);

  uploadBuildV2CloudAsset(
    projectId: string,
    assetId: string,
    file: File,
  ): Observable<BuildV2CloudAssetRecord> {
    const format = this.formatFromFileName(file.name);
    if (!format) {
      return throwError(() => new Error('BUILD cloud assets support WAV and MP3 files only.'));
    }

    const request: BuildV2CloudAssetRequest = {
      assetId,
      originalFileName: file.name,
      format,
      sizeBytes: file.size,
    };

    return this.dsp.presignBuildV2Asset(projectId, request).pipe(
      switchMap(presign => {
        if (presign.alreadyConfirmed) return of(presign.asset);

        return this.dsp.uploadToS3(
          presign.uploadUrl,
          file,
          presign.requiredHeaders['Content-Type'],
        ).pipe(
          switchMap(() => this.dsp.confirmBuildV2Asset(projectId, assetId, {
            originalFileName: request.originalFileName,
            format: request.format,
            sizeBytes: request.sizeBytes,
          })),
          map(response => response.asset),
        );
      }),
    );
  }

  private formatFromFileName(fileName: string): BuildV2CloudAssetFormat | null {
    const normalized = fileName.trim().toLowerCase();
    if (normalized.endsWith('.wav')) return 'wav';
    if (normalized.endsWith('.mp3')) return 'mp3';
    return null;
  }
}
