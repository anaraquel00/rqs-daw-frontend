import test from 'node:test';
import assert from 'node:assert/strict';
import authConfigHandler from '../api/auth/config.js';
import meHandler from '../api/admin/me.js';
import overviewHandler from '../api/admin/overview.js';
import summaryHandler from '../api/admin/waitlist/summary.js';
import { setAdminContextProviderForTests } from '../api/_auth.mjs';
import { adminEnvironmentConfiguration } from '../api/_firestore-environment.mjs';
import { adminFirestoreConfiguration } from '../api/_firestore-admin.mjs';
import { assertFirestoreDataIsolation } from '../api/_firestore-isolation.mjs';
import {
  countReferralDocuments,
  referralFirestoreConfiguration,
  setReferralCountProviderForTests,
} from '../api/_firestore-referral.mjs';
import { gcpOidcConfiguration } from '../api/_gcp-oidc.mjs';

process.env.NODE_TEST_CONTEXT = '1';

const STAGING = Object.freeze({
  VERCEL_ENV: 'preview',
  RQS_ADMIN_DATA_ENVIRONMENT: 'staging',
  GCP_PROJECT_ID: 'raquel-synths-platform',
  GCP_PROJECT_NUMBER: '913434953773',
  GCP_WORKLOAD_IDENTITY_POOL_ID: 'rqs-vercel-preview',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: 'rqs-studio-admin-preview',
  GCP_SERVICE_ACCOUNT_EMAIL:
    'rqs-studio-admin-preview@raquel-synths-platform.iam.gserviceaccount.com',
  GCP_ADMIN_FIRESTORE_DATABASE_ID: 'rqs-studio-admin-staging',
  GCP_REFERRAL_FIRESTORE_DATABASE_ID: 'rqs-referral-staging',
});

const PRODUCTION = Object.freeze({
  VERCEL_ENV: 'production',
  RQS_ADMIN_DATA_ENVIRONMENT: 'production',
  GCP_PROJECT_ID: 'raquel-synths-platform',
  GCP_PROJECT_NUMBER: '913434953773',
  GCP_WORKLOAD_IDENTITY_POOL_ID: 'rqs-vercel-production',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: 'rqs-studio-admin-production',
  GCP_SERVICE_ACCOUNT_EMAIL:
    'rqs-studio-admin-prod@raquel-synths-platform.iam.gserviceaccount.com',
  GCP_ADMIN_FIRESTORE_DATABASE_ID: 'rqs-studio-admin-prod',
  GCP_REFERRAL_FIRESTORE_DATABASE_ID: 'rqs-referral-preview',
});

function configure(values = STAGING) {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

configure();

function membershipContext(role = 'owner', active = true) {
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      return {
        data: role ? { role, active } : null,
        error: null,
      };
    },
  };

  return {
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email_confirmed_at: '2026-11-01T00:00:00Z',
    },
    client: {
      from(table) {
        assert.equal(table, 'studio_admin_memberships');
        return query;
      },
    },
  };
}

async function invoke(
  handler,
  {
    method = 'GET',
    origin,
    authorization = 'Bearer opaque-token',
  } = {},
) {
  const result = {
    status: 0,
    body: null,
    headers: new Map(),
  };

  const req = {
    method,
    headers: {
      authorization,
      ...(origin ? { origin } : {}),
    },
  };

  const res = {
    setHeader(name, value) {
      result.headers.set(name, value);
    },
    status(status) {
      result.status = status;
      return this;
    },
    json(body) {
      result.body = body;
      return body;
    },
    end() {
      return null;
    },
  };

  await handler(req, res);
  return result;
}

test.afterEach(() => {
  setAdminContextProviderForTests(null);
  setReferralCountProviderForTests(null);
  delete process.env.ADMIN_ALLOWED_ORIGINS;
  configure(STAGING);
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
  assert.deepEqual(result.body, {
    authenticated: true,
    role: 'owner',
  });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(
    result.headers.get('X-Robots-Tag'),
    'noindex, nofollow, noarchive',
  );
});

test('/api/auth/config fails closed when Supabase server configuration is missing', async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;

    const result = await invoke(authConfigHandler, { authorization: '' });

    assert.equal(result.status, 503);
    assert.deepEqual(result.body, {
      error: 'Authentication unavailable',
    });
  } finally {
    restoreEnvironment('SUPABASE_URL', supabaseUrl);
    restoreEnvironment('SUPABASE_PUBLISHABLE_KEY', publishableKey);
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
  setReferralCountProviderForTests(
    async collection => collection === 'pro_waitlist' ? 123 : 17,
  );

  const result = await invoke(overviewHandler);

  assert.equal(result.status, 200);
  assert.equal(result.body.waitlistTotal, 123);
  assert.equal(result.body.foundingReferralParticipants, 17);
  assert.equal(result.body.systemStatus, 'operational');
  assertPrivacy(result.body);
});

test('/api/admin/waitlist/summary aggregates known fields and legacy unknown', async () => {
  setAdminContextProviderForTests(async () => membershipContext());

  const values = new Map([
    ['total', 100],
    ['master', 22],
    ['plus', 14],
    ['pro', 31],
    ['undecided', 8],
  ]);

  setReferralCountProviderForTests(
    async (_collection, _field, value) =>
      values.get(value ?? 'total'),
  );

  const result = await invoke(summaryHandler);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.byPlanInterest, {
    master: 22,
    plus: 14,
    pro: 31,
    undecided: 8,
    unknown: 25,
  });
  assertPrivacy(result.body);
});

test('Firestore is never called before owner authorization', async () => {
  setAdminContextProviderForTests(async () => membershipContext(null));

  let called = false;

  setReferralCountProviderForTests(async () => {
    called = true;
    return 0;
  });

  assert.equal((await invoke(summaryHandler)).status, 403);
  assert.equal(called, false);
});

test('staging contract accepts only preview + staging', () => {
  configure(STAGING);

  const environment = adminEnvironmentConfiguration();

  assert.equal(environment.vercelEnvironment, 'preview');
  assert.equal(environment.dataEnvironment, 'staging');
  assert.equal(environment.adminDatabaseId, 'rqs-studio-admin-staging');
  assert.equal(environment.referralDatabaseId, 'rqs-referral-staging');

  assert.deepEqual(adminFirestoreConfiguration(), {
    databaseId: 'rqs-studio-admin-staging',
    dataEnvironment: 'staging',
  });

  assert.deepEqual(referralFirestoreConfiguration(), {
    databaseId: 'rqs-referral-staging',
    dataEnvironment: 'staging',
  });
});

test('production contract accepts only production + production', () => {
  configure(PRODUCTION);

  const environment = adminEnvironmentConfiguration();

  assert.equal(environment.vercelEnvironment, 'production');
  assert.equal(environment.dataEnvironment, 'production');
  assert.equal(environment.adminDatabaseId, 'rqs-studio-admin-prod');
  assert.equal(environment.referralDatabaseId, 'rqs-referral-preview');

  assert.deepEqual(adminFirestoreConfiguration(), {
    databaseId: 'rqs-studio-admin-prod',
    dataEnvironment: 'production',
  });

  assert.deepEqual(referralFirestoreConfiguration(), {
    databaseId: 'rqs-referral-preview',
    dataEnvironment: 'production',
  });
});

test('crossed and unsupported execution environments fail closed', () => {
  configure(STAGING);
  process.env.VERCEL_ENV = 'production';

  assert.throws(
    () => adminEnvironmentConfiguration(),
    /does not match staging data environment/,
  );

  configure(PRODUCTION);
  process.env.VERCEL_ENV = 'preview';

  assert.throws(
    () => adminEnvironmentConfiguration(),
    /does not match production data environment/,
  );

  configure(STAGING);
  process.env.VERCEL_ENV = 'development';

  assert.throws(
    () => adminEnvironmentConfiguration(),
    /does not match staging data environment/,
  );

  configure(STAGING);
  delete process.env.RQS_ADMIN_DATA_ENVIRONMENT;

  assert.throws(
    () => adminEnvironmentConfiguration(),
    /Missing server environment: RQS_ADMIN_DATA_ENVIRONMENT/,
  );

  configure(STAGING);
  process.env.RQS_ADMIN_DATA_ENVIRONMENT = 'qa';

  assert.throws(
    () => adminEnvironmentConfiguration(),
    /Unknown Studio Admin data environment/,
  );
});

test('Admin Firestore database cannot cross staging and production', () => {
  configure(PRODUCTION);
  process.env.GCP_ADMIN_FIRESTORE_DATABASE_ID = 'rqs-studio-admin-staging';

  assert.throws(
    () => adminFirestoreConfiguration(),
    /does not match production environment/,
  );

  configure(STAGING);
  process.env.GCP_ADMIN_FIRESTORE_DATABASE_ID = 'rqs-studio-admin-prod';

  assert.throws(
    () => adminFirestoreConfiguration(),
    /does not match staging environment/,
  );
});

test('Referral Firestore database cannot cross staging and production', () => {
  configure(PRODUCTION);
  process.env.GCP_REFERRAL_FIRESTORE_DATABASE_ID = 'rqs-referral-staging';

  assert.throws(
    () => referralFirestoreConfiguration(),
    /does not match production environment/,
  );

  configure(STAGING);
  process.env.GCP_REFERRAL_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';

  assert.throws(
    () => referralFirestoreConfiguration(),
    /does not match staging environment/,
  );
});

test('production WIF configuration is exact', () => {
  configure(PRODUCTION);

  const oidc = gcpOidcConfiguration();

  assert.equal(oidc.dataEnvironment, 'production');
  assert.equal(oidc.projectId, 'raquel-synths-platform');
  assert.equal(oidc.projectNumber, '913434953773');
  assert.equal(oidc.poolId, 'rqs-vercel-production');
  assert.equal(oidc.providerId, 'rqs-studio-admin-production');
  assert.equal(
    oidc.serviceAccountEmail,
    'rqs-studio-admin-prod@raquel-synths-platform.iam.gserviceaccount.com',
  );
});

test('staging WIF configuration is exact', () => {
  configure(STAGING);

  const oidc = gcpOidcConfiguration();

  assert.equal(oidc.dataEnvironment, 'staging');
  assert.equal(oidc.poolId, 'rqs-vercel-preview');
  assert.equal(oidc.providerId, 'rqs-studio-admin-preview');
  assert.equal(
    oidc.serviceAccountEmail,
    'rqs-studio-admin-preview@raquel-synths-platform.iam.gserviceaccount.com',
  );
});

test('production rejects every crossed staging WIF identity component', () => {
  const crossed = [
    ['GCP_WORKLOAD_IDENTITY_POOL_ID', STAGING.GCP_WORKLOAD_IDENTITY_POOL_ID],
    [
      'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID',
      STAGING.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
    ],
    ['GCP_SERVICE_ACCOUNT_EMAIL', STAGING.GCP_SERVICE_ACCOUNT_EMAIL],
  ];

  for (const [name, value] of crossed) {
    configure(PRODUCTION);
    process.env[name] = value;

    assert.throws(
      () => gcpOidcConfiguration(),
      /does not match production environment/,
      name,
    );
  }
});

test('staging rejects every crossed production WIF identity component', () => {
  const crossed = [
    [
      'GCP_WORKLOAD_IDENTITY_POOL_ID',
      PRODUCTION.GCP_WORKLOAD_IDENTITY_POOL_ID,
    ],
    [
      'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID',
      PRODUCTION.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
    ],
    ['GCP_SERVICE_ACCOUNT_EMAIL', PRODUCTION.GCP_SERVICE_ACCOUNT_EMAIL],
  ];

  for (const [name, value] of crossed) {
    configure(STAGING);
    process.env[name] = value;

    assert.throws(
      () => gcpOidcConfiguration(),
      /does not match staging environment/,
      name,
    );
  }
});

test('GCP project identity is also fail-closed', () => {
  configure(PRODUCTION);
  process.env.GCP_PROJECT_ID = 'wrong-project';

  assert.throws(
    () => gcpOidcConfiguration(),
    /GCP project does not match production environment/,
  );

  configure(PRODUCTION);
  process.env.GCP_PROJECT_NUMBER = '000000000000';

  assert.throws(
    () => gcpOidcConfiguration(),
    /GCP project number does not match production environment/,
  );
});

test('Google WIF configuration fails closed when a required setting is missing', () => {
  configure(STAGING);
  delete process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;

  assert.throws(
    () => gcpOidcConfiguration(),
    /Missing server environment: GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID/,
  );
});

test('Admin datastore and Referral source remain distinct in both environments', () => {
  for (const environment of [STAGING, PRODUCTION]) {
    configure(environment);

    const { admin, referral } = assertFirestoreDataIsolation();

    assert.equal(
      admin.dataEnvironment,
      referral.dataEnvironment,
    );
    assert.notEqual(
      admin.databaseId,
      referral.databaseId,
    );
  }
});

test('Referral collection allowlist is enforced before provider invocation', async () => {
  let called = false;

  setReferralCountProviderForTests(async () => {
    called = true;
    return 0;
  });

  assert.throws(
    () => countReferralDocuments('admin_audit_events'),
    /Referral collection is not allowed/,
  );

  assert.equal(called, false);
});

test('CORS accepts only explicit administrative origins', async () => {
  setAdminContextProviderForTests(async () => membershipContext());

  assert.equal(
    (await invoke(meHandler, {
      origin: 'https://random-preview.vercel.app',
    })).status,
    403,
  );

  process.env.ADMIN_ALLOWED_ORIGINS =
    'https://rqs-admin-git-feature-team.vercel.app';

  const allowed = await invoke(meHandler, {
    origin: 'https://rqs-admin-git-feature-team.vercel.app',
  });

  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers.get('Access-Control-Allow-Origin'),
    'https://rqs-admin-git-feature-team.vercel.app',
  );
});

function assertPrivacy(body) {
  const serialized = JSON.stringify(body).toLowerCase();

  for (const forbidden of [
    'email',
    'access_token',
    'refresh_token',
    'private_key',
    'authorization',
    'user_id',
    'signed_url',
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `response exposes ${forbidden}`,
    );
  }
}

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
