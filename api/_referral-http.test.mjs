import test from 'node:test';
import assert from 'node:assert/strict';
import { authEnvironmentForRequest, countDocuments, getDocument, hasVerifiedEmail, setFirestoreAccessTokenProviderForTests, updateDocument } from './_referral-http.mjs';

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

test('verified email requires both an address and a Supabase confirmation timestamp', () => {
  assert.equal(hasVerifiedEmail({ email: 'artist@example.com', email_confirmed_at: '2026-11-01T00:00:00Z' }), true);
  assert.equal(hasVerifiedEmail({ email: 'artist@example.com' }), false);
  assert.equal(hasVerifiedEmail({ confirmed_at: '2026-11-01T00:00:00Z' }), false);
});

test('Firestore preference updates use an exact field mask and aggregate queries return counts only', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith(':runAggregationQuery')) {
      return { ok: true, status: 200, json: async () => [{ result: { aggregateFields: { count: { integerValue: '12' } } } }] };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ name: `${url}`, fields: {
        plan_interest: { stringValue: 'pro' },
        referralCode: { stringValue: 'RQSA23456789' },
      } }),
    };
  };
  try {
    const updated = await updateDocument('pro_waitlist', 'owner-hash', {
      plan_interest: 'pro',
      plan_interest_updated_at: new Date('2026-11-07T12:00:00Z'),
    });
    assert.equal(updated.plan_interest, 'pro');
    const updateRequest = requests[0];
    const updateUrl = new URL(updateRequest.url);
    assert.deepEqual(updateUrl.searchParams.getAll('updateMask.fieldPaths'), [
      'plan_interest',
      'plan_interest_updated_at',
    ]);
    const updateBody = JSON.parse(updateRequest.options.body);
    assert.deepEqual(Object.keys(updateBody.fields).sort(), ['plan_interest', 'plan_interest_updated_at']);
    assert.equal(updateBody.fields.referralCode, undefined);

    assert.equal(await countDocuments('pro_waitlist', 'plan_interest', 'pro'), 12);
    const aggregateBody = JSON.parse(requests[1].options.body);
    assert.equal(aggregateBody.structuredAggregationQuery.aggregations[0].alias, 'count');
    assert.equal(aggregateBody.structuredAggregationQuery.structuredQuery.where.fieldFilter.field.fieldPath, 'plan_interest');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
