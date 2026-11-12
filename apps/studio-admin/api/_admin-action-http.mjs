import { createHash } from 'node:crypto';
import {
  completeRequest,
  prepareRequest,
} from './_http.mjs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AdminActionHttpError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'AdminActionHttpError';
    this.status = status;
    this.code = code;
  }
}

export function prepareAdminMutationRequest(
  req,
  res,
) {
  const context = prepareRequest(
    req,
    res,
    'POST, OPTIONS',
  );

  const origin =
    String(req.headers?.origin || '')
      .trim();

  return Object.freeze({
    ...context,
    allowed:
      context.allowed &&
      origin.length > 0,
    originPresent:
      origin.length > 0,
  });
}

export function requireJsonRequest(req) {
  const contentType =
    String(
      req.headers?.['content-type'] || '',
    ).toLowerCase();

  if (
    !contentType.startsWith(
      'application/json',
    )
  ) {
    throw new AdminActionHttpError(
      415,
      'JSON_REQUIRED',
    );
  }

  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new AdminActionHttpError(
      400,
      'INVALID_JSON_BODY',
    );
  }

  return body;
}

export function requireIdempotencyKey(req) {
  const value =
    String(
      req.headers?.[
        'x-idempotency-key'
      ] || '',
    ).trim();

  if (!UUID_PATTERN.test(value)) {
    throw new AdminActionHttpError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
    );
  }

  return value;
}

export function requireActionId(value) {
  if (
    typeof value !== 'string' ||
    !UUID_PATTERN.test(value)
  ) {
    throw new AdminActionHttpError(
      400,
      'INVALID_ACTION_ID',
    );
  }

  return value;
}

export function requireActionReferenceBody(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(
      body,
      'actionId',
    )
  ) {
    throw new AdminActionHttpError(
      400,
      'INVALID_ACTION_REFERENCE',
    );
  }

  return requireActionId(body.actionId);
}

export function deriveIdempotencyUuid(
  source,
  scope,
) {
  if (!UUID_PATTERN.test(source)) {
    throw new AdminActionHttpError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
    );
  }

  if (
    typeof scope !== 'string' ||
    !/^[a-z][a-z0-9._-]{1,31}$/.test(scope)
  ) {
    throw new TypeError(
      'Invalid idempotency scope',
    );
  }

  const hex = createHash('sha256')
    .update(`${scope}\u0000${source}`)
    .digest('hex')
    .slice(0, 32)
    .split('');

  // UUID v5-shaped deterministic identifier.
  hex[12] = '5';

  const variant =
    8 + (
      Number.parseInt(hex[16], 16) % 4
    );

  hex[16] =
    variant.toString(16);

  return [
    hex.slice(0, 8).join(''),
    hex.slice(8, 12).join(''),
    hex.slice(12, 16).join(''),
    hex.slice(16, 20).join(''),
    hex.slice(20, 32).join(''),
  ].join('-');
}

export function respondAdminAction(
  res,
  context,
  route,
  status,
  body,
  userId = null,
) {
  completeRequest(
    context,
    route,
    status,
    userId,
  );

  return res
    .status(status)
    .json(body);
}

export function mapAdminActionError(error) {
  if (
    error instanceof
      AdminActionHttpError
  ) {
    return {
      status: error.status,
      code: error.code,
    };
  }

  switch (error?.code) {
    case 'INVALID_ACTION':
    case 'INVALID_ACTION_STORE_REQUEST':
      return {
        status: 400,
        code: 'INVALID_ACTION',
      };

    case 'ACTION_CONFLICT':
    case 'ACTION_STORE_CONFLICT':
      return {
        status: 409,
        code: 'ACTION_CONFLICT',
      };

    case 'ACTIONS_DISABLED':
    case 'PRODUCTION_ACTIONS_FORBIDDEN':
      return {
        status: 503,
        code: 'ACTIONS_DISABLED',
      };

    case 'ADMIN_ACTION_STORE_PERMISSION_DENIED':
    case 'ADMIN_ACTION_STORE_UNAVAILABLE':
      return {
        status: 503,
        code: 'ACTION_STORE_UNAVAILABLE',
      };

    default:
      return {
        status: 503,
        code: 'ACTION_CONTROL_UNAVAILABLE',
      };
  }
}
