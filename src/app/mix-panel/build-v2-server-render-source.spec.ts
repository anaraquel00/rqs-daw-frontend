import {
  ensureBuildV2ServerRenderSources,
} from './build-v2-server-render-source';

describe('BUILD V2 server render source preparation', () => {
  it('reuses ready inputs and uploads only missing sources', async () => {
    const uploaded: string[] = [];
    const sources = await ensureBuildV2ServerRenderSources(
      [
        { assetId: 'a', s3Key: 'ready-a', uploadState: 'ready' },
        { assetId: 'b', s3Key: null, uploadState: 'idle' },
        { assetId: 'c', s3Key: null, uploadState: 'error' },
      ],
      async candidate => {
        uploaded.push(candidate.assetId);
        return `uploaded-${candidate.assetId}`;
      },
    );

    expect(uploaded).toEqual(['b', 'c']);
    expect(sources).toEqual([
      { assetId: 'a', s3Key: 'ready-a' },
      { assetId: 'b', s3Key: 'uploaded-b' },
      { assetId: 'c', s3Key: 'uploaded-c' },
    ]);
  });

  it('bounds missing-input uploads to three concurrent operations', async () => {
    let active = 0;
    let peak = 0;
    await ensureBuildV2ServerRenderSources(
      Array.from({ length: 8 }, (_, index) => ({
        assetId: `asset-${index}`,
        s3Key: null,
        uploadState: 'idle' as const,
      })),
      async candidate => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        await Promise.resolve();
        active -= 1;
        return `key-${candidate.assetId}`;
      },
    );
    expect(peak).toBe(3);
  });

  it('fails the batch when one upload fails', async () => {
    await expectAsync(
      ensureBuildV2ServerRenderSources(
        [
          { assetId: 'a', s3Key: null, uploadState: 'idle' },
          { assetId: 'b', s3Key: null, uploadState: 'idle' },
        ],
        async candidate => {
          if (candidate.assetId === 'b') {
            throw new Error('UPLOAD_FAILED');
          }
          return 'key-a';
        },
      ),
    ).toBeRejectedWithError('UPLOAD_FAILED');
  });

  it('rejects duplicate asset identities and invalid concurrency', async () => {
    await expectAsync(
      ensureBuildV2ServerRenderSources(
        [
          { assetId: 'same', s3Key: 'one', uploadState: 'ready' },
          { assetId: 'same', s3Key: 'two', uploadState: 'ready' },
        ],
        async () => 'unused',
      ),
    ).toBeRejectedWithError('BUILD_V2_RENDER_SOURCE_SET_INVALID');

    await expectAsync(
      ensureBuildV2ServerRenderSources([], async () => 'unused', 4),
    ).toBeRejectedWithError('BUILD_V2_RENDER_UPLOAD_CONCURRENCY_INVALID');
  });
});
