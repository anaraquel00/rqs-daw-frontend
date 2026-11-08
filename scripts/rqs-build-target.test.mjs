import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBuildTarget } from './rqs-build-target.mjs';

test('Vercel Preview without an explicit target resolves to staging', () => {
  assert.equal(resolveBuildTarget({ VERCEL_ENV: 'preview' }), 'staging');
});

test('Vercel Preview explicitly targeting staging resolves to staging', () => {
  assert.equal(
    resolveBuildTarget({
      VERCEL_ENV: 'preview',
      RQS_BUILD_TARGET: 'staging',
    }),
    'staging',
  );
});

test('Vercel Preview explicitly targeting production fails closed', () => {
  assert.throws(
    () =>
      resolveBuildTarget({
        VERCEL_ENV: 'preview',
        RQS_BUILD_TARGET: 'production',
      }),
    /Vercel Preview cannot use production build target/,
  );
});

test('Vercel Production explicitly targeting production resolves to production', () => {
  assert.equal(
    resolveBuildTarget({
      VERCEL_ENV: 'production',
      RQS_BUILD_TARGET: 'production',
    }),
    'production',
  );
});

test('local staging remains supported', () => {
  assert.equal(resolveBuildTarget({ RQS_BUILD_TARGET: 'staging' }), 'staging');
});

test('local production and default builds remain supported', () => {
  assert.equal(resolveBuildTarget({ RQS_BUILD_TARGET: 'production' }), 'production');
  assert.equal(resolveBuildTarget({}), 'production');
});
