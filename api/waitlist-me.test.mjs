import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './waitlist/me.js';
import { waitlistDocumentId } from './_referral-core.mjs';
import { setAuthenticatedRequestContextProviderForTests, setFirestoreAccessTokenProviderForTests } from './_referral-http.mjs';

process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';
setFirestoreAccessTokenProviderForTests(async () => 'short-lived-test-token');

const verifiedUser = {
  id: 'owner-id',
  email: 'Owner@Example.com',
  email_confirmed_at: '2026-11-01T00:00:00Z',
};

function firestoreDocument(id, fields) {
  return {
    name: `projects/test/databases/rqs-referral-preview/documents/pro_waitlist/${id}`,
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: String(value) }])),
  };
}

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

async function invoke(method, body, fetchImpl, headers = { authorization: 'Bearer verified-user' }) {
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
    await handler({ method, headers, body }, res);
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test.afterEach(() => {
  setAuthenticatedRequestContextProviderForTests(null);
});

test('a request without authentication receives 401 and never reaches Firestore', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => null);
  let called = false;
  const result = await invoke('GET', {}, async () => {
    called = true;
    return response(500);
  }, {});

  assert.equal(result.statusCode, 401);
  assert.equal(called, false);
});

test('verified ownership is derived exclusively from the authenticated normalized email', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => ({ user: verifiedUser, client: {}, environment: 'preview' }));
  const expectedId = waitlistDocumentId('owner@example.com');
  let requestedUrl = '';
  const result = await invoke('GET', { email: 'attacker@example.com' }, async url => {
    requestedUrl = String(url);
    return response(200, firestoreDocument(expectedId, { status: 'waiting' }));
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.plan_interest, 'undecided');
  assert.equal(result.body.legacy_unset, true);
  assert.match(requestedUrl, new RegExp(`/pro_waitlist/${expectedId}$`));
  assert.doesNotMatch(requestedUrl, new RegExp(waitlistDocumentId('attacker@example.com')));
});

test('unverified email cannot read or update a waitlist preference', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => ({
    user: { id: 'owner-id', email: 'owner@example.com' }, client: {}, environment: 'preview',
  }));
  let called = false;
  const result = await invoke('PATCH', { plan_interest: 'pro' }, async () => {
    called = true;
    return response(500);
  });
  assert.equal(result.statusCode, 403);
  assert.equal(called, false);
});

test('preference update is idempotent and never includes referral fields in the update mask', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => ({ user: verifiedUser, client: {}, environment: 'preview' }));
  const id = waitlistDocumentId(verifiedUser.email);
  const patchRequests = [];
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'PATCH') {
      patchRequests.push({ url: String(url), body: JSON.parse(options.body) });
      return response(200, firestoreDocument(id, {
        status: 'waiting', plan_interest: 'plus', referralCode: 'RQSA23456789', referrerParticipantId: 'participant-1',
      }));
    }
    return response(200, firestoreDocument(id, {
      status: 'waiting', plan_interest: 'master', referralCode: 'RQSA23456789', referrerParticipantId: 'participant-1',
    }));
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await invoke('PATCH', { plan_interest: 'plus', referralCode: 'ATTACK' }, fetchImpl);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.plan_interest, 'plus');
  }
  assert.equal(patchRequests.length, 2);
  for (const request of patchRequests) {
    const mask = new URL(request.url).searchParams.getAll('updateMask.fieldPaths');
    assert.deepEqual(mask, ['plan_interest', 'plan_interest_updated_at']);
    assert.deepEqual(Object.keys(request.body.fields).sort(), ['plan_interest', 'plan_interest_updated_at']);
    assert.equal(JSON.stringify(request.body).includes('referral'), false);
  }
});

test('a verified account with a changed email cannot take over the old email hash', async () => {
  setAuthenticatedRequestContextProviderForTests(async () => ({
    user: { ...verifiedUser, email: 'new-owner@example.com' }, client: {}, environment: 'preview',
  }));
  let requestedUrl = '';
  const result = await invoke('GET', {}, async url => {
    requestedUrl = String(url);
    return response(404);
  });
  assert.equal(result.statusCode, 404);
  assert.match(requestedUrl, new RegExp(waitlistDocumentId('new-owner@example.com')));
  assert.doesNotMatch(requestedUrl, new RegExp(waitlistDocumentId('owner@example.com')));
});
