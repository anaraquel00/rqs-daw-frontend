import test from 'node:test';
import assert from 'node:assert/strict';
import authConfigHandler from './auth/config.js';
import meHandler from './admin/me.js';
import overviewHandler from './admin/overview.js';
import summaryHandler from './admin/waitlist/summary.js';
import { setAdminContextProviderForTests } from './_auth.mjs';
import { adminFirestoreConfiguration } from './_firestore-admin.mjs';
import { assertFirestoreDataIsolation } from './_firestore-isolation.mjs';
import {
  countReferralDocuments,
  referralFirestoreConfiguration,
  setReferralCountProviderForTests,
} from './_firestore-referral.mjs';
import { gcpOidcConfiguration } from './_gcp-oidc.mjs';

process.env.NODE_TEST_CONTEXT = '1';

function configurePreviewDataSources() {
  process.env.VERCEL_ENV = 'preview';
  process.env.RQS_ADMIN_DATA_ENVIRONMENT = 'staging';
  process.env.GCP_ADMIN_FIRESTORE_DATABASE_ID = 'rqs-studio-admin-staging';
  process.env.GCP_REFERRAL_FIRESTORE_DATABASE_ID = 'rqs-referral-staging';
}

configurePreviewDataSources();

function membershipContext(role = 'owner', active = true) {
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: role ? { role, active } : null, error: null }; },
  };
  return {
    user: { id: '00000000-0000-4000-8000-000000000001', email_confirmed_at: '2026-11-01T00:00:00Z' },
    client: { from(table) { assert.equal(table, 'studio_admin_memberships'); return query; } },
  };
}

async function invoke(handler, { method = 'GET', origin, authorization = 'Bearer opaque-token' } = {}) {
  const result = { status: 0, body: null, headers: new Map() };
  const req = { method, headers: { authorization, ...(origin ? { origin } : {}) } };
  const res = {
    setHeader(name, value) { result.headers.set(name, value); },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return body; },
    end() { return null; },
  };
  await handler(req, res);
  return result;
}

test.afterEach(() => {
  setAdminContextProviderForTests(null);
  setReferralCountProviderForTests(null);
  delete process.env.ADMIN_ALLOWED_ORIGINS;
  configurePreviewDataSources();
});

test('unauthenticated request is denied by /api/admin/me', async () => {
  setAdminContextProviderForTests(async () => null);
  const result = await invoke(meHandler, { authorization: '' });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { authenticated: false });
});

test('authenticated non-admin and inactive membership are forbidden', async () => {
  setAdminContextProviderForTests(async () => membershipContext(null));
  assert.equal((await invoke(meHandler)).status, 403);
  setAdminContextProviderForTests(async () => membershipContext('owner', false));
  assert.equal((await invoke(meHandler)).status, 403);
});

test('active owner receives only the sanitized identity contract', async () => {
  setAdminContextProviderForTests(async () => membershipContext());
  const result = await invoke(meHandler);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { authenticated: true, role: 'owner' });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
});

test('/api/auth/config fails closed when Supabase server configuration is missing', async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;

    const result = await invoke(authConfigHandler, { authorization: '' });
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, { error: 'Authentication unavailable' });
  } finally {
    if (supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = supabaseUrl;
    if (publishableKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = publishableKey;
  }
});

test('operator and analyst roles are reserved but denied in Phase 1', async () => {
  for (const role of ['operator', 'analyst']) {
    setAdminContextProviderForTests(async () => membershipContext(role));
    assert.equal((await invoke(meHandler)).status, 403);
  }
});

test('/api/admin/overview returns real aggregate fields only', async () => {
  setAdminContextProviderForTests(async () => membershipContext());
  setReferralCountProviderForTests(async collection => collection === 'pro_waitlist' ? 123 : 17);
  const result = await invoke(overviewHandler);
  assert.equal(result.status, 200);
  assert.equal(result.body.waitlistTotal, 123);
  assert.equal(result.body.foundingReferralParticipants, 17);
  assert.equal(result.body.systemStatus, 'operational');
  assertPrivacy(result.body);
});

test('/api/admin/waitlist/summary aggregates known fields and legacy unknown', async () => {
  setAdminContextProviderForTests(async () => membershipContext());
  const values = new Map([['total', 100], ['master', 22], ['plus', 14], ['pro', 31], ['undecided', 8]]);
  setReferralCountProviderForTests(async (_collection, _field, value) => values.get(value ?? 'total'));
  const result = await invoke(summaryHandler);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.byPlanInterest, { master: 22, plus: 14, pro: 31, undecided: 8, unknown: 25 });
  assertPrivacy(result.body);
});

test('Firestore is never called before owner authorization', async () => {
  setAdminContextProviderForTests(async () => membershipContext(null));
  let called = false;
  setReferralCountProviderForTests(async () => { called = true; return 0; });
  assert.equal((await invoke(summaryHandler)).status, 403);
  assert.equal(called, false);
});

test('Preview accepts only the dedicated Admin staging datastore', () => {
  assert.deepEqual(adminFirestoreConfiguration(), { databaseId: 'rqs-studio-admin-staging' });
  process.env.GCP_ADMIN_FIRESTORE_DATABASE_ID = 'rqs-studio-admin-production';
  assert.throws(() => adminFirestoreConfiguration(), /dedicated Admin staging database/);
});

test('Preview accepts only the audited Referral staging source', () => {
  assert.deepEqual(referralFirestoreConfiguration(), { databaseId: 'rqs-referral-staging' });
  process.env.GCP_REFERRAL_FIRESTORE_DATABASE_ID = 'unaudited-referral-production';
  assert.throws(() => referralFirestoreConfiguration(), /audited Referral staging source/);
});

test('Phase 1 rejects non-Preview and non-Staging execution contexts', () => {
  process.env.VERCEL_ENV = 'production';
  assert.throws(() => adminFirestoreConfiguration(), /restricted to Vercel Preview/);
  process.env.VERCEL_ENV = 'preview';
  process.env.RQS_ADMIN_DATA_ENVIRONMENT = 'production';
  assert.throws(() => referralFirestoreConfiguration(), /must use the staging data environment/);
});

test('Google WIF configuration fails closed when a required provider setting is missing', () => {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  try {
    process.env.GCP_PROJECT_NUMBER = '913434953773';
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID = 'rqs-vercel-preview';
    delete process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;

    assert.throws(
      () => gcpOidcConfiguration(),
      /Missing server environment: GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID/,
    );
  } finally {
    restoreEnvironment('GCP_PROJECT_NUMBER', projectNumber);
    restoreEnvironment('GCP_WORKLOAD_IDENTITY_POOL_ID', poolId);
    restoreEnvironment('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID', providerId);
  }
});

test('Admin datastore and Referral source remain distinct', () => {
  const { admin, referral } = assertFirestoreDataIsolation();
  assert.notEqual(admin.databaseId, referral.databaseId);

  process.env.GCP_ADMIN_FIRESTORE_DATABASE_ID = 'rqs-referral-staging';
  assert.throws(() => assertFirestoreDataIsolation(), /dedicated Admin staging database/);

  configurePreviewDataSources();
  process.env.GCP_REFERRAL_FIRESTORE_DATABASE_ID = 'rqs-studio-admin-staging';
  assert.throws(() => assertFirestoreDataIsolation(), /audited Referral staging source/);
});

test('Referral collection allowlist is enforced before the provider is invoked', async () => {
  let called = false;
  setReferralCountProviderForTests(async () => { called = true; return 0; });
  assert.throws(() => countReferralDocuments('admin_audit_events'), /Referral collection is not allowed/);
  assert.equal(called, false);
});

test('CORS accepts only explicit administrative origins', async () => {
  setAdminContextProviderForTests(async () => membershipContext());
  assert.equal((await invoke(meHandler, { origin: 'https://random-preview.vercel.app' })).status, 403);
  process.env.ADMIN_ALLOWED_ORIGINS = 'https://rqs-admin-git-feature-team.vercel.app';
  const allowed = await invoke(meHandler, { origin: 'https://rqs-admin-git-feature-team.vercel.app' });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://rqs-admin-git-feature-team.vercel.app');
});

function assertPrivacy(body) {
  const serialized = JSON.stringify(body).toLowerCase();
  for (const forbidden of ['email', 'access_token', 'refresh_token', 'private_key', 'authorization', 'user_id', 'signed_url']) {
    assert.equal(serialized.includes(forbidden), false, `response exposes ${forbidden}`);
  }
}

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
