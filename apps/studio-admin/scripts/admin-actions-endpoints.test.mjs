import test from 'node:test';
import assert from 'node:assert/strict';

import requestHandler from '../api/admin/actions/request.js';
import confirmHandler from '../api/admin/actions/confirm.js';
import cancelHandler from '../api/admin/actions/cancel.js';
import configHandler from '../api/admin/actions/config.js';

import {
  setAdminContextProviderForTests,
} from '../api/_auth.mjs';

import {
  AdminActionStoreError,
} from '../api/_admin-action-store.mjs';

import {
  setAdminActionRuntimeProviderForTests,
} from '../api/_admin-action-runtime.mjs';

process.env.NODE_TEST_CONTEXT = '1';

const ORIGIN =
  'https://admin-preview.example';

const OWNER_ID =
  '00000000-0000-4000-8000-000000000001';

const REQUEST_KEY =
  '00000000-0000-4000-8000-000000000010';

const CONFIRM_KEY =
  '00000000-0000-4000-8000-000000000011';

const CANCEL_KEY =
  '00000000-0000-4000-8000-000000000012';

const BODY = Object.freeze({
  actionType: 'review_flag.set',
  targetKind: 'waitlist',
  targetId: 'opaque-target-01',
  desiredState: 'open',
  reason: 'manual_review',
});

function configure() {
  process.env.VERCEL_ENV =
    'preview';

  process.env.RQS_ADMIN_DATA_ENVIRONMENT =
    'staging';

  process.env.RQS_ADMIN_ACTIONS_MODE =
    'internal-review';

  process.env.ADMIN_ALLOWED_ORIGINS =
    ORIGIN;
}

function membershipContext(
  role = 'owner',
  active = true,
) {
  const query = {
    select() {
      return this;
    },

    eq() {
      return this;
    },

    async maybeSingle() {
      return {
        data:
          role
            ? { role, active }
            : null,
        error: null,
      };
    },
  };

  return {
    user: {
      id: OWNER_ID,
      email_confirmed_at:
        '2026-11-01T00:00:00Z',
    },

    client: {
      from(table) {
        assert.equal(
          table,
          'studio_admin_memberships',
        );

        return query;
      },
    },
  };
}

function createProvider() {
  const actions =
    new Map();

  const flags =
    new Map();

  const stats = {
    get: 0,
    create: 0,
    transition: 0,
    execute: 0,
  };

  return {
    actions,
    flags,
    stats,

    async getAction({
      actionId,
    }) {
      stats.get += 1;

      return actions.has(actionId)
        ? structuredClone(
            actions.get(actionId),
          )
        : null;
    },

    async createActionWithAudit({
      action,
    }) {
      stats.create += 1;

      if (
        actions.has(action.actionId)
      ) {
        throw new AdminActionStoreError(
          'ACTION_STORE_CONFLICT',
          'already exists',
        );
      }

      actions.set(
        action.actionId,
        structuredClone(action),
      );

      return {
        created: true,
      };
    },

    async transitionActionWithAudit({
      expectedStatus,
      action,
    }) {
      stats.transition += 1;

      const current =
        actions.get(action.actionId);

      if (
        !current ||
        current.status !==
          expectedStatus
      ) {
        throw new AdminActionStoreError(
          'ACTION_STORE_CONFLICT',
          'state changed',
        );
      }

      actions.set(
        action.actionId,
        structuredClone(action),
      );

      return {
        transitioned: true,
      };
    },

    async executeReviewFlagWithAudit({
      expectedStatus,
      action,
      reviewFlag,
    }) {
      stats.execute += 1;

      const current =
        actions.get(action.actionId);

      if (
        !current ||
        current.status !==
          expectedStatus
      ) {
        throw new AdminActionStoreError(
          'ACTION_STORE_CONFLICT',
          'state changed',
        );
      }

      actions.set(
        action.actionId,
        structuredClone(action),
      );

      flags.set(
        reviewFlag.reviewFlagId,
        structuredClone(reviewFlag),
      );

      return {
        executed: true,
      };
    },
  };
}

async function invoke(
  handler,
  {
    body = {},
    key = REQUEST_KEY,
    origin = ORIGIN,
    authorization =
      'Bearer opaque-token',
    contentType =
      'application/json',
  } = {},
) {
  const result = {
    status: 0,
    body: null,
    headers: new Map(),
  };

  const req = {
    method: 'POST',
    body,
    headers: {
      authorization,
      origin,
      'content-type':
        contentType,
      'x-idempotency-key':
        key,
    },
  };

  const res = {
    setHeader(name, value) {
      result.headers.set(
        name,
        value,
      );
    },

    status(status) {
      result.status = status;
      return this;
    },

    json(bodyValue) {
      result.body = bodyValue;
      return bodyValue;
    },

    end() {
      return null;
    },
  };

  await handler(req, res);

  return result;
}


async function invokeGet(
  handler,
  {
    origin = ORIGIN,
    authorization =
      'Bearer opaque-token',
  } = {},
) {
  const result = {
    status: 0,
    body: null,
    headers: new Map(),
  };

  const req = {
    method: 'GET',
    headers: {
      authorization,
      origin,
    },
  };

  const res = {
    setHeader(name, value) {
      result.headers.set(
        name,
        value,
      );
    },

    status(status) {
      result.status = status;
      return this;
    },

    json(bodyValue) {
      result.body = bodyValue;
      return bodyValue;
    },

    end() {
      return null;
    },
  };

  await handler(req, res);

  return result;
}

test.beforeEach(() => {
  configure();

  setAdminContextProviderForTests(
    async () =>
      membershipContext(),
  );
});

test.afterEach(() => {
  setAdminContextProviderForTests(
    null,
  );

  setAdminActionRuntimeProviderForTests(
    null,
  );

  delete process.env.ADMIN_ALLOWED_ORIGINS;
  delete process.env.RQS_ADMIN_ACTIONS_MODE;
});

test('mutation rejects missing Origin before provider invocation', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  const result =
    await invoke(
      requestHandler,
      {
        body: BODY,
        origin: '',
      },
    );

  assert.equal(
    result.status,
    403,
  );

  assert.equal(
    provider.stats.create,
    0,
  );

  assert.equal(
    provider.stats.get,
    0,
  );
});

test('unauthenticated caller is rejected before action provider', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  setAdminContextProviderForTests(
    async () => null,
  );

  const result =
    await invoke(
      requestHandler,
      {
        body: BODY,
        authorization: '',
      },
    );

  assert.equal(
    result.status,
    401,
  );

  assert.equal(
    provider.stats.create,
    0,
  );

  assert.equal(
    provider.stats.get,
    0,
  );
});

test('request creates one sanitized pending action', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  const result =
    await invoke(
      requestHandler,
      {
        body: BODY,
      },
    );

  assert.equal(
    result.status,
    201,
  );

  assert.equal(
    result.body.replayed,
    false,
  );

  assert.equal(
    result.body.action.actionId,
    REQUEST_KEY,
  );

  assert.equal(
    result.body.action.status,
    'pending_confirmation',
  );

  assert.equal(
    'actorUserId' in
      result.body.action,
    false,
  );

  assert.equal(
    provider.actions.size,
    1,
  );
});

test('same request idempotency key replays but different payload conflicts', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  const first =
    await invoke(
      requestHandler,
      {
        body: BODY,
      },
    );

  const replay =
    await invoke(
      requestHandler,
      {
        body: BODY,
      },
    );

  assert.equal(
    first.status,
    201,
  );

  assert.equal(
    replay.status,
    200,
  );

  assert.equal(
    replay.body.replayed,
    true,
  );

  assert.equal(
    provider.actions.size,
    1,
  );

  const conflict =
    await invoke(
      requestHandler,
      {
        body: {
          ...BODY,
          reason:
            'data_quality',
        },
      },
    );

  assert.equal(
    conflict.status,
    409,
  );

  assert.equal(
    conflict.body.error,
    'IDEMPOTENCY_KEY_REUSED',
  );
});

test('confirm executes review flag and same key is replay-safe', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  await invoke(
    requestHandler,
    {
      body: BODY,
    },
  );

  const confirmed =
    await invoke(
      confirmHandler,
      {
        body: {
          actionId:
            REQUEST_KEY,
        },
        key:
          CONFIRM_KEY,
      },
    );

  assert.equal(
    confirmed.status,
    200,
  );

  assert.equal(
    confirmed.body.replayed,
    false,
  );

  assert.equal(
    confirmed.body.action.status,
    'executed',
  );

  assert.equal(
    provider.flags.size,
    1,
  );

  assert.equal(
    provider.stats.execute,
    1,
  );

  const replay =
    await invoke(
      confirmHandler,
      {
        body: {
          actionId:
            REQUEST_KEY,
        },
        key:
          CONFIRM_KEY,
      },
    );

  assert.equal(
    replay.status,
    200,
  );

  assert.equal(
    replay.body.replayed,
    true,
  );

  assert.equal(
    provider.stats.execute,
    1,
  );

  assert.equal(
    'confirmationIdempotencyKey'
      in replay.body.action,
    false,
  );
});

test('different confirmation key cannot re-execute an executed action', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  await invoke(
    requestHandler,
    {
      body: BODY,
    },
  );

  await invoke(
    confirmHandler,
    {
      body: {
        actionId:
          REQUEST_KEY,
      },
      key:
        CONFIRM_KEY,
    },
  );

  const result =
    await invoke(
      confirmHandler,
      {
        body: {
          actionId:
            REQUEST_KEY,
        },
        key:
          '00000000-0000-4000-8000-000000000099',
      },
    );

  assert.equal(
    result.status,
    409,
  );

  assert.equal(
    provider.stats.execute,
    1,
  );
});

test('cancel is idempotent and prevents later execution', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  await invoke(
    requestHandler,
    {
      body: BODY,
    },
  );

  const cancelled =
    await invoke(
      cancelHandler,
      {
        body: {
          actionId:
            REQUEST_KEY,
        },
        key:
          CANCEL_KEY,
      },
    );

  assert.equal(
    cancelled.status,
    200,
  );

  assert.equal(
    cancelled.body.action.status,
    'cancelled',
  );

  const replay =
    await invoke(
      cancelHandler,
      {
        body: {
          actionId:
            REQUEST_KEY,
        },
        key:
          CANCEL_KEY,
      },
    );

  assert.equal(
    replay.status,
    200,
  );

  assert.equal(
    replay.body.replayed,
    true,
  );

  const confirm =
    await invoke(
      confirmHandler,
      {
        body: {
          actionId:
            REQUEST_KEY,
        },
        key:
          CONFIRM_KEY,
      },
    );

  assert.equal(
    confirm.status,
    409,
  );

  assert.equal(
    provider.stats.execute,
    0,
  );
});

test('Production actions fail before runtime provider invocation', async () => {
  const provider =
    createProvider();

  setAdminActionRuntimeProviderForTests(
    provider,
  );

  process.env.VERCEL_ENV =
    'production';

  process.env.RQS_ADMIN_DATA_ENVIRONMENT =
    'production';

  process.env.RQS_ADMIN_ACTIONS_MODE =
    'internal-review';

  const result =
    await invoke(
      requestHandler,
      {
        body: BODY,
      },
    );

  assert.equal(
    result.status,
    503,
  );

  assert.equal(
    result.body.error,
    'ACTIONS_DISABLED',
  );

  assert.equal(
    provider.stats.get,
    0,
  );

  assert.equal(
    provider.stats.create,
    0,
  );
});


test('actions config exposes staging capability without privileged identity', async () => {
  const result =
    await invokeGet(
      configHandler,
    );

  assert.equal(
    result.status,
    200,
  );

  assert.deepEqual(
    result.body,
    {
      enabled: true,
      mode:
        'internal-review',
      dataEnvironment:
        'staging',
    },
  );

  const serialized =
    JSON.stringify(
      result.body,
    );

  assert.equal(
    serialized.includes(
      OWNER_ID,
    ),
    false,
  );
});

test('actions config reports disabled in Production', async () => {
  process.env.VERCEL_ENV =
    'production';

  process.env.RQS_ADMIN_DATA_ENVIRONMENT =
    'production';

  process.env.RQS_ADMIN_ACTIONS_MODE =
    'disabled';

  const result =
    await invokeGet(
      configHandler,
    );

  assert.equal(
    result.status,
    200,
  );

  assert.deepEqual(
    result.body,
    {
      enabled: false,
      mode: 'disabled',
      dataEnvironment:
        'production',
    },
  );
});
