import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cancelReviewFlagAction,
  completeReviewFlagAction,
  confirmReviewFlagAction,
  createReviewFlagAction,
  failReviewFlagAction,
} from '../api/_admin-actions.mjs';

import {
  ADMIN_ACTION_COLLECTION,
  ADMIN_AUDIT_COLLECTION,
  ADMIN_REVIEW_FLAG_COLLECTION,
  AdminActionStoreError,
  buildReviewFlag,
  persistActionTransition,
  persistExecutedReviewFlag,
  persistRequestedAction,
  publicReviewFlag,
  setAdminActionStoreProviderForTests,
} from '../api/_admin-action-store.mjs';

process.env.NODE_TEST_CONTEXT = '1';

const ACTOR_ID =
  '00000000-0000-4000-8000-000000000001';

const ACTION_ID =
  '00000000-0000-4000-8000-000000000002';

const EVENT_ID =
  '00000000-0000-4000-8000-000000000003';

const INPUT = Object.freeze({
  actionType: 'review_flag.set',
  targetKind: 'waitlist',
  targetId: 'opaque-target-01',
  desiredState: 'open',
  reason: 'manual_review',
});

function configure() {
  process.env.VERCEL_ENV = 'preview';
  process.env.RQS_ADMIN_DATA_ENVIRONMENT = 'staging';
  process.env.RQS_ADMIN_ACTIONS_MODE = 'internal-review';
}

function pendingAction() {
  return createReviewFlagAction({
    input: INPUT,
    actorUserId: ACTOR_ID,
    actionId: ACTION_ID,
    now: '2026-11-11T20:00:00.000Z',
  });
}

test.beforeEach(() => {
  configure();
});

test.afterEach(() => {
  setAdminActionStoreProviderForTests(null);
  delete process.env.RQS_ADMIN_ACTIONS_MODE;
});

test('store has no real provider by default', async () => {
  await assert.rejects(
    () => persistRequestedAction(
      pendingAction(),
      { eventId: EVENT_ID },
    ),
    error =>
      error instanceof AdminActionStoreError &&
      error.code === 'ADMIN_ACTION_STORE_UNAVAILABLE',
  );
});

test('requested action is persisted with append-only audit intent', async () => {
  let received = null;

  setAdminActionStoreProviderForTests({
    async createActionWithAudit(payload) {
      received = payload;
      return { created: true };
    },
  });

  const result = await persistRequestedAction(
    pendingAction(),
    { eventId: EVENT_ID },
  );

  assert.deepEqual(result, { created: true });

  assert.deepEqual(received.collections, {
    actions: ADMIN_ACTION_COLLECTION,
    reviewFlags: ADMIN_REVIEW_FLAG_COLLECTION,
    auditEvents: ADMIN_AUDIT_COLLECTION,
  });

  assert.equal(
    received.action.status,
    'pending_confirmation',
  );

  assert.equal(
    received.auditEvent.eventType,
    'action.requested',
  );

  assert.equal(
    received.auditEvent.actorUserId,
    ACTOR_ID,
  );
});

test('confirmation transition carries expected previous status', async () => {
  let received = null;

  setAdminActionStoreProviderForTests({
    async transitionActionWithAudit(payload) {
      received = payload;
      return { transitioned: true };
    },
  });

  const action = confirmReviewFlagAction(
    pendingAction(),
    '2026-11-11T20:05:00.000Z',
  );

  await persistActionTransition(
    action,
    { eventId: EVENT_ID },
  );

  assert.equal(
    received.expectedStatus,
    'pending_confirmation',
  );

  assert.equal(received.action.status, 'executing');

  assert.equal(
    received.auditEvent.eventType,
    'action.confirmed',
  );
});

test('cancelled and failed transitions produce bounded audit events', async () => {
  const events = [];

  setAdminActionStoreProviderForTests({
    async transitionActionWithAudit(payload) {
      events.push(payload.auditEvent);
      return { transitioned: true };
    },
  });

  const pending = pendingAction();

  await persistActionTransition(
    cancelReviewFlagAction(
      pending,
      '2026-11-11T20:01:00.000Z',
    ),
    {
      eventId:
        '00000000-0000-4000-8000-000000000004',
    },
  );

  const executing = confirmReviewFlagAction(
    pending,
    '2026-11-11T20:02:00.000Z',
  );

  await persistActionTransition(
    failReviewFlagAction(
      executing,
      'ADMIN_DATASTORE_WRITE_FAILED',
      '2026-11-11T20:03:00.000Z',
    ),
    {
      expectedStatus: 'executing',
      eventId:
        '00000000-0000-4000-8000-000000000005',
    },
  );

  assert.deepEqual(
    events.map(event => event.eventType),
    [
      'action.cancelled',
      'action.failed',
    ],
  );
});

test('executed action atomically carries review flag and audit intent', async () => {
  let received = null;

  setAdminActionStoreProviderForTests({
    async executeReviewFlagWithAudit(payload) {
      received = payload;
      return { executed: true };
    },
  });

  const executing = confirmReviewFlagAction(
    pendingAction(),
    '2026-11-11T20:02:00.000Z',
  );

  const executed = completeReviewFlagAction(
    executing,
    '2026-11-11T20:03:00.000Z',
  );

  const result = await persistExecutedReviewFlag(
    executed,
    { eventId: EVENT_ID },
  );

  assert.deepEqual(result, { executed: true });

  assert.equal(received.expectedStatus, 'executing');
  assert.equal(received.action.status, 'executed');

  assert.equal(
    received.reviewFlag.targetId,
    INPUT.targetId,
  );

  assert.equal(
    received.reviewFlag.state,
    'open',
  );

  assert.equal(
    received.reviewFlag.lastActionId,
    ACTION_ID,
  );

  assert.equal(
    received.auditEvent.eventType,
    'action.executed',
  );
});

test('review flag id is deterministic and target-safe', () => {
  const action = pendingAction();

  const first = buildReviewFlag(action);
  const second = buildReviewFlag(action);

  assert.equal(
    first.reviewFlagId,
    second.reviewFlagId,
  );

  assert.match(
    first.reviewFlagId,
    /^[a-f0-9]{64}$/,
  );

  assert.equal(
    first.reviewFlagId.includes(INPUT.targetId),
    false,
  );
});

test('browser review flag projection contains no actor identity', () => {
  const flag = {
    ...buildReviewFlag(pendingAction()),
    actorUserId: ACTOR_ID,
  };

  const browser = publicReviewFlag(flag);

  assert.equal(
    'actorUserId' in browser,
    false,
  );

  assert.equal(
    JSON.stringify(browser).includes(ACTOR_ID),
    false,
  );
});

test('test provider override is unavailable outside test context', () => {
  delete process.env.NODE_TEST_CONTEXT;

  assert.throws(
    () =>
      setAdminActionStoreProviderForTests({
        async createActionWithAudit() {},
      }),
    /Test-only Admin action store override/,
  );

  process.env.NODE_TEST_CONTEXT = '1';
});
