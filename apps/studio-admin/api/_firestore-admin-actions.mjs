import {
  assertAdminActionsEnabled,
} from './_admin-actions.mjs';

import {
  ADMIN_ACTION_COLLECTION,
  ADMIN_AUDIT_COLLECTION,
  ADMIN_REVIEW_FLAG_COLLECTION,
  AdminActionStoreError,
} from './_admin-action-store.mjs';

import {
  adminFirestoreConfiguration,
} from './_firestore-admin.mjs';

import {
  assertFirestoreDataIsolation,
} from './_firestore-isolation.mjs';

import {
  gcpOidcAccessToken,
  gcpOidcConfiguration,
} from './_gcp-oidc.mjs';

const FIRESTORE_API =
  'https://firestore.googleapis.com/v1';

const IMMUTABLE_ACTION_FIELDS = Object.freeze([
  'schemaVersion',
  'actionId',
  'actionType',
  'targetKind',
  'targetId',
  'desiredState',
  'reason',
  'dataEnvironment',
  'createdAt',
  'confirmationExpiresAt',
  'actorUserId',
]);

export function createFirestoreAdminActionStoreProvider({
  fetchImpl = globalThis.fetch,
  accessTokenProvider = gcpOidcAccessToken,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('Firestore fetch implementation required');
  }

  if (typeof accessTokenProvider !== 'function') {
    throw new TypeError('Firestore access token provider required');
  }

  return Object.freeze({
    async getAction({
      collections,
      actionId,
    }) {
      assertCollectionContract(collections);

      const context = await runtimeContext(
        accessTokenProvider,
      );

      const document = await getDocument(
        context,
        documentName(
          context,
          collections.actions,
          actionId,
        ),
        fetchImpl,
      );

      return document?.fields ?? null;
    },

    async createActionWithAudit({
      collections,
      action,
      auditEvent,
    }) {
      assertCollectionContract(collections);

      const context = await runtimeContext(
        accessTokenProvider,
      );

      assertEnvironment(action, context);
      assertEnvironment(auditEvent, context);

      const writes = [
        createOnlyWrite(
          documentName(
            context,
            collections.actions,
            action.actionId,
          ),
          action,
        ),
        createOnlyWrite(
          documentName(
            context,
            collections.auditEvents,
            auditEvent.eventId,
          ),
          auditEvent,
        ),
      ];

      const result = await commitWrites(
        context,
        writes,
        fetchImpl,
      );

      return {
        created: true,
        commitTime: result.commitTime ?? null,
      };
    },

    async transitionActionWithAudit({
      collections,
      expectedStatus,
      action,
      auditEvent,
    }) {
      assertCollectionContract(collections);

      const context = await runtimeContext(
        accessTokenProvider,
      );

      assertEnvironment(action, context);
      assertEnvironment(auditEvent, context);

      const name = documentName(
        context,
        collections.actions,
        action.actionId,
      );

      const current = await getDocument(
        context,
        name,
        fetchImpl,
      );

      if (!current) {
        throw conflict(
          'Admin action does not exist',
        );
      }

      assertCurrentAction(
        current.fields,
        action,
        expectedStatus,
      );

      const writes = [
        updateAtVersionWrite(
          name,
          action,
          current.updateTime,
        ),
        createOnlyWrite(
          documentName(
            context,
            collections.auditEvents,
            auditEvent.eventId,
          ),
          auditEvent,
        ),
      ];

      const result = await commitWrites(
        context,
        writes,
        fetchImpl,
      );

      return {
        transitioned: true,
        commitTime: result.commitTime ?? null,
      };
    },

    async executeReviewFlagWithAudit({
      collections,
      expectedStatus,
      action,
      reviewFlag,
      auditEvent,
    }) {
      assertCollectionContract(collections);

      const context = await runtimeContext(
        accessTokenProvider,
      );

      assertEnvironment(action, context);
      assertEnvironment(auditEvent, context);

      const actionName = documentName(
        context,
        collections.actions,
        action.actionId,
      );

      const flagName = documentName(
        context,
        collections.reviewFlags,
        reviewFlag.reviewFlagId,
      );

      const [
        currentAction,
        currentFlag,
      ] = await Promise.all([
        getDocument(
          context,
          actionName,
          fetchImpl,
        ),
        getDocument(
          context,
          flagName,
          fetchImpl,
        ),
      ]);

      if (!currentAction) {
        throw conflict(
          'Admin action does not exist',
        );
      }

      assertCurrentAction(
        currentAction.fields,
        action,
        expectedStatus,
      );

      if (currentFlag) {
        assertCurrentReviewFlag(
          currentFlag.fields,
          reviewFlag,
        );
      }

      const flagWrite = currentFlag
        ? updateAtVersionWrite(
            flagName,
            reviewFlag,
            currentFlag.updateTime,
          )
        : createOnlyWrite(
            flagName,
            reviewFlag,
          );

      const writes = [
        updateAtVersionWrite(
          actionName,
          action,
          currentAction.updateTime,
        ),
        flagWrite,
        createOnlyWrite(
          documentName(
            context,
            collections.auditEvents,
            auditEvent.eventId,
          ),
          auditEvent,
        ),
      ];

      const result = await commitWrites(
        context,
        writes,
        fetchImpl,
      );

      return {
        executed: true,
        commitTime: result.commitTime ?? null,
      };
    },
  });
}

async function runtimeContext(
  accessTokenProvider,
) {
  const actions =
    assertAdminActionsEnabled();

  const isolation =
    assertFirestoreDataIsolation();

  const admin =
    adminFirestoreConfiguration();

  const oidc =
    gcpOidcConfiguration();

  if (
    actions.dataEnvironment !==
      admin.dataEnvironment ||
    isolation.admin.dataEnvironment !==
      admin.dataEnvironment ||
    isolation.referral.dataEnvironment !==
      admin.dataEnvironment
  ) {
    throw unavailable(
      'Admin action environment isolation failed',
    );
  }

  if (
    actions.adminDatabaseId !==
      admin.databaseId ||
    isolation.admin.databaseId !==
      admin.databaseId
  ) {
    throw unavailable(
      'Admin action database isolation failed',
    );
  }

  if (
    admin.databaseId ===
    isolation.referral.databaseId
  ) {
    throw unavailable(
      'Admin action database overlaps Referral',
    );
  }

  const accessToken =
    await accessTokenProvider(oidc);

  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0
  ) {
    throw unavailable(
      'Admin Firestore access token unavailable',
    );
  }

  return Object.freeze({
    projectId: oidc.projectId,
    databaseId: admin.databaseId,
    dataEnvironment:
      admin.dataEnvironment,
    accessToken,
  });
}

async function getDocument(
  context,
  name,
  fetchImpl,
) {
  const response = await fetchImpl(
    `${FIRESTORE_API}/${name}`,
    {
      method: 'GET',
      headers: {
        Authorization:
          `Bearer ${context.accessToken}`,
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await firestoreFailure(
      response,
      'Admin Firestore read failed',
    );
  }

  const document =
    await response.json();

  if (
    !document ||
    typeof document !== 'object' ||
    typeof document.updateTime !== 'string'
  ) {
    throw unavailable(
      'Invalid Admin Firestore document',
    );
  }

  return {
    name: document.name,
    updateTime: document.updateTime,
    fields:
      decodeFirestoreFields(
        document.fields ?? {},
      ),
  };
}

async function commitWrites(
  context,
  writes,
  fetchImpl,
) {
  const database =
    `projects/${context.projectId}` +
    `/databases/${context.databaseId}`;

  const response = await fetchImpl(
    `${FIRESTORE_API}/${database}` +
      '/documents:commit',
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${context.accessToken}`,
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({ writes }),
    },
  );

  if (!response.ok) {
    throw await firestoreFailure(
      response,
      'Admin Firestore commit failed',
    );
  }

  return response.json();
}

function createOnlyWrite(
  name,
  value,
) {
  return {
    update: firestoreDocument(
      name,
      value,
    ),
    currentDocument: {
      exists: false,
    },
  };
}

function updateAtVersionWrite(
  name,
  value,
  updateTime,
) {
  if (
    typeof updateTime !== 'string' ||
    Number.isNaN(Date.parse(updateTime))
  ) {
    throw invalid(
      'Invalid Firestore update time',
    );
  }

  return {
    update: firestoreDocument(
      name,
      value,
    ),
    currentDocument: {
      updateTime,
    },
  };
}

function firestoreDocument(
  name,
  value,
) {
  return {
    name,
    fields:
      encodeFirestoreFields(value),
  };
}

function encodeFirestoreFields(
  value,
) {
  const fields = {};

  for (
    const [key, fieldValue]
    of Object.entries(value)
  ) {
    fields[key] =
      encodeFirestoreValue(fieldValue);
  }

  return fields;
}

function encodeFirestoreValue(
  value,
) {
  if (value === null) {
    return {
      nullValue: null,
    };
  }

  if (typeof value === 'string') {
    return {
      stringValue: value,
    };
  }

  if (typeof value === 'boolean') {
    return {
      booleanValue: value,
    };
  }

  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value)
  ) {
    return {
      integerValue:
        String(value),
    };
  }

  throw invalid(
    'Unsupported Admin Firestore value',
  );
}

function decodeFirestoreFields(
  fields,
) {
  const value = {};

  for (
    const [key, encoded]
    of Object.entries(fields)
  ) {
    value[key] =
      decodeFirestoreValue(encoded);
  }

  return value;
}

function decodeFirestoreValue(
  encoded,
) {
  if (
    Object.prototype.hasOwnProperty.call(
      encoded,
      'nullValue',
    )
  ) {
    return null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      encoded,
      'stringValue',
    )
  ) {
    return encoded.stringValue;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      encoded,
      'booleanValue',
    )
  ) {
    return encoded.booleanValue;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      encoded,
      'integerValue',
    )
  ) {
    const value =
      Number(encoded.integerValue);

    if (!Number.isSafeInteger(value)) {
      throw invalid(
        'Invalid Firestore integer value',
      );
    }

    return value;
  }

  throw invalid(
    'Unsupported Admin Firestore field',
  );
}

function assertCurrentAction(
  current,
  next,
  expectedStatus,
) {
  if (
    current.status !== expectedStatus
  ) {
    throw conflict(
      'Admin action state changed',
    );
  }

  for (
    const field
    of IMMUTABLE_ACTION_FIELDS
  ) {
    if (
      current[field] !== next[field]
    ) {
      throw conflict(
        `Admin action immutable field changed: ${field}`,
      );
    }
  }
}

function assertCurrentReviewFlag(
  current,
  next,
) {
  if (
    current.reviewFlagId !==
      next.reviewFlagId ||
    current.targetKind !==
      next.targetKind ||
    current.targetId !==
      next.targetId
  ) {
    throw conflict(
      'Review flag target changed',
    );
  }
}

function assertEnvironment(
  value,
  context,
) {
  if (
    value.dataEnvironment !==
      undefined &&
    value.dataEnvironment !==
      context.dataEnvironment
  ) {
    throw conflict(
      'Admin action environment changed',
    );
  }
}

function assertCollectionContract(
  collections,
) {
  if (
    !collections ||
    collections.actions !==
      ADMIN_ACTION_COLLECTION ||
    collections.reviewFlags !==
      ADMIN_REVIEW_FLAG_COLLECTION ||
    collections.auditEvents !==
      ADMIN_AUDIT_COLLECTION
  ) {
    throw invalid(
      'Invalid Admin action collection contract',
    );
  }
}

function documentName(
  context,
  collection,
  documentId,
) {
  if (
    typeof documentId !== 'string' ||
    documentId.length === 0 ||
    documentId.includes('/')
  ) {
    throw invalid(
      'Invalid Admin Firestore document id',
    );
  }

  return (
    `projects/${context.projectId}` +
    `/databases/${context.databaseId}` +
    `/documents/${collection}/` +
    encodeURIComponent(documentId)
  );
}

async function firestoreFailure(
  response,
  fallback,
) {
  let payload = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  const canonicalStatus =
    String(
      payload?.error?.status || '',
    ).toUpperCase();

  if (
    response.status === 409 ||
    canonicalStatus ===
      'ALREADY_EXISTS' ||
    canonicalStatus ===
      'FAILED_PRECONDITION' ||
    canonicalStatus ===
      'ABORTED'
  ) {
    return conflict(
      'Admin Firestore write conflict',
    );
  }

  if (
    response.status === 403 ||
    canonicalStatus ===
      'PERMISSION_DENIED'
  ) {
    return new AdminActionStoreError(
      'ADMIN_ACTION_STORE_PERMISSION_DENIED',
      'Admin Firestore permission denied',
    );
  }

  return unavailable(fallback);
}

function conflict(
  message,
) {
  return new AdminActionStoreError(
    'ACTION_STORE_CONFLICT',
    message,
  );
}

function invalid(
  message,
) {
  return new AdminActionStoreError(
    'INVALID_ACTION_STORE_REQUEST',
    message,
  );
}

function unavailable(
  message,
) {
  return new AdminActionStoreError(
    'ADMIN_ACTION_STORE_UNAVAILABLE',
    message,
  );
}
