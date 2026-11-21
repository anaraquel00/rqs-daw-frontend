const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 50;

const PLAN_FILTERS = new Set([
  'free',
  'master',
  'plus',
  'pro',
  'unknown',
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

export function parseUsagePageSize(value) {
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

export function parseUsageFilters(
  query = {},
) {
  return {
    plan:
      optionalAllowlisted(
        query.plan,
        PLAN_FILTERS,
        'plan',
      ),
  };
}

export async function usageRecords(
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
  };

  const decodedCursor =
    decodeCursor(cursor);

  const raw =
    await rpcProvider(
      client,
      'studio_admin_usage_records',
      {
        p_fetch_limit:
          limit + 1,
        p_cursor_created_at:
          decodedCursor?.createdAt ??
          null,
        p_cursor_ref:
          decodedCursor?.ref ??
          null,
        p_plan:
          normalizedFilters.plan ??
          null,
      },
    );

  if (!Array.isArray(raw)) {
    throw new Error(
      'Invalid usage records response',
    );
  }

  const pageRows =
    raw.slice(0, limit);

  const records =
    pageRows.map(
      sanitizeUsageRecord,
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

export function setUsageRpcProviderForTests(
  provider,
) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error(
      'Test-only usage RPC override',
    );
  }

  rpcProvider =
    provider ??
    defaultRpcProvider;
}

function sanitizeUsageRecord(row) {
  if (
    !row ||
    typeof row !== 'object'
  ) {
    throw new Error(
      'Invalid usage record',
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

    plan:
      knownPlan(
        row.plan,
      ),

    master: {
      used:
        nullableInteger(
          row.master_used,
        ),
      reserved:
        nullableInteger(
          row.master_reserved,
        ),
      limit:
        nullableInteger(
          row.master_limit,
        ),
      remaining:
        nullableInteger(
          row.master_remaining,
        ),
      period:
        nullablePeriod(
          row.master_period,
        ),
      periodKey:
        nullablePeriodKey(
          row.master_period_key,
        ),
      available:
        nullableBoolean(
          row.master_available,
        ),
    },

    pitch: {
      used:
        nullableInteger(
          row.pitch_used,
        ),
      reserved:
        nullableInteger(
          row.pitch_reserved,
        ),
      limit:
        nullableInteger(
          row.pitch_limit,
        ),
      remaining:
        nullableInteger(
          row.pitch_remaining,
        ),
      period:
        nullablePeriod(
          row.pitch_period,
        ),
      periodKey:
        nullablePeriodKey(
          row.pitch_period_key,
        ),
      available:
        nullableBoolean(
          row.pitch_available,
        ),
    },

    build: {
      projects: {
        used:
          nullableInteger(
            row.build_projects_used,
          ),
        limit:
          nullableInteger(
            row.build_projects_limit,
          ),
        remaining:
          nullableInteger(
            row.build_projects_remaining,
          ),
        available:
          nullableBoolean(
            row.build_projects_available,
          ),
      },

      storage: {
        confirmedBytes:
          nullableInteger(
            row.build_storage_confirmed_bytes,
          ),
        reservedBytes:
          nullableInteger(
            row.build_storage_reserved_bytes,
          ),
        usedBytes:
          nullableInteger(
            row.build_storage_used_bytes,
          ),
        limitBytes:
          nullableInteger(
            row.build_storage_limit_bytes,
          ),
        remainingBytes:
          nullableInteger(
            row.build_storage_remaining_bytes,
          ),
        available:
          nullableBoolean(
            row.build_storage_available,
          ),
      },
    },

    uplink: {
      active: {
        used:
          nullableInteger(
            row.uplink_active_used,
          ),
        limit:
          nullableInteger(
            row.uplink_active_limit,
          ),
        remaining:
          nullableInteger(
            row.uplink_active_remaining,
          ),
        unlimited:
          nullableBoolean(
            row.uplink_active_unlimited,
          ),
        available:
          nullableBoolean(
            row.uplink_active_available,
          ),
      },

      clicks: {
        used:
          nullableInteger(
            row.uplink_clicks_used,
          ),
        limit:
          nullableInteger(
            row.uplink_clicks_limit,
          ),
        remaining:
          nullableInteger(
            row.uplink_clicks_remaining,
          ),
        period:
          nullablePeriod(
            row.uplink_clicks_period,
          ),
        periodKey:
          nullablePeriodKey(
            row.uplink_clicks_period_key,
          ),
        available:
          nullableBoolean(
            row.uplink_clicks_available,
          ),
      },
    },
  };
}

function encodeCursor(row) {
  const ref =
    String(
      row?.cursor_ref ?? '',
    )
      .trim()
      .toLowerCase();

  const createdAt =
    String(
      row?.cursor_created_at ?? '',
    ).trim();

  if (
    !/^[0-9a-f]{32}$/
      .test(ref)
  ) {
    throw new Error(
      'Invalid usage cursor reference',
    );
  }

  if (
    !createdAt ||
    Number.isNaN(
      Date.parse(createdAt),
    )
  ) {
    throw new Error(
      'Invalid usage cursor timestamp',
    );
  }

  return Buffer
    .from(
      JSON.stringify({
        v: 1,
        ref,
        createdAt,
      }),
    )
    .toString(
      'base64url',
    );
}

function decodeCursor(cursor) {
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
    typeof decoded?.ref !==
      'string' ||
    typeof decoded?.createdAt !==
      'string' ||
    !/^[0-9a-f]{32}$/
      .test(decoded.ref) ||
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
    ref:
      decoded.ref,
    createdAt:
      decoded.createdAt,
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

function assertLimit(value) {
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

function knownPlan(value) {
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

function safeIdentityRef(value) {
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

function safeMaskedEmail(value) {
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

function nullableInteger(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new Error(
      'Invalid usage value',
    );
  }

  return number;
}

function nullableBoolean(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    value !== true &&
    value !== false
  ) {
    throw new Error(
      'Invalid usage availability',
    );
  }

  return value;
}

function nullablePeriod(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    normalized !== 'lifetime' &&
    normalized !== 'monthly'
  ) {
    throw new Error(
      'Invalid usage period',
    );
  }

  return normalized;
}

function nullablePeriodKey(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    normalized !== 'lifetime' &&
    !/^\d{4}-(0[1-9]|1[0-2])$/
      .test(normalized)
  ) {
    throw new Error(
      'Invalid usage period key',
    );
  }

  return normalized;
}
