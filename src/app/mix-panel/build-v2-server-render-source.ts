export interface BuildV2ServerRenderSourceCandidate {
  assetId: string;
  s3Key: string | null;
  uploadState: 'idle' | 'uploading' | 'ready' | 'error';
}

export interface BuildV2ServerRenderSource {
  assetId: string;
  s3Key: string;
}

export type BuildV2ServerRenderUpload = (
  candidate: BuildV2ServerRenderSourceCandidate,
) => Promise<string>;

export async function ensureBuildV2ServerRenderSources(
  candidates: readonly BuildV2ServerRenderSourceCandidate[],
  upload: BuildV2ServerRenderUpload,
  maxConcurrency = 3,
): Promise<BuildV2ServerRenderSource[]> {
  if (
    !Number.isSafeInteger(maxConcurrency)
    || maxConcurrency < 1
    || maxConcurrency > 3
  ) {
    throw new RangeError(
      'BUILD_V2_RENDER_UPLOAD_CONCURRENCY_INVALID',
    );
  }

  const assetIds = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.assetId || assetIds.has(candidate.assetId)) {
      throw new Error(
        'BUILD_V2_RENDER_SOURCE_SET_INVALID',
      );
    }
    assetIds.add(candidate.assetId);
  }

  const sources:
    Array<BuildV2ServerRenderSource | null> =
    candidates.map(candidate =>
      candidate.uploadState === 'ready'
      && candidate.s3Key
        ? {
            assetId: candidate.assetId,
            s3Key: candidate.s3Key,
          }
        : null,
    );

  const pending = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => !sources[index]);

  let cursor = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (!failure) {
      const pendingIndex = cursor;
      cursor += 1;
      const item = pending[pendingIndex];
      if (!item) return;
      try {
        const s3Key = await upload(item.candidate);
        if (!s3Key?.trim()) {
          throw new Error(
            'BUILD_V2_RENDER_UPLOAD_KEY_MISSING',
          );
        }
        sources[item.index] = {
          assetId: item.candidate.assetId,
          s3Key,
        };
      } catch (error) {
        failure = error;
      }
    }
  };

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          maxConcurrency,
          pending.length,
        ),
      },
      () => worker(),
    ),
  );

  if (failure) throw failure;
  if (sources.some(source => !source)) {
    throw new Error(
      'BUILD_V2_RENDER_SOURCE_SET_INVALID',
    );
  }

  return sources as BuildV2ServerRenderSource[];
}
