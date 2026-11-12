import { createHash, randomUUID } from 'node:crypto';

export const ADMIN_ACTION_COLLECTION = 'admin_action_requests';
export const ADMIN_REVIEW_FLAG_COLLECTION = 'admin_review_flags';
export const ADMIN_AUDIT_COLLECTION = 'admin_audit_events';

const TRANSITION_EVENTS = Object.freeze({
  executing: 'action.confirmed',
  cancelled: 'action.cancelled',
  expired: 'action.expired',
  failed: 'action.failed',
});

export class AdminActionStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminActionStoreError';
    this.code = code;
  }
}

const unavailableProvider = Object.freeze({
  async getAction() {
    throw unavailable();
  },

  async createActionWithAudit() {
    throw unavailable();
  },

  async transitionActionWithAudit() {
    throw unavailable();
  },

  async executeReviewFlagWithAudit() {
    throw unavailable();
  },
});

let storeProvider = unavailableProvider;

export async function getStoredAction(
  actionId,
  {
    provider = storeProvider,
  } = {},
) {
  assertUuid(actionId, 'action id');

  if (
    !provider ||
    typeof provider.getAction !== 'function'
  ) {
    throw unavailable();
  }

  const action = await provider.getAction({
    collections: collectionContract(),
    actionId,
  });

  if (action === null) {
    return null;
  }

  assertActionDocument(action);

  return action;
}

export async function persistRequestedAction(
  action,
  {
    eventId = randomUUID(),
    provider = storeProvider,
  } = {},
) {
  assertActionStatus(action, 'pending_confirmation');
  assertUuid(eventId, 'audit event id');

  const auditEvent = buildAuditEvent({
    action,
    eventId,
    eventType: 'action.requested',
    timestamp: action.createdAt,
  });

  return provider.createActionWithAudit({
    collections: collectionContract(),
    action,
    auditEvent,
  });
}

export async function persistActionTransition(
  action,
  {
    expectedStatus = 'pending_confirmation',
    eventId = randomUUID(),
    provider = storeProvider,
  } = {},
) {
  assertActionDocument(action);

  const eventType = TRANSITION_EVENTS[action.status];

  if (!eventType) {
    throw invalidStoreRequest(
      `Unsupported persisted transition status: ${action.status}`,
    );
  }

  assertUuid(eventId, 'audit event id');

  const timestamp = transitionTimestamp(action);

  const auditEvent = buildAuditEvent({
    action,
    eventId,
    eventType,
    timestamp,
  });

  return provider.transitionActionWithAudit({
    collections: collectionContract(),
    expectedStatus,
    action,
    auditEvent,
  });
}

export async function persistExecutedReviewFlag(
  action,
  {
    eventId = randomUUID(),
    provider = storeProvider,
  } = {},
) {
  assertActionStatus(action, 'executed');
  assertUuid(eventId, 'audit event id');

  const reviewFlag = buildReviewFlag(action);

  const auditEvent = buildAuditEvent({
    action,
    eventId,
    eventType: 'action.executed',
    timestamp: action.executedAt,
  });

  return provider.executeReviewFlagWithAudit({
    collections: collectionContract(),
    expectedStatus: 'executing',
    action,
    reviewFlag,
    auditEvent,
  });
}

export function buildReviewFlag(action) {
  assertActionDocument(action);

  if (
    action.desiredState !== 'open' &&
    action.desiredState !== 'resolved'
  ) {
    throw invalidStoreRequest('Invalid review flag state');
  }

  const updatedAt =
    action.executedAt ||
    action.confirmedAt ||
    action.createdAt;

  assertIsoTimestamp(updatedAt, 'review flag timestamp');

  return Object.freeze({
    reviewFlagId: reviewFlagIdentifier(
      action.targetKind,
      action.targetId,
    ),
    targetKind: action.targetKind,
    targetId: action.targetId,
    state: action.desiredState,
    reason: action.reason,
    updatedAt,
    lastActionId: action.actionId,
  });
}

export function publicReviewFlag(flag) {
  if (!flag || typeof flag !== 'object') {
    throw invalidStoreRequest('Invalid review flag');
  }

  return Object.freeze({
    reviewFlagId: flag.reviewFlagId,
    targetKind: flag.targetKind,
    targetId: flag.targetId,
    state: flag.state,
    reason: flag.reason,
    updatedAt: flag.updatedAt,
    lastActionId: flag.lastActionId,
  });
}

export function setAdminActionStoreProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error(
      'Test-only Admin action store override',
    );
  }

  storeProvider = provider ?? unavailableProvider;
}

function buildAuditEvent({
  action,
  eventId,
  eventType,
  timestamp,
}) {
  assertIsoTimestamp(timestamp, 'audit event timestamp');

  return Object.freeze({
    schemaVersion: 1,
    eventId,
    actionId: action.actionId,
    eventType,
    dataEnvironment: action.dataEnvironment,
    timestamp,
    actorUserId: action.actorUserId,
  });
}

function collectionContract() {
  return Object.freeze({
    actions: ADMIN_ACTION_COLLECTION,
    reviewFlags: ADMIN_REVIEW_FLAG_COLLECTION,
    auditEvents: ADMIN_AUDIT_COLLECTION,
  });
}

function transitionTimestamp(action) {
  switch (action.status) {
    case 'executing':
      return action.confirmedAt;
    case 'cancelled':
      return action.cancelledAt;
    case 'expired':
      return action.expiredAt;
    case 'failed':
      return action.executedAt;
    default:
      throw invalidStoreRequest(
        'Unknown action transition timestamp',
      );
  }
}

function reviewFlagIdentifier(targetKind, targetId) {
  if (
    typeof targetKind !== 'string' ||
    typeof targetId !== 'string' ||
    targetKind.length === 0 ||
    targetId.length === 0
  ) {
    throw invalidStoreRequest('Invalid review flag target');
  }

  return createHash('sha256')
    .update(`${targetKind}\u0000${targetId}`)
    .digest('hex');
}

function assertActionStatus(action, status) {
  assertActionDocument(action);

  if (action.status !== status) {
    throw new AdminActionStoreError(
      'ACTION_STORE_CONFLICT',
      `Expected action status ${status}`,
    );
  }
}

function assertActionDocument(action) {
  if (
    !action ||
    typeof action !== 'object' ||
    typeof action.actionId !== 'string' ||
    typeof action.actorUserId !== 'string' ||
    action.actionType !== 'review_flag.set'
  ) {
    throw invalidStoreRequest('Invalid action document');
  }

  assertUuid(action.actionId, 'action id');
  assertUuid(action.actorUserId, 'actor user id');
}

function assertUuid(value, label) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw invalidStoreRequest(`Invalid ${label}`);
  }
}

function assertIsoTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    Number.isNaN(Date.parse(value))
  ) {
    throw invalidStoreRequest(`Invalid ${label}`);
  }
}

function invalidStoreRequest(message) {
  return new AdminActionStoreError(
    'INVALID_ACTION_STORE_REQUEST',
    message,
  );
}

function unavailable() {
  return new AdminActionStoreError(
    'ADMIN_ACTION_STORE_UNAVAILABLE',
    'Admin action store provider is unavailable',
  );
}
