import { authorizeOwner } from '../../_auth.mjs';

import {
  assertAdminActionsEnabled,
  completeReviewFlagAction,
  confirmReviewFlagAction,
  publicAdminAction,
} from '../../_admin-actions.mjs';

import {
  getStoredAction,
  persistActionTransition,
  persistExecutedReviewFlag,
} from '../../_admin-action-store.mjs';

import {
  adminActionRuntimeProvider,
} from '../../_admin-action-runtime.mjs';

import {
  deriveIdempotencyUuid,
  mapAdminActionError,
  prepareAdminMutationRequest,
  requireActionReferenceBody,
  requireIdempotencyKey,
  requireJsonRequest,
  respondAdminAction,
} from '../../_admin-action-http.mjs';

const ROUTE =
  '/api/admin/actions/confirm';

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

    const actionId =
      requireActionReferenceBody(
        body,
      );

    const idempotencyKey =
      requireIdempotencyKey(req);

    const provider =
      adminActionRuntimeProvider();

    let current =
      await getStoredAction(
        actionId,
        { provider },
      );

    if (
      !current ||
      current.actorUserId !==
        authorization.userId
    ) {
      return respondAdminAction(
        res,
        context,
        ROUTE,
        404,
        {
          error:
            'ACTION_NOT_FOUND',
        },
        authorization.userId,
      );
    }

    if (
      current.status === 'executed' &&
      current.confirmationIdempotencyKey ===
        idempotencyKey
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
              current,
            ),
        },
        authorization.userId,
      );
    }

    if (
      current.status === 'expired' &&
      current.confirmationIdempotencyKey ===
        idempotencyKey
    ) {
      return respondAdminAction(
        res,
        context,
        ROUTE,
        409,
        {
          error:
            'ACTION_EXPIRED',
        },
        authorization.userId,
      );
    }

    let executing;

    if (
      current.status ===
        'executing' &&
      current.confirmationIdempotencyKey ===
        idempotencyKey
    ) {
      executing = current;
    } else if (
      current.status ===
        'pending_confirmation'
    ) {
      const transition =
        confirmReviewFlagAction(
          current,
        );

      const transitioned = {
        ...transition,
        confirmationIdempotencyKey:
          idempotencyKey,
      };

      if (
        transitioned.status ===
        'expired'
      ) {
        await persistActionTransition(
          transitioned,
          {
            provider,
            eventId:
              deriveIdempotencyUuid(
                idempotencyKey,
                'expire',
              ),
          },
        );

        return respondAdminAction(
          res,
          context,
          ROUTE,
          409,
          {
            error:
              'ACTION_EXPIRED',
          },
          authorization.userId,
        );
      }

      try {
        await persistActionTransition(
          transitioned,
          {
            provider,
            eventId:
              deriveIdempotencyUuid(
                idempotencyKey,
                'confirm',
              ),
          },
        );

        executing = transitioned;
      } catch (error) {
        if (
          error?.code !==
            'ACTION_STORE_CONFLICT'
        ) {
          throw error;
        }

        current =
          await getStoredAction(
            actionId,
            { provider },
          );

        if (
          current?.status ===
            'executing' &&
          current
            .confirmationIdempotencyKey ===
            idempotencyKey
        ) {
          executing = current;
        } else if (
          current?.status ===
            'executed' &&
          current
            .confirmationIdempotencyKey ===
            idempotencyKey
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
                  current,
                ),
            },
            authorization.userId,
          );
        } else {
          throw error;
        }
      }
    } else {
      return respondAdminAction(
        res,
        context,
        ROUTE,
        409,
        {
          error:
            'ACTION_CONFLICT',
        },
        authorization.userId,
      );
    }

    const executed =
      completeReviewFlagAction(
        executing,
      );

    try {
      await persistExecutedReviewFlag(
        executed,
        {
          provider,
          eventId:
            deriveIdempotencyUuid(
              idempotencyKey,
              'execute',
            ),
        },
      );
    } catch (error) {
      if (
        error?.code ===
          'ACTION_STORE_CONFLICT'
      ) {
        const latest =
          await getStoredAction(
            actionId,
            { provider },
          );

        if (
          latest?.status ===
            'executed' &&
          latest
            .confirmationIdempotencyKey ===
            idempotencyKey
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
                  latest,
                ),
            },
            authorization.userId,
          );
        }
      }

      throw error;
    }

    return respondAdminAction(
      res,
      context,
      ROUTE,
      200,
      {
        replayed: false,
        action:
          publicAdminAction(
            executed,
          ),
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
