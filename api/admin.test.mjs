import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sessionHandler from './admin/session.js';
import summaryHandler from './admin/waitlist/summary.js';
import { setAuthenticatedRequestContextProviderForTests, setFirestoreAccessTokenProviderForTests } from './_referral-http.mjs';

process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';
setFirestoreAccessTokenProviderForTests(async () => 'short-lived-test-token');

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function adminContext(role = 'commercial_admin', active = true) {
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: role ? { role, active } : null, error: null }; },
  };
  return {
    user: { id: 'admin-id', email: 'admin@example.com', email_confirmed_at: '2026-11-01T00:00:00Z' },
    client: { from(table) { assert.equal(table, 'studio_admin_memberships'); return query; } },
    environment: 'preview',
  };
}

async function invoke(handler, fetchImpl = globalThis.fetch, headers = { authorization: 'Bearer admin' }) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  const result = { statusCode: 0, body: null };
  const res = {
    setHeader() {},
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return value; },
    end() {},
  };
  try {
    await handler({ method: 'GET', headers }, res);
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test.afterEach(() => setAuthenticatedRequestContextProviderForTests(null));

test('anonymous requests cannot establish a commercial admin session', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => null);
  const result = await invoke(sessionHandler, globalThis.fetch, {});

  assert.equal(result.statusCode, 403);
  assert.equal(result.body.admin, false);
});

test('commercial admin session is authorized separately from paid-plan roles', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => adminContext());
  const allowed = await invoke(sessionHandler);
  assert.deepEqual(allowed.body, { success: true, admin: true, role: 'commercial_admin' });

  setAuthenticatedRequestContextProviderForTests(async () => adminContext('premium'));
  const denied = await invoke(sessionHandler);
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.admin, false);
});

test('dashboard returns aggregate counts only and folds legacy_unset into undecided once', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => adminContext());
  const counts = { total: 20, master: 4, plus: 3, pro: 5, undecided: 2 };
  let requestIndex = 0;
  const result = await invoke(summaryHandler, async (url, options = {}) => {
    assert.match(String(url), /:runAggregationQuery$/);
    const body = JSON.parse(options.body);
    const value = body.structuredAggregationQuery.structuredQuery.where?.fieldFilter?.value?.stringValue;
    const key = value ?? 'total';
    requestIndex += 1;
    return response(200, [{ result: { aggregateFields: { count: { integerValue: String(counts[key]) } } } }]);
  });

  assert.equal(requestIndex, 5);
  assert.equal(result.statusCode, 200);
  assert.deepEqual({
    total: result.body.total,
    master: result.body.master,
    plus: result.body.plus,
    pro: result.body.pro,
    undecided: result.body.undecided,
    legacy_unset: result.body.legacy_unset,
  }, { total: 20, master: 4, plus: 3, pro: 5, undecided: 8, legacy_unset: 6 });
  const serialized = JSON.stringify(result.body).toLowerCase();
  for (const piiKey of ['email', 'user_id', 'name', 'document', 'referralcode']) {
    assert.equal(serialized.includes(piiKey), false, `response must not expose ${piiKey}`);
  }
});

test('non-admin requests cannot reach Firestore aggregations', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => adminContext(null));
  let firestoreCalled = false;
  const result = await invoke(summaryHandler, async () => {
    firestoreCalled = true;
    return response(500);
  });
  assert.equal(result.statusCode, 403);
  assert.equal(firestoreCalled, false);
});

test('an inactive commercial membership cannot reach Firestore aggregations', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => adminContext('commercial_admin', false));
  let firestoreCalled = false;
  const result = await invoke(summaryHandler, async () => {
    firestoreCalled = true;
    return response(500);
  });

  assert.equal(result.statusCode, 403);
  assert.equal(firestoreCalled, false);
});

test('proposed Supabase migration enforces RLS and grants clients read-only own membership', async () => {
  const sql = await readFile(new URL('../supabase/review/studio_admin_memberships_migration.sql', import.meta.url), 'utf8');
  const rlsTests = await readFile(new URL('../supabase/review/studio_admin_memberships_tests.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /create table if not exists/i);
  assert.match(sql, /STUDIO_ADMIN_MEMBERSHIPS_ALREADY_EXISTS/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /grant select on table public\.studio_admin_memberships to authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.studio_admin_memberships to service_role/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[^;]*authenticated/i);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id and active = true/i);
  assert.match(sql, /check \(role in \('commercial_admin'\)\)/i);
  assert.match(rlsTests, /insert into auth\.users/i);
  assert.match(rlsTests, /an authenticated user sees only their own active membership/i);
  assert.match(rlsTests, /an inactive membership is not visible/i);
  assert.match(rlsTests, /anonymous access is rejected/i);
  assert.match(rlsTests, /service_role has explicit CRUD grants/i);
  for (const operation of ['insert', 'update', 'delete']) {
    assert.match(rlsTests, new RegExp(`authenticated cannot ${operation} memberships`, 'i'));
  }
});
