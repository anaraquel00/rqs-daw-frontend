import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeReviewFlagAction,
  confirmReviewFlagAction,
  createReviewFlagAction,
} from '../api/_admin-actions.mjs';

import {
  AdminActionStoreError,
  persistActionTransition,
  persistExecutedReviewFlag,
  persistRequestedAction,
  setAdminActionStoreProviderForTests,
} from '../api/_admin-action-store.mjs';

import {
  createFirestoreAdminActionStoreProvider,
} from '../api/_firestore-admin-actions.mjs';

process.env.NODE_TEST_CONTEXT = '1';

const ACTOR_ID =
  '00000000-0000-4000-8000-000000000001';

const ACTION_ID =
  '00000000-0000-4000-8000-000000000002';

const EVENT_ID =
  '00000000-0000-4000-8000-000000000003';

const UPDATE_TIME =
  '2026-11-11T20:00:30.000Z';

const INPUT = Object.freeze({
  actionType: 'review_flag.set',
  targetKind: 'waitlist',
  targetId: 'opaque-target-01',
  desiredState: 'open',
  reason: 'manual_review',
});

const STAGING = Object.freeze({
  VERCEL_ENV: 'preview',
  RQS_ADMIN_DATA_ENVIRONMENT:
    'staging',
  RQS_ADMIN_ACTIONS_MODE:
    'internal-review',
  GCP_PROJECT_ID:
    'raquel-synths-platform',
  GCP_PROJECT_NUMBER:
    '913434953773',
  GCP_WORKLOAD_IDENTITY_POOL_ID:
    'rqs-vercel-preview',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:
    'rqs-studio-admin-preview',
  GCP_SERVICE_ACCOUNT_EMAIL:
    'rqs-studio-admin-preview@raquel-synths-platform.iam.gserviceaccount.com',
  GCP_ADMIN_FIRESTORE_DATABASE_ID:
    'rqs-studio-admin-staging',
  GCP_REFERRAL_FIRESTORE_DATABASE_ID:
    'rqs-referral-staging',
});

function configure(
  values = STAGING,
) {
  for (
    const [key, value]
    of Object.entries(values)
  ) {
    process.env[key] = value;
  }
}

function pendingAction() {
  return createReviewFlagAction({
    input: INPUT,
    actorUserId: ACTOR_ID,
    actionId: ACTION_ID,
    now:
      '2026-11-11T20:00:00.000Z',
  });
}

function fakeResponse(
  status,
  body = {},
) {
  return {
    status,
    ok:
      status >= 200 &&
      status < 300,

    async json() {
      return body;
    },
  };
}

function encodeFields(
  value,
) {
  const fields = {};

  for (
    const [key, item]
    of Object.entries(value)
  ) {
    if (item === null) {
      fields[key] = {
        nullValue: null,
      };
    } else if (
      typeof item === 'string'
    ) {
      fields[key] = {
        stringValue: item,
      };
    } else if (
      typeof item === 'boolean'
    ) {
      fields[key] = {
        booleanValue: item,
      };
    } else if (
      Number.isSafeInteger(item)
    ) {
      fields[key] = {
        integerValue:
          String(item),
      };
    } else {
      throw new Error(
        `Unsupported test field ${key}`,
      );
    }
  }

  return fields;
}

function firestoreDocument(
  collection,
  documentId,
  value,
  updateTime = UPDATE_TIME,
) {
  return {
    name:
      'projects/raquel-synths-platform' +
      '/databases/rqs-studio-admin-staging' +
      `/documents/${collection}/${documentId}`,
    fields:
      encodeFields(value),
    updateTime,
  };
}

function providerWith(
  fetchImpl,
  tokenSpy = null,
) {
  const accessTokenProvider =
    async () => {
      tokenSpy?.();
      return 'fake-access-token';
    };

  return createFirestoreAdminActionStoreProvider({
    fetchImpl,
    accessTokenProvider,
  });
}

test.beforeEach(() => {
  configure();
});

test.afterEach(() => {
  setAdminActionStoreProviderForTests(
    null,
  );
});

test('create uses one atomic Admin DB commit with create-only action and audit writes', async () => {
  const requests = [];

  const fetchImpl =
    async (url, options) => {
      requests.push({
        url,
        options,
      });

      return fakeResponse(
        200,
        {
          commitTime:
            '2026-11-11T20:00:01.000Z',
        },
      );
    };

  setAdminActionStoreProviderForTests(
    providerWith(fetchImpl),
  );

  const result =
    await persistRequestedAction(
      pendingAction(),
      {
        eventId: EVENT_ID,
      },
    );

  assert.equal(
    result.created,
    true,
  );

  assert.equal(
    requests.length,
    1,
  );

  assert.match(
    requests[0].url,
    /databases\/rqs-studio-admin-staging\/documents:commit$/,
  );

  assert.doesNotMatch(
    requests[0].url,
    /rqs-referral-staging/,
  );

  const body =
    JSON.parse(
      requests[0].options.body,
    );

  assert.equal(
    body.writes.length,
    2,
  );

  assert.match(
    body.writes[0].update.name,
    /admin_action_requests/,
  );

  assert.deepEqual(
    body.writes[0].currentDocument,
    { exists: false },
  );

  assert.match(
    body.writes[1].update.name,
    /admin_audit_events/,
  );

  assert.deepEqual(
    body.writes[1].currentDocument,
    { exists: false },
  );
});

test('transition reads current action then commits with updateTime precondition', async () => {
  const requests = [];

  const pending =
    pendingAction();

  const executing =
    confirmReviewFlagAction(
      pending,
      '2026-11-11T20:05:00.000Z',
    );

  const fetchImpl =
    async (url, options = {}) => {
      requests.push({
        url,
        options,
      });

      if (
        (options.method || 'GET') ===
        'GET'
      ) {
        return fakeResponse(
          200,
          firestoreDocument(
            'admin_action_requests',
            ACTION_ID,
            pending,
          ),
        );
      }

      return fakeResponse(
        200,
        {
          commitTime:
            '2026-11-11T20:05:01.000Z',
        },
      );
    };

  setAdminActionStoreProviderForTests(
    providerWith(fetchImpl),
  );

  await persistActionTransition(
    executing,
    {
      eventId: EVENT_ID,
    },
  );

  assert.equal(
    requests.length,
    2,
  );

  assert.equal(
    requests[0].options.method,
    'GET',
  );

  const body =
    JSON.parse(
      requests[1].options.body,
    );

  assert.equal(
    body.writes.length,
    2,
  );

  assert.deepEqual(
    body.writes[0].currentDocument,
    {
      updateTime: UPDATE_TIME,
    },
  );

  assert.equal(
    body.writes[0]
      .update
      .fields
      .status
      .stringValue,
    'executing',
  );
});

test('transition rejects stale logical state before commit', async () => {
  let commitCalled = false;

  const pending =
    pendingAction();

  const executing =
    confirmReviewFlagAction(
      pending,
      '2026-11-11T20:05:00.000Z',
    );

  const stale = {
    ...pending,
    status: 'cancelled',
    cancelledAt:
      '2026-11-11T20:01:00.000Z',
  };

  const fetchImpl =
    async (url, options = {}) => {
      if (
        (options.method || 'GET') ===
        'GET'
      ) {
        return fakeResponse(
          200,
          firestoreDocument(
            'admin_action_requests',
            ACTION_ID,
            stale,
          ),
        );
      }

      commitCalled = true;

      return fakeResponse(
        200,
        {},
      );
    };

  setAdminActionStoreProviderForTests(
    providerWith(fetchImpl),
  );

  await assert.rejects(
    () =>
      persistActionTransition(
        executing,
        {
          eventId: EVENT_ID,
        },
      ),
    error =>
      error instanceof
        AdminActionStoreError &&
      error.code ===
        'ACTION_STORE_CONFLICT',
  );

  assert.equal(
    commitCalled,
    false,
  );
});

test('executed action atomically updates action, review flag and audit event', async () => {
  const requests = [];

  const pending =
    pendingAction();

  const executing =
    confirmReviewFlagAction(
      pending,
      '2026-11-11T20:02:00.000Z',
    );

  const executed =
    completeReviewFlagAction(
      executing,
      '2026-11-11T20:03:00.000Z',
    );

  const fetchImpl =
    async (url, options = {}) => {
      requests.push({
        url,
        options,
      });

      if (
        url.includes(
          '/admin_action_requests/',
        )
      ) {
        return fakeResponse(
          200,
          firestoreDocument(
            'admin_action_requests',
            ACTION_ID,
            executing,
          ),
        );
      }

      if (
        url.includes(
          '/admin_review_flags/',
        ) &&
        (options.method || 'GET') ===
          'GET'
      ) {
        return fakeResponse(
          404,
          {},
        );
      }

      return fakeResponse(
        200,
        {
          commitTime:
            '2026-11-11T20:03:01.000Z',
        },
      );
    };

  setAdminActionStoreProviderForTests(
    providerWith(fetchImpl),
  );

  await persistExecutedReviewFlag(
    executed,
    {
      eventId: EVENT_ID,
    },
  );

  const commit =
    requests.find(
      request =>
        request.options.method ===
        'POST',
    );

  assert.ok(commit);

  const body =
    JSON.parse(
      commit.options.body,
    );

  assert.equal(
    body.writes.length,
    3,
  );

  assert.match(
    body.writes[0].update.name,
    /admin_action_requests/,
  );

  assert.match(
    body.writes[1].update.name,
    /admin_review_flags/,
  );

  assert.deepEqual(
    body.writes[1].currentDocument,
    { exists: false },
  );

  assert.match(
    body.writes[2].update.name,
    /admin_audit_events/,
  );
});

test('existing review flag uses optimistic updateTime precondition', async () => {
  const requests = [];

  const pending =
    pendingAction();

  const executing =
    confirmReviewFlagAction(
      pending,
      '2026-11-11T20:02:00.000Z',
    );

  const executed =
    completeReviewFlagAction(
      executing,
      '2026-11-11T20:03:00.000Z',
    );

  const existingFlag = {
    reviewFlagId:
      '0'.repeat(64),
    targetKind:
      INPUT.targetKind,
    targetId:
      INPUT.targetId,
    state:
      'open',
    reason:
      'data_quality',
    updatedAt:
      '2026-11-10T00:00:00.000Z',
    lastActionId:
      '00000000-0000-4000-8000-000000000099',
  };

  let generatedFlagId = null;

  const fetchImpl =
    async (url, options = {}) => {
      requests.push({
        url,
        options,
      });

      if (
        url.includes(
          '/admin_action_requests/',
        )
      ) {
        return fakeResponse(
          200,
          firestoreDocument(
            'admin_action_requests',
            ACTION_ID,
            executing,
          ),
        );
      }

      if (
        url.includes(
          '/admin_review_flags/',
        ) &&
        (options.method || 'GET') ===
          'GET'
      ) {
        generatedFlagId =
          decodeURIComponent(
            url.split('/').at(-1),
          );

        return fakeResponse(
          200,
          firestoreDocument(
            'admin_review_flags',
            generatedFlagId,
            {
              ...existingFlag,
              reviewFlagId:
                generatedFlagId,
            },
            '2026-11-11T19:00:00.000Z',
          ),
        );
      }

      return fakeResponse(
        200,
        {},
      );
    };

  setAdminActionStoreProviderForTests(
    providerWith(fetchImpl),
  );

  await persistExecutedReviewFlag(
    executed,
    {
      eventId: EVENT_ID,
    },
  );

  assert.ok(
    generatedFlagId,
  );

  const commit =
    requests.find(
      request =>
        request.options.method ===
        'POST',
    );

  const body =
    JSON.parse(
      commit.options.body,
    );

  assert.deepEqual(
    body.writes[1].currentDocument,
    {
      updateTime:
        '2026-11-11T19:00:00.000Z',
    },
  );
});

test('production rejects writer before token acquisition or network access', async () => {
  // Create a valid action while the test environment is still staging.
  // Then switch to Production to prove the writer itself fails closed
  // before token acquisition or network access.
  const pending =
    pendingAction();

  process.env.VERCEL_ENV =
    'production';

  process.env.RQS_ADMIN_DATA_ENVIRONMENT =
    'production';

  process.env.RQS_ADMIN_ACTIONS_MODE =
    'internal-review';

  process.env.GCP_WORKLOAD_IDENTITY_POOL_ID =
    'rqs-vercel-production';

  process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID =
    'rqs-studio-admin-production';

  process.env.GCP_SERVICE_ACCOUNT_EMAIL =
    'rqs-studio-admin-prod@raquel-synths-platform.iam.gserviceaccount.com';

  process.env.GCP_ADMIN_FIRESTORE_DATABASE_ID =
    'rqs-studio-admin-prod';

  process.env.GCP_REFERRAL_FIRESTORE_DATABASE_ID =
    'rqs-referral-preview';

  let tokenCalled = false;
  let fetchCalled = false;

  const provider =
    createFirestoreAdminActionStoreProvider({
      accessTokenProvider:
        async () => {
          tokenCalled = true;
          return 'must-not-happen';
        },

      fetchImpl:
        async () => {
          fetchCalled = true;

          return fakeResponse(
            200,
            {},
          );
        },
    });

  setAdminActionStoreProviderForTests(
    provider,
  );

  await assert.rejects(
    () =>
      persistRequestedAction(
        pending,
        {
          eventId: EVENT_ID,
        },
      ),
    error =>
      error?.code ===
        'PRODUCTION_ACTIONS_FORBIDDEN',
  );

  assert.equal(
    tokenCalled,
    false,
  );

  assert.equal(
    fetchCalled,
    false,
  );
});

test('Firestore permission denial is sanitized', async () => {
  const fetchImpl =
    async () =>
      fakeResponse(
        403,
        {
          error: {
            status:
              'PERMISSION_DENIED',
          },
        },
      );

  setAdminActionStoreProviderForTests(
    providerWith(fetchImpl),
  );

  await assert.rejects(
    () =>
      persistRequestedAction(
        pendingAction(),
        {
          eventId: EVENT_ID,
        },
      ),
    error =>
      error instanceof
        AdminActionStoreError &&
      error.code ===
        'ADMIN_ACTION_STORE_PERMISSION_DENIED',
  );
});
