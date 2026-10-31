import test from 'node:test';
import assert from 'node:assert/strict';
import { authEnvironmentForRequest, getDocument, setFirestoreAccessTokenProviderForTests } from './_referral-http.mjs';

process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';
setFirestoreAccessTokenProviderForTests(async () => 'short-lived-test-token');

function tokenFor(issuer) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ iss: issuer })}.test-signature`;
}

test('preview functions validate tokens against their allowlisted Supabase issuer', () => {
  const request = { headers: { host: 'feature-example.vercel.app' } };
  assert.equal(authEnvironmentForRequest(request,
    tokenFor('https://ucearnthodrltkvkmhit.supabase.co/auth/v1')), 'production');
  assert.equal(authEnvironmentForRequest(request,
    tokenFor('https://uwrqbywapomuloresoek.supabase.co/auth/v1')), 'preview');
  assert.equal(authEnvironmentForRequest(request, 'malformed'), 'preview');
});

test('production host never routes authentication to the preview project', () => {
  const request = { headers: { host: 'studio.raquelsynths.com' } };
  assert.equal(authEnvironmentForRequest(request,
    tokenFor('https://uwrqbywapomuloresoek.supabase.co/auth/v1')), 'production');
});

test('Firestore requests use a server-side bearer token and reject non-referral collections', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let authorization = '';
  globalThis.fetch = async (url, options = {}) => {
    requestedUrl = String(url);
    authorization = new Headers(options.headers).get('Authorization') || '';
    return { ok: false, status: 404 };
  };
  try {
    assert.equal(await getDocument('pro_waitlist', 'test-document'), null);
    assert.match(requestedUrl, /\/databases\/rqs-referral-preview\/documents\/pro_waitlist\/test-document$/);
    assert.equal(authorization, 'Bearer short-lived-test-token');
    await assert.rejects(() => getDocument('users', 'test-document'), /not allowed/);
    process.env.GCP_FIRESTORE_DATABASE_ID = '(default)';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /database is not allowed/);
  } finally {
    process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';
    globalThis.fetch = originalFetch;
  }
});
