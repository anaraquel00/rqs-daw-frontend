import test from 'node:test';
import assert from 'node:assert/strict';
import { authEnvironmentForRequest, countDocuments, getDocument, hasVerifiedEmail, referralEnvironmentConfiguration, setFirestoreAccessTokenProviderForTests, updateDocument } from './_referral-http.mjs';
import { configureReferralTestEnvironment } from './_referral-test-environment.mjs';

configureReferralTestEnvironment('production');
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
  configureReferralTestEnvironment('production');
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
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /database does not match data environment/);
  } finally {
    configureReferralTestEnvironment('production');
    globalThis.fetch = originalFetch;
  }
});

test('Firestore environment matrix accepts only matching Production and Staging identities', () => {
  configureReferralTestEnvironment('production');
  assert.deepEqual({
    environment: referralEnvironmentConfiguration().environment,
    databaseId: referralEnvironmentConfiguration().databaseId,
  }, { environment: 'production', databaseId: 'rqs-referral-preview' });

  configureReferralTestEnvironment('staging');
  assert.deepEqual({
    environment: referralEnvironmentConfiguration().environment,
    databaseId: referralEnvironmentConfiguration().databaseId,
  }, { environment: 'staging', databaseId: 'rqs-referral-staging' });

  configureReferralTestEnvironment('production');
});

test('Firestore environment matrix rejects missing, unknown and crossed configurations before credentials', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return { ok: false, status: 500 };
  };
  try {
    configureReferralTestEnvironment('staging');
    delete process.env.RQS_DATA_ENVIRONMENT;
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /Missing server environment: RQS_DATA_ENVIRONMENT/);

    configureReferralTestEnvironment('staging');
    process.env.RQS_DATA_ENVIRONMENT = 'qa';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /Unknown RQS data environment/);

    configureReferralTestEnvironment('staging');
    process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /database does not match data environment/);

    configureReferralTestEnvironment('production');
    process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-staging';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /database does not match data environment/);

    configureReferralTestEnvironment('staging');
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = 'rqs-referral-preview';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /provider does not match data environment/);

    configureReferralTestEnvironment('staging');
    process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'rqs-referral-preview@raquel-synths-platform.iam.gserviceaccount.com';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /service account does not match data environment/);

    configureReferralTestEnvironment('staging');
    process.env.GCP_AUDIENCE = 'https://invalid.example/provider';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /audience does not match provider/);

    configureReferralTestEnvironment('staging');
    process.env.GCP_PROJECT_ID = 'another-project';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /project does not match Firestore project/);

    configureReferralTestEnvironment('staging');
    process.env.GCP_PROJECT_NUMBER = '123456789';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /project number does not match Firestore project/);

    configureReferralTestEnvironment('staging');
    process.env.VERCEL_TARGET_ENV = 'production';
    await assert.rejects(() => getDocument('pro_waitlist', 'test-document'), /Vercel target does not match data environment/);

    assert.equal(fetchCalled, false);
  } finally {
    configureReferralTestEnvironment('production');
    globalThis.fetch = originalFetch;
  }
});

test('Firestore environment matrix requires every identity field before credentials', async () => {
  const requiredVariables = [
    'GCP_PROJECT_ID',
    'GCP_PROJECT_NUMBER',
    'GCP_WORKLOAD_IDENTITY_POOL_ID',
    'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID',
    'GCP_SERVICE_ACCOUNT_EMAIL',
    'GCP_FIRESTORE_DATABASE_ID',
    'GCP_AUDIENCE',
  ];
  for (const variable of requiredVariables) {
    configureReferralTestEnvironment('staging');
    delete process.env[variable];
    await assert.rejects(
      () => getDocument('pro_waitlist', 'test-document'),
      new RegExp(`Missing server environment: ${variable}`),
    );
  }
  configureReferralTestEnvironment('production');
});

test('the published Production context remains compatible without the new explicit environment variable', () => {
  configureReferralTestEnvironment('production');
  delete process.env.RQS_DATA_ENVIRONMENT;
  assert.equal(referralEnvironmentConfiguration().environment, 'production');
  configureReferralTestEnvironment('production');
});

test('verified email requires both an address and a Supabase confirmation timestamp', () => {
  assert.equal(hasVerifiedEmail({ email: 'artist@example.com', email_confirmed_at: '2026-11-01T00:00:00Z' }), true);
  assert.equal(hasVerifiedEmail({ email: 'artist@example.com' }), false);
  assert.equal(hasVerifiedEmail({ confirmed_at: '2026-11-01T00:00:00Z' }), false);
});

test('Firestore preference updates use an exact field mask and aggregate queries return counts only', async () => {
  configureReferralTestEnvironment('production');
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
