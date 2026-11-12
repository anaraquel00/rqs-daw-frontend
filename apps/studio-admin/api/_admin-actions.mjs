import { randomUUID } from 'node:crypto';
import { adminEnvironmentConfiguration } from './_firestore-environment.mjs';

export const ADMIN_ACTION_TYPE = 'review_flag.set';
export const ADMIN_ACTION_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

const ACTION_MODES = new Set([
  'disabled',
  'internal-review',
]);

const TARGET_KINDS = new Set([
  'waitlist',
  'referral_participant',
]);

const DESIRED_STATES = new Set([
  'open',
  'resolved',
]);

const REASONS = new Set([
  'data_quality',
  'manual_review',
  'follow_up',
]);

const REQUEST_FIELDS = [
  'actionType',
  'targetKind',
  'targetId',
  'desiredState',
  'reason',
].sort();

export class AdminActionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminActionError';
    this.code = code;
  }
}

export function adminActionsConfiguration() {
  const environment = adminEnvironmentConfiguration();
  const mode =
    String(process.env.RQS_ADMIN_ACTIONS_MODE || 'disabled')
      .trim()
      .toLowerCase();

  if (!ACTION_MODES.has(mode)) {
    throw new AdminActionError(
      'INVALID_ACTIONS_MODE',
      'Unknown Studio Admin actions mode',
    );
  }

  if (
    environment.dataEnvironment === 'production' &&
    mode !== 'disabled'
  ) {
    throw new AdminActionError(
      'PRODUCTION_ACTIONS_FORBIDDEN',
      'Studio Admin actions must remain disabled in production',
    );
  }

  return Object.freeze({
    mode,
    enabled: mode === 'internal-review',
    dataEnvironment: environment.dataEnvironment,
    adminDatabaseId: environment.adminDatabaseId,
  });
}

export function assertAdminActionsEnabled() {
  const configuration = adminActionsConfiguration();

  if (!configuration.enabled) {
    throw new AdminActionError(
      'ACTIONS_DISABLED',
      'Studio Admin actions are disabled',
    );
  }

  return configuration;
}

export function validateReviewFlagRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalidRequest('Action request must be an object');
  }

  const keys = Object.keys(input).sort();

  if (
    keys.length !== REQUEST_FIELDS.length ||
    keys.some((key, index) => key !== REQUEST_FIELDS[index])
  ) {
    throw invalidRequest('Action request contains unsupported fields');
  }

  if (input.actionType !== ADMIN_ACTION_TYPE) {
    throw invalidRequest('Unsupported action type');
  }

  if (!TARGET_KINDS.has(input.targetKind)) {
    throw invalidRequest('Unsupported target kind');
  }

  if (!DESIRED_STATES.has(input.desiredState)) {
    throw invalidRequest('Unsupported desired state');
  }

  if (!REASONS.has(input.reason)) {
    throw invalidRequest('Unsupported review reason');
  }

  assertOpaqueDocumentId(input.targetId);

  return Object.freeze({
    actionType: input.actionType,
    targetKind: input.targetKind,
    targetId: input.targetId,
    desiredState: input.desiredState,
    reason: input.reason,
  });
}

export function createReviewFlagAction({
  input,
  actorUserId,
  actionId = randomUUID(),
  now = new Date(),
}) {
  const configuration = assertAdminActionsEnabled();
  const request = validateReviewFlagRequest(input);

  assertUuid(actionId, 'action id');
  assertUuid(actorUserId, 'actor user id');

  const createdAt = validDate(now, 'creation time');
  const confirmationExpiresAt = new Date(
    createdAt.getTime() + ADMIN_ACTION_CONFIRMATION_TTL_MS,
  );

  return Object.freeze({
    schemaVersion: 1,
    actionId,
    ...request,
    status: 'pending_confirmation',
    dataEnvironment: configuration.dataEnvironment,
    createdAt: createdAt.toISOString(),
    confirmationExpiresAt: confirmationExpiresAt.toISOString(),
    confirmedAt: null,
    executedAt: null,
    cancelledAt: null,
    expiredAt: null,
    failureCode: null,
    actorUserId,
  });
}

export function confirmReviewFlagAction(action, now = new Date()) {
  assertActionDocument(action);

  if (action.status !== 'pending_confirmation') {
    throw conflict('Action is not pending confirmation');
  }

  const confirmedAt = validDate(now, 'confirmation time');
  const expiresAt = new Date(action.confirmationExpiresAt);

  if (confirmedAt.getTime() >= expiresAt.getTime()) {
    return Object.freeze({
      ...action,
      status: 'expired',
      expiredAt: confirmedAt.toISOString(),
    });
  }

  return Object.freeze({
    ...action,
    status: 'executing',
    confirmedAt: confirmedAt.toISOString(),
  });
}

export function cancelReviewFlagAction(action, now = new Date()) {
  assertActionDocument(action);

  if (action.status !== 'pending_confirmation') {
    throw conflict('Only a pending action can be cancelled');
  }

  const cancelledAt = validDate(now, 'cancellation time');

  return Object.freeze({
    ...action,
    status: 'cancelled',
    cancelledAt: cancelledAt.toISOString(),
  });
}

export function completeReviewFlagAction(action, now = new Date()) {
  assertActionDocument(action);

  if (action.status !== 'executing') {
    throw conflict('Only an executing action can complete');
  }

  const executedAt = validDate(now, 'execution time');

  return Object.freeze({
    ...action,
    status: 'executed',
    executedAt: executedAt.toISOString(),
    failureCode: null,
  });
}

export function failReviewFlagAction(
  action,
  failureCode,
  now = new Date(),
) {
  assertActionDocument(action);

  if (action.status !== 'executing') {
    throw conflict('Only an executing action can fail');
  }

  if (
    typeof failureCode !== 'string' ||
    !/^[A-Z0-9_]{3,64}$/.test(failureCode)
  ) {
    throw invalidRequest('Invalid failure code');
  }

  const executedAt = validDate(now, 'failure time');

  return Object.freeze({
    ...action,
    status: 'failed',
    executedAt: executedAt.toISOString(),
    failureCode,
  });
}

export function publicAdminAction(action) {
  assertActionDocument(action);

  return Object.freeze({
    actionId: action.actionId,
    actionType: action.actionType,
    targetKind: action.targetKind,
    targetId: action.targetId,
    desiredState: action.desiredState,
    reason: action.reason,
    status: action.status,
    dataEnvironment: action.dataEnvironment,
    createdAt: action.createdAt,
    confirmationExpiresAt: action.confirmationExpiresAt,
    confirmedAt: action.confirmedAt,
    executedAt: action.executedAt,
    cancelledAt: action.cancelledAt,
    expiredAt: action.expiredAt,
    failureCode: action.failureCode,
  });
}

function assertActionDocument(action) {
  if (
    !action ||
    typeof action !== 'object' ||
    action.actionType !== ADMIN_ACTION_TYPE
  ) {
    throw invalidRequest('Invalid action document');
  }

  assertUuid(action.actionId, 'action id');
  assertUuid(action.actorUserId, 'actor user id');
}

function assertOpaqueDocumentId(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    Buffer.byteLength(value, 'utf8') > 1500 ||
    value.includes('/') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw invalidRequest('Invalid target document id');
  }
}

function assertUuid(value, label) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw invalidRequest(`Invalid ${label}`);
  }
}

function validDate(value, label) {
  const result =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(result.getTime())) {
    throw invalidRequest(`Invalid ${label}`);
  }

  return result;
}

function invalidRequest(message) {
  return new AdminActionError('INVALID_ACTION', message);
}

function conflict(message) {
  return new AdminActionError('ACTION_CONFLICT', message);
}
