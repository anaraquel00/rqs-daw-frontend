import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_ACTION_CONFIRMATION_TTL_MS,
  AdminActionError,
  adminActionsConfiguration,
  cancelReviewFlagAction,
  completeReviewFlagAction,
  confirmReviewFlagAction,
  createReviewFlagAction,
  failReviewFlagAction,
  publicAdminAction,
  validateReviewFlagRequest,
} from '../api/_admin-actions.mjs';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const ACTION_ID = '00000000-0000-4000-8000-000000000002';

const VALID_REQUEST = Object.freeze({
  actionType: 'review_flag.set',
  targetKind: 'waitlist',
  targetId: 'opaque-waitlist-id-01',
  desiredState: 'open',
  reason: 'manual_review',
});

function configureStaging(mode = 'internal-review') {
  process.env.VERCEL_ENV = 'preview';
  process.env.RQS_ADMIN_DATA_ENVIRONMENT = 'staging';
  process.env.RQS_ADMIN_ACTIONS_MODE = mode;
}

test.beforeEach(() => {
  configureStaging();
});

test.afterEach(() => {
  delete process.env.RQS_ADMIN_ACTIONS_MODE;
});

test('actions default fail-closed when mode is absent', () => {
  delete process.env.RQS_ADMIN_ACTIONS_MODE;

  const config = adminActionsConfiguration();

  assert.equal(config.mode, 'disabled');
  assert.equal(config.enabled, false);

  assert.throws(
    () => createReviewFlagAction({
      input: VALID_REQUEST,
      actorUserId: ACTOR_ID,
      actionId: ACTION_ID,
    }),
    error =>
      error instanceof AdminActionError &&
      error.code === 'ACTIONS_DISABLED',
  );
});

test('unknown actions mode fails closed', () => {
  configureStaging('write-everything');

  assert.throws(
    () => adminActionsConfiguration(),
    /Unknown Studio Admin actions mode/,
  );
});

test('valid review flag request creates a bounded pending action', () => {
  const now = new Date('2026-11-11T20:00:00.000Z');

  const action = createReviewFlagAction({
    input: VALID_REQUEST,
    actorUserId: ACTOR_ID,
    actionId: ACTION_ID,
    now,
  });

  assert.equal(action.status, 'pending_confirmation');
  assert.equal(action.dataEnvironment, 'staging');
  assert.equal(action.actorUserId, ACTOR_ID);
  assert.equal(action.targetId, VALID_REQUEST.targetId);
  assert.equal(action.createdAt, now.toISOString());

  assert.equal(
    Date.parse(action.confirmationExpiresAt) - Date.parse(action.createdAt),
    ADMIN_ACTION_CONFIRMATION_TTL_MS,
  );
});

test('request contract rejects unknown fields and free-text payloads', () => {
  assert.throws(
    () => validateReviewFlagRequest({
      ...VALID_REQUEST,
      note: 'email@example.com',
    }),
    /unsupported fields/,
  );

  assert.throws(
    () => validateReviewFlagRequest({
      ...VALID_REQUEST,
      reason: 'please contact this person',
    }),
    /Unsupported review reason/,
  );

  assert.throws(
    () => validateReviewFlagRequest({
      ...VALID_REQUEST,
      targetKind: 'billing',
    }),
    /Unsupported target kind/,
  );
});

test('opaque Firestore target id is preserved exactly', () => {
  const targetId = ' founding-participant-legacy-01 ';

  const request = validateReviewFlagRequest({
    ...VALID_REQUEST,
    targetKind: 'referral_participant',
    targetId,
  });

  assert.equal(request.targetId, targetId);

  assert.throws(
    () => validateReviewFlagRequest({
      ...VALID_REQUEST,
      targetId: 'collection/document',
    }),
    /Invalid target document id/,
  );
});

test('confirmation transitions only pending actions and expires at TTL', () => {
  const createdAt = new Date('2026-11-11T20:00:00.000Z');

  const pending = createReviewFlagAction({
    input: VALID_REQUEST,
    actorUserId: ACTOR_ID,
    actionId: ACTION_ID,
    now: createdAt,
  });

  const executing = confirmReviewFlagAction(
    pending,
    new Date('2026-11-11T20:05:00.000Z'),
  );

  assert.equal(executing.status, 'executing');
  assert.equal(
    executing.confirmedAt,
    '2026-11-11T20:05:00.000Z',
  );

  assert.throws(
    () => confirmReviewFlagAction(executing),
    error =>
      error instanceof AdminActionError &&
      error.code === 'ACTION_CONFLICT',
  );

  const expired = confirmReviewFlagAction(
    pending,
    new Date('2026-11-11T20:10:00.000Z'),
  );

  assert.equal(expired.status, 'expired');
  assert.equal(
    expired.expiredAt,
    '2026-11-11T20:10:00.000Z',
  );
});

test('cancel, complete and fail transitions are state constrained', () => {
  const pending = createReviewFlagAction({
    input: VALID_REQUEST,
    actorUserId: ACTOR_ID,
    actionId: ACTION_ID,
    now: '2026-11-11T20:00:00.000Z',
  });

  const cancelled = cancelReviewFlagAction(
    pending,
    '2026-11-11T20:01:00.000Z',
  );

  assert.equal(cancelled.status, 'cancelled');

  const executing = confirmReviewFlagAction(
    pending,
    '2026-11-11T20:02:00.000Z',
  );

  const completed = completeReviewFlagAction(
    executing,
    '2026-11-11T20:03:00.000Z',
  );

  assert.equal(completed.status, 'executed');

  const failed = failReviewFlagAction(
    executing,
    'ADMIN_DATASTORE_WRITE_FAILED',
    '2026-11-11T20:03:00.000Z',
  );

  assert.equal(failed.status, 'failed');
  assert.equal(
    failed.failureCode,
    'ADMIN_DATASTORE_WRITE_FAILED',
  );

  assert.throws(
    () => completeReviewFlagAction(pending),
    /Only an executing action can complete/,
  );
});

test('browser action projection excludes actor identity', () => {
  const action = createReviewFlagAction({
    input: VALID_REQUEST,
    actorUserId: ACTOR_ID,
    actionId: ACTION_ID,
  });

  const browser = publicAdminAction(action);
  const serialized = JSON.stringify(browser);

  assert.equal('actorUserId' in browser, false);
  assert.equal(serialized.includes(ACTOR_ID), false);
  assert.equal(browser.targetId, VALID_REQUEST.targetId);
});

test('production rejects internal-review mode even when explicitly configured', () => {
  process.env.VERCEL_ENV = 'production';
  process.env.RQS_ADMIN_DATA_ENVIRONMENT = 'production';
  process.env.RQS_ADMIN_ACTIONS_MODE = 'internal-review';

  assert.throws(
    () => adminActionsConfiguration(),
    error =>
      error instanceof AdminActionError &&
      error.code === 'PRODUCTION_ACTIONS_FORBIDDEN',
  );
});
