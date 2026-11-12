import { createHash, randomUUID } from 'node:crypto';

const CANONICAL_ORIGIN = 'https://studio-admin.raquelsynths.com';

export function prepareRequest(req, res, methods = 'GET, OPTIONS') {
  const requestId = requestIdentifier(req);
  const origin = String(req.headers?.origin || '').trim();
  const allowedOrigins = new Set([
    CANONICAL_ORIGIN,
    ...String(process.env.ADMIN_ALLOWED_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  ]);

  const sameOrigin =
    isSameOriginRequest(req, origin);

  const originAllowed =
    !origin ||
    sameOrigin ||
    allowedOrigins.has(origin);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Idempotency-Key',
  );

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  return { allowed: originAllowed, requestId, startedAt: performance.now() };
}

export function completeRequest(context, route, status, adminUserId = null) {
  const entry = {
    requestId: context.requestId,
    route,
    status,
    latencyMs: Math.round(performance.now() - context.startedAt),
    admin: adminUserId ? createHash('sha256').update(adminUserId).digest('hex').slice(0, 12) : undefined,
  };
  console.info(JSON.stringify(entry));
}

function isSameOriginRequest(
  req,
  origin,
) {
  if (!origin) return false;

  const host =
    String(
      req.headers?.host || '',
    )
      .trim()
      .toLowerCase();

  if (!host) return false;

  try {
    const parsed =
      new URL(origin);

    return (
      parsed.protocol === 'https:' &&
      parsed.host.toLowerCase() === host
    );
  } catch {
    return false;
  }
}

function requestIdentifier(req) {
  const provided = String(req.headers?.['x-request-id'] || '').trim();
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(provided) ? provided : randomUUID();
}
