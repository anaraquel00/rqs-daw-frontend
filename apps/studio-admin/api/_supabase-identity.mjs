const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 50;

const PLAN_FILTERS = new Set([
  'free',
  'master',
  'plus',
  'pro',
  'unknown',
]);

const STATUS_FILTERS = new Set([
  'active',
  'unconfirmed',
  'banned',
  'deleted',
  'anonymous',
]);

async function defaultRpcProvider(
  client,
  functionName,
  args = {},
) {
  if (
    !client ||
    typeof client.rpc !== 'function'
  ) {
    throw new Error(
      'Supabase RPC client unavailable',
    );
  }

  const { data, error } =
    await client.rpc(
      functionName,
      args,
    );

  if (error) {
    throw new Error(
      'Supabase read-only RPC failed',
    );
  }

  return data;
}

let rpcProvider =
  defaultRpcProvider;

export function parseIdentityPageSize(
  value,
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return PAGE_SIZE_DEFAULT;
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      'Invalid page size',
    );
  }

  const normalized =
    String(value).trim();

  if (!/^\d+$/.test(normalized)) {
    throw new TypeError(
      'Invalid page size',
    );
  }

  const limit =
    Number(normalized);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > PAGE_SIZE_MAX
  ) {
    throw new TypeError(
      `Page size must be between 1 and ${PAGE_SIZE_MAX}`,
    );
  }

  return limit;
}

export function parseIdentityFilters(
  query = {},
) {
  return {
    plan:
      optionalAllowlisted(
        query.plan,
        PLAN_FILTERS,
        'plan',
      ),
    status:
      optionalAllowlisted(
        query.status,
        STATUS_FILTERS,
        'status',
      ),
  };
}

export async function identitySummary(
  client,
) {
  const raw =
    await rpcProvider(
      client,
      'studio_admin_identity_summary',
    );

  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw)
  ) {
    throw new Error(
      'Invalid identity summary response',
    );
  }

  return {
    totalUsers:
      nonNegativeInteger(
        raw.totalUsers,
        'total users',
      ),
    activeUsers:
      nonNegativeInteger(
        raw.activeUsers,
        'active users',
      ),
    confirmedUsers:
      nonNegativeInteger(
        raw.confirmedUsers,
        'confirmed users',
      ),
    unconfirmedUsers:
      nonNegativeInteger(
        raw.unconfirmedUsers,
        'unconfirmed users',
      ),
    authWithoutProfile:
      nonNegativeInteger(
        raw.authWithoutProfile,
        'auth without profile',
      ),
    profilesWithoutAuth:
      nonNegativeInteger(
        raw.profilesWithoutAuth,
        'profiles without auth',
      ),
    byPlan:
      normalizePlanBreakdown(
        raw.byPlan,
      ),
  };
}

export async function identityRecords(
  client,
  {
    limit = PAGE_SIZE_DEFAULT,
    cursor = null,
    filters = {},
  } = {},
) {
  assertLimit(limit);

  const normalizedFilters = {
    plan:
      optionalAllowlisted(
        filters.plan,
        PLAN_FILTERS,
        'plan',
      ),
    status:
      optionalAllowlisted(
        filters.status,
        STATUS_FILTERS,
        'status',
      ),
  };

  const decodedCursor =
    decodeCursor(cursor);

  const raw =
    await rpcProvider(
      client,
      'studio_admin_identity_records',
      {
        p_fetch_limit:
          limit + 1,
        p_cursor_created_at:
          decodedCursor?.createdAt ??
          null,
        p_cursor_id:
          decodedCursor?.id ??
          null,
        p_plan:
          normalizedFilters.plan ??
          null,
        p_status:
          normalizedFilters.status ??
          null,
      },
    );

  if (!Array.isArray(raw)) {
    throw new Error(
      'Invalid identity records response',
    );
  }

  const pageRows =
    raw.slice(0, limit);

  const records =
    pageRows.map(
      sanitizeIdentityRecord,
    );

  const nextCursor =
    raw.length > limit &&
    pageRows.length > 0
      ? encodeCursor(
          pageRows.at(-1),
        )
      : null;

  return {
    records,
    nextCursor,
  };
}

export async function entitlementCatalog(
  client,
) {
  const raw =
    await rpcProvider(
      client,
      'studio_admin_entitlement_catalog',
    );

  if (!Array.isArray(raw)) {
    throw new Error(
      'Invalid entitlement catalog response',
    );
  }

  return raw.map(
    row => ({
      plan:
        knownPlan(row.plan),
      period:
        safeText(row.period),
      fullMasterLimit:
        positiveInteger(
          row.full_master_limit,
          'full master limit',
        ),
      spotifyPitchLimit:
        positiveInteger(
          row.spotify_pitch_limit,
          'Spotify Pitch limit',
        ),
      buildProjectLimit:
        positiveInteger(
          row.build_project_limit,
          'BUILD project limit',
        ),
      buildStorageBytesLimit:
        positiveInteger(
          row.build_storage_bytes_limit,
          'BUILD storage limit',
        ),
    }),
  );
}

export function setSupabaseIdentityRpcProviderForTests(
  provider,
) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error(
      'Test-only Supabase identity RPC override',
    );
  }

  rpcProvider =
    provider ??
    defaultRpcProvider;
}

function sanitizeIdentityRecord(
  row,
) {
  if (
    !row ||
    typeof row !== 'object'
  ) {
    throw new Error(
      'Invalid identity record',
    );
  }

  return {
    identityRef:
      safeIdentityRef(
        row.identity_ref,
      ),
    maskedEmail:
      safeMaskedEmail(
        row.masked_email,
      ),
    authStatus:
      knownStatus(
        row.auth_status,
      ),
    provider:
      safeText(
        row.provider,
      ),
    plan:
      knownPlan(
        row.plan,
      ),
    createdAt:
      nullableTimestamp(
        row.created_at,
      ),
    lastSignInAt:
      nullableTimestamp(
        row.last_sign_in_at,
      ),
    entitlements: {
      fullMasterLimit:
        nullablePositiveInteger(
          row.full_master_limit,
        ),
      spotifyPitchLimit:
        nullablePositiveInteger(
          row.spotify_pitch_limit,
        ),
      buildProjectLimit:
        nullablePositiveInteger(
          row.build_project_limit,
        ),
      buildStorageBytesLimit:
        nullablePositiveInteger(
          row.build_storage_bytes_limit,
        ),
    },
  };
}

function encodeCursor(
  row,
) {
  const id =
    String(
      row?.cursor_id || '',
    ).trim();

  const createdAt =
    String(
      row?.cursor_created_at || '',
    ).trim();

  assertUuid(
    id,
    'cursor id',
  );

  if (
    !createdAt ||
    Number.isNaN(
      Date.parse(createdAt),
    )
  ) {
    throw new Error(
      'Invalid cursor timestamp',
    );
  }

  return Buffer
    .from(
      JSON.stringify({
        v: 1,
        id,
        createdAt,
      }),
    )
    .toString(
      'base64url',
    );
}

function decodeCursor(
  cursor,
) {
  if (!cursor) return null;

  if (Array.isArray(cursor)) {
    throw new TypeError(
      'Invalid cursor',
    );
  }

  const encoded =
    String(cursor).trim();

  if (
    !/^[A-Za-z0-9_-]{1,2048}$/
      .test(encoded)
  ) {
    throw new TypeError(
      'Invalid cursor',
    );
  }

  let decoded;

  try {
    decoded =
      JSON.parse(
        Buffer
          .from(
            encoded,
            'base64url',
          )
          .toString(
            'utf8',
          ),
      );
  } catch {
    throw new TypeError(
      'Invalid cursor',
    );
  }

  if (
    decoded?.v !== 1 ||
    typeof decoded?.id !==
      'string' ||
    typeof decoded?.createdAt !==
      'string'
  ) {
    throw new TypeError(
      'Invalid cursor',
    );
  }

  assertUuid(
    decoded.id,
    'cursor id',
  );

  if (
    Number.isNaN(
      Date.parse(
        decoded.createdAt,
      ),
    )
  ) {
    throw new TypeError(
      'Invalid cursor',
    );
  }

  return {
    id: decoded.id,
    createdAt:
      decoded.createdAt,
  };
}

function normalizePlanBreakdown(
  value,
) {
  const source =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value
      : {};

  return {
    free:
      nonNegativeInteger(
        source.free,
        'free plan count',
      ),
    master:
      nonNegativeInteger(
        source.master,
        'master plan count',
      ),
    plus:
      nonNegativeInteger(
        source.plus,
        'plus plan count',
      ),
    pro:
      nonNegativeInteger(
        source.pro,
        'pro plan count',
      ),
    unknown:
      nonNegativeInteger(
        source.unknown,
        'unknown plan count',
      ),
  };
}

function optionalAllowlisted(
  value,
  allowlist,
  label,
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      `Invalid ${label}`,
    );
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    !allowlist.has(
      normalized,
    )
  ) {
    throw new TypeError(
      `Invalid ${label}`,
    );
  }

  return normalized;
}

function assertLimit(
  value,
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > PAGE_SIZE_MAX
  ) {
    throw new TypeError(
      `Page size must be between 1 and ${PAGE_SIZE_MAX}`,
    );
  }
}

function knownPlan(
  value,
) {
  const normalized =
    String(value ?? '')
      .trim()
      .toLowerCase();

  return PLAN_FILTERS.has(
    normalized,
  )
    ? normalized
    : 'unknown';
}

function knownStatus(
  value,
) {
  const normalized =
    String(value ?? '')
      .trim()
      .toLowerCase();

  return STATUS_FILTERS.has(
    normalized,
  )
    ? normalized
    : 'unconfirmed';
}

function safeText(
  value,
) {
  const normalized =
    String(value ?? '')
      .trim();

  return normalized ||
    'unknown';
}

function safeIdentityRef(
  value,
) {
  const normalized =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (
    !/^[0-9a-f]{12}$/
      .test(normalized)
  ) {
    throw new Error(
      'Invalid identity reference',
    );
  }

  return normalized;
}

function safeMaskedEmail(
  value,
) {
  const normalized =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (
    normalized === 'unknown'
  ) {
    return 'UNKNOWN';
  }

  if (
    !/^[^@\s]+@[^@\s]+$/
      .test(normalized) ||
    !normalized.includes('*')
  ) {
    throw new Error(
      'Invalid masked email',
    );
  }

  return normalized;
}

function nullableTimestamp(
  value,
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  if (
    Number.isNaN(
      Date.parse(normalized),
    )
  ) {
    throw new Error(
      'Invalid timestamp',
    );
  }

  return normalized;
}

function nonNegativeInteger(
  value,
  label,
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new Error(
      `Invalid ${label}`,
    );
  }

  return number;
}

function positiveInteger(
  value,
  label,
) {
  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number <= 0
  ) {
    throw new Error(
      `Invalid ${label}`,
    );
  }

  return number;
}

function nullablePositiveInteger(
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return positiveInteger(
    value,
    'entitlement limit',
  );
}
