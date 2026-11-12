import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getStoredAction,
  setAdminActionStoreProviderForTests,
} from '../api/_admin-action-store.mjs';

import {
  adminActionRuntimeProvider,
  setAdminActionRuntimeProviderForTests,
} from '../api/_admin-action-runtime.mjs';

import {
  AdminActionHttpError,
  mapAdminActionError,
  prepareAdminMutationRequest,
  requireActionId,
  requireIdempotencyKey,
  requireJsonRequest,
} from '../api/_admin-action-http.mjs';

process.env.NODE_TEST_CONTEXT = '1';

const ACTION_ID =
  '00000000-0000-4000-8000-000000000002';

const ACTOR_ID =
  '00000000-0000-4000-8000-000000000001';

function responseStub() {
  return {
    headers: new Map(),

    setHeader(name, value) {
      this.headers.set(name, value);
    },

    status() {
      return this;
    },

    json() {
      return this;
    },

    end() {
      return this;
    },
  };
}

test.afterEach(() => {
  setAdminActionStoreProviderForTests(null);
  setAdminActionRuntimeProviderForTests(null);
  delete process.env.ADMIN_ALLOWED_ORIGINS;
});

test('stored action read stays server-internal and uses bounded collection contract', async () => {
  let received = null;

  const action = {
    schemaVersion: 1,
    actionId: ACTION_ID,
    actionType: 'review_flag.set',
    targetKind: 'waitlist',
    targetId: 'opaque-target',
    desiredState: 'open',
    reason: 'manual_review',
    status: 'pending_confirmation',
    dataEnvironment: 'staging',
    createdAt: '2026-11-11T20:00:00.000Z',
    confirmationExpiresAt: '2026-11-11T20:10:00.000Z',
    confirmedAt: null,
    executedAt: null,
    cancelledAt: null,
    expiredAt: null,
    failureCode: null,
    actorUserId: ACTOR_ID,
  };

  setAdminActionStoreProviderForTests({
    async getAction(payload) {
      received = payload;
      return action;
    },
  });

  const stored =
    await getStoredAction(ACTION_ID);

  assert.equal(
    stored.actorUserId,
    ACTOR_ID,
  );

  assert.deepEqual(
    received.collections,
    {
      actions:
        'admin_action_requests',
      reviewFlags:
        'admin_review_flags',
      auditEvents:
        'admin_audit_events',
    },
  );
});

test('runtime provider can only be overridden in test context', () => {
  const original =
    adminActionRuntimeProvider();

  const fake = {
    async getAction() {
      return null;
    },
  };

  setAdminActionRuntimeProviderForTests(
    fake,
  );

  assert.equal(
    adminActionRuntimeProvider(),
    fake,
  );

  delete process.env.NODE_TEST_CONTEXT;

  assert.throws(
    () =>
      setAdminActionRuntimeProviderForTests(
        original,
      ),
    /Test-only Admin action runtime override/,
  );

  process.env.NODE_TEST_CONTEXT = '1';
});

test('mutation requests require an allowed or exact same-origin Origin', () => {
  const res = responseStub();

  const missing =
    prepareAdminMutationRequest(
      { headers: {} },
      res,
    );

  assert.equal(
    missing.allowed,
    false,
  );

  process.env.ADMIN_ALLOWED_ORIGINS =
    'https://preview.example';

  const allowed =
    prepareAdminMutationRequest(
      {
        headers: {
          origin:
            'https://preview.example',
        },
      },
      responseStub(),
    );

  assert.equal(
    allowed.allowed,
    true,
  );

  const sameOrigin =
    prepareAdminMutationRequest(
      {
        headers: {
          origin:
            'https://preview-deployment.vercel.app',
          host:
            'preview-deployment.vercel.app',
        },
      },
      responseStub(),
    );

  assert.equal(
    sameOrigin.allowed,
    true,
  );

  const crossOrigin =
    prepareAdminMutationRequest(
      {
        headers: {
          origin:
            'https://evil.example',
          host:
            'preview-deployment.vercel.app',
        },
      },
      responseStub(),
    );

  assert.equal(
    crossOrigin.allowed,
    false,
  );

  const denied =
    prepareAdminMutationRequest(
      {
        headers: {
          origin:
            'https://evil.example',
        },
      },
      responseStub(),
    );

  assert.equal(
    denied.allowed,
    false,
  );
});

test('JSON mutation body is strict', () => {
  const body = {
    actionType:
      'review_flag.set',
  };

  assert.equal(
    requireJsonRequest({
      headers: {
        'content-type':
          'application/json',
      },
      body,
    }),
    body,
  );

  assert.throws(
    () =>
      requireJsonRequest({
        headers: {},
        body,
      }),
    error =>
      error instanceof
        AdminActionHttpError &&
      error.status === 415,
  );

  assert.throws(
    () =>
      requireJsonRequest({
        headers: {
          'content-type':
            'application/json',
        },
        body: [],
      }),
    /INVALID_JSON_BODY/,
  );
});

test('idempotency and action IDs accept UUID only', () => {
  assert.equal(
    requireIdempotencyKey({
      headers: {
        'x-idempotency-key':
          ACTION_ID,
      },
    }),
    ACTION_ID,
  );

  assert.equal(
    requireActionId(ACTION_ID),
    ACTION_ID,
  );

  assert.throws(
    () =>
      requireIdempotencyKey({
        headers: {
          'x-idempotency-key':
            'retry-123',
        },
      }),
    /INVALID_IDEMPOTENCY_KEY/,
  );

  assert.throws(
    () =>
      requireActionId(
        '../action',
      ),
    /INVALID_ACTION_ID/,
  );
});

test('internal errors map to sanitized HTTP contracts', () => {
  assert.deepEqual(
    mapAdminActionError({
      code:
        'ACTION_STORE_CONFLICT',
    }),
    {
      status: 409,
      code:
        'ACTION_CONFLICT',
    },
  );

  assert.deepEqual(
    mapAdminActionError({
      code:
        'ADMIN_ACTION_STORE_PERMISSION_DENIED',
    }),
    {
      status: 503,
      code:
        'ACTION_STORE_UNAVAILABLE',
    },
  );

  assert.deepEqual(
    mapAdminActionError(
      new Error('secret detail'),
    ),
    {
      status: 503,
      code:
        'ACTION_CONTROL_UNAVAILABLE',
    },
  );
});
