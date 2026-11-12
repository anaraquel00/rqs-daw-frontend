import { authorizeOwner } from '../../_auth.mjs';

import {
  assertAdminActionsEnabled,
  createReviewFlagAction,
  publicAdminAction,
} from '../../_admin-actions.mjs';

import {
  getStoredAction,
  persistRequestedAction,
} from '../../_admin-action-store.mjs';

import {
  adminActionRuntimeProvider,
} from '../../_admin-action-runtime.mjs';

import {
  deriveIdempotencyUuid,
  mapAdminActionError,
  prepareAdminMutationRequest,
  requireIdempotencyKey,
  requireJsonRequest,
  respondAdminAction,
} from '../../_admin-action-http.mjs';

const ROUTE =
  '/api/admin/actions/request';

export default async function handler(
  req,
  res,
) {
  const context =
    prepareAdminMutationRequest(
      req,
      res,
    );

  if (!context.allowed) {
    return respondAdminAction(
      res,
      context,
      ROUTE,
      403,
      {
        error:
          'ORIGIN_REQUIRED_OR_NOT_ALLOWED',
      },
    );
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return respondAdminAction(
      res,
      context,
      ROUTE,
      405,
      {
        error: 'METHOD_NOT_ALLOWED',
      },
    );
  }

  let authorization = null;

  try {
    authorization =
      await authorizeOwner(req);

    if (authorization.status !== 200) {
      return respondAdminAction(
        res,
        context,
        ROUTE,
        authorization.status,
        {
          error:
            authorization.status === 401
              ? 'UNAUTHENTICATED'
              : 'FORBIDDEN',
        },
        authorization.userId,
      );
    }

    assertAdminActionsEnabled();

    const body =
      requireJsonRequest(req);

    const idempotencyKey =
      requireIdempotencyKey(req);

    const action =
      createReviewFlagAction({
        input: body,
        actorUserId:
          authorization.userId,
        actionId:
          idempotencyKey,
      });

    const provider =
      adminActionRuntimeProvider();

    try {
      await persistRequestedAction(
        action,
        {
          provider,
          eventId:
            deriveIdempotencyUuid(
              idempotencyKey,
              'request',
            ),
        },
      );
    } catch (error) {
      if (
        error?.code !==
          'ACTION_STORE_CONFLICT'
      ) {
        throw error;
      }

      const existing =
        await getStoredAction(
          idempotencyKey,
          { provider },
        );

      if (
        existing &&
        sameRequest(
          existing,
          action,
        )
      ) {
        return respondAdminAction(
          res,
          context,
          ROUTE,
          200,
          {
            replayed: true,
            action:
              publicAdminAction(
                existing,
              ),
          },
          authorization.userId,
        );
      }

      return respondAdminAction(
        res,
        context,
        ROUTE,
        409,
        {
          error:
            'IDEMPOTENCY_KEY_REUSED',
        },
        authorization.userId,
      );
    }

    return respondAdminAction(
      res,
      context,
      ROUTE,
      201,
      {
        replayed: false,
        action:
          publicAdminAction(action),
      },
      authorization.userId,
    );
  } catch (error) {
    const mapped =
      mapAdminActionError(error);

    return respondAdminAction(
      res,
      context,
      ROUTE,
      mapped.status,
      { error: mapped.code },
      authorization?.userId,
    );
  }
}

function sameRequest(
  existing,
  expected,
) {
  const fields = [
    'actionId',
    'actionType',
    'targetKind',
    'targetId',
    'desiredState',
    'reason',
    'dataEnvironment',
    'actorUserId',
  ];

  return fields.every(
    field =>
      existing[field] ===
      expected[field],
  );
}
