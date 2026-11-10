import {
  adminEnvironmentConfiguration,
  requiredEnvironment,
} from './_firestore-environment.mjs';
import { gcpOidcAccessToken, gcpOidcConfiguration } from './_gcp-oidc.mjs';

const WAITLIST_COLLECTION = 'pro_waitlist';
const PARTICIPANT_COLLECTION = 'founding_referral_participants';
const REFERRAL_COLLECTIONS = new Set([
  WAITLIST_COLLECTION,
  PARTICIPANT_COLLECTION,
]);

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 50;
const FILTER_SCAN_MULTIPLIER = 4;
const REFERRAL_CAMPAIGN_ID =
  String(process.env.RQS_FOUNDING_REFERRAL_CAMPAIGN_ID || 'founding-2026').trim();

const WAITLIST_PLAN_INTERESTS = new Set(['master', 'plus', 'pro', 'undecided', 'unknown']);
const WAITLIST_STATUSES = new Set(['waiting', 'unknown']);
const WAITLIST_LANGUAGES = new Set(['pt', 'en', 'pl', 'fr', 'unknown']);
const REFERRAL_ATTRIBUTION_STATES = new Set(['true', 'false']);
const PARTICIPANT_STATUSES = new Set(['active', 'unknown']);

const WAITLIST_PROJECTION = [
  'email',
  'plan_interest',
  'status',
  'language',
  'source',
  'createdAt',
  'plan_interest_updated_at',
  'referralCampaignId',
  'referrerParticipantId',
  'referralStatus',
  'referralCapturedAt',
];

const PARTICIPANT_PROJECTION = [
  'campaignId',
  'status',
  'termsVersion',
  'termsAcceptedAt',
  'eligibleFrom',
  'captureEndsAt',
  'createdAt',
  'referralCode',
];

export const REFERRAL_STAGING_DATABASE_ID = 'rqs-referral-staging';
export const REFERRAL_PRODUCTION_DATABASE_ID = 'rqs-referral-preview';

export function referralFirestoreConfiguration() {
  const environment = adminEnvironmentConfiguration();
  const databaseId = requiredEnvironment('GCP_REFERRAL_FIRESTORE_DATABASE_ID');

  if (databaseId !== environment.referralDatabaseId) {
    throw new Error(
      `Configured Referral Firestore database does not match ${environment.dataEnvironment} environment`,
    );
  }

  return {
    databaseId,
    dataEnvironment: environment.dataEnvironment,
  };
}

export function parsePageSize(value) {
  if (value === undefined || value === null || value === '') return PAGE_SIZE_DEFAULT;
  if (Array.isArray(value)) throw new TypeError('Invalid page size');
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) throw new TypeError('Invalid page size');
  const limit = Number(normalized);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX) {
    throw new TypeError(`Page size must be between 1 and ${PAGE_SIZE_MAX}`);
  }
  return limit;
}

export function parseWaitlistFilters(query = {}) {
  return {
    planInterest: optionalAllowlisted(query.planInterest, WAITLIST_PLAN_INTERESTS, 'plan interest'),
    status: optionalAllowlisted(query.status, WAITLIST_STATUSES, 'waitlist status'),
    language: optionalAllowlisted(query.language, WAITLIST_LANGUAGES, 'language'),
    referralAttributed: optionalAllowlisted(
      query.referralAttributed,
      REFERRAL_ATTRIBUTION_STATES,
      'referral-attributed state',
    ),
  };
}

export function parseReferralFilters(query = {}) {
  const campaignId = optionalScalar(query.campaignId, 'campaign id');
  if (campaignId && !/^[a-zA-Z0-9._-]{1,80}$/.test(campaignId)) {
    throw new TypeError('Invalid campaign id');
  }

  return {
    status: optionalAllowlisted(query.status, PARTICIPANT_STATUSES, 'participant status'),
    campaignId,
  };
}

export async function listWaitlistRecords({
  limit = PAGE_SIZE_DEFAULT,
  cursor = null,
  filters = {},
} = {}) {
  assertValidLimit(limit);
  const normalizedFilters = {
    planInterest: optionalAllowlisted(filters.planInterest, WAITLIST_PLAN_INTERESTS, 'plan interest'),
    status: optionalAllowlisted(filters.status, WAITLIST_STATUSES, 'waitlist status'),
    language: optionalAllowlisted(filters.language, WAITLIST_LANGUAGES, 'language'),
    referralAttributed: optionalAllowlisted(
      filters.referralAttributed,
      REFERRAL_ATTRIBUTION_STATES,
      'referral-attributed state',
    ),
  };

  const page = await readFilteredPage({
    collection: WAITLIST_COLLECTION,
    limit,
    cursor,
    projection: WAITLIST_PROJECTION,
    filterActive: Object.values(normalizedFilters).some(value => value !== undefined),
    predicate: document => waitlistMatches(document, normalizedFilters),
  });

  return {
    records: page.documents.map(sanitizeWaitlistDocument),
    nextCursor: page.nextCursor,
  };
}

export async function listReferralParticipants({
  limit = PAGE_SIZE_DEFAULT,
  cursor = null,
  filters = {},
} = {}) {
  assertValidLimit(limit);
  const normalizedFilters = {
    status: optionalAllowlisted(filters.status, PARTICIPANT_STATUSES, 'participant status'),
    campaignId: filters.campaignId ? optionalScalar(filters.campaignId, 'campaign id') : undefined,
  };

  if (
    normalizedFilters.campaignId &&
    !/^[a-zA-Z0-9._-]{1,80}$/.test(normalizedFilters.campaignId)
  ) {
    throw new TypeError('Invalid campaign id');
  }

  const page = await readFilteredPage({
    collection: PARTICIPANT_COLLECTION,
    limit,
    cursor,
    projection: PARTICIPANT_PROJECTION,
    filterActive: Object.values(normalizedFilters).some(value => value !== undefined),
    predicate: document => participantMatches(document, normalizedFilters),
  });

  const records = await Promise.all(
    page.documents.map(async document => {
      const counts = await referralCountsForParticipant(document.id);
      return sanitizeParticipantDocument(document, counts);
    }),
  );

  return {
    records,
    nextCursor: page.nextCursor,
  };
}

export async function referralSummary() {
  const [total, active, attributedWaitlist] = await Promise.all([
    countReferralDocuments(PARTICIPANT_COLLECTION),
    countReferralDocuments(PARTICIPANT_COLLECTION, 'status', 'active'),
    countReferralDocuments(WAITLIST_COLLECTION, 'referralCampaignId', REFERRAL_CAMPAIGN_ID),
  ]);

  return {
    total,
    active,
    attributedWaitlist,
  };
}

export async function referralCountsForParticipant(participantId) {
  const id = typeof participantId === 'string' ? participantId : '';

  // Firestore document IDs are opaque identifiers. Preserve the exact value
  // returned by Firestore instead of assuming a hash format or normalizing it.
  if (!id || Buffer.byteLength(id, 'utf8') > 1500 || id.includes('/')) {
    throw new TypeError('Invalid participant document id');
  }

  const [referredCount, waitlistedCount, pendingPaymentCount, qualifiedCount] =
    await Promise.all([
      countReferralDocuments(WAITLIST_COLLECTION, 'referrerParticipantId', id),
      countReferralDocuments(WAITLIST_COLLECTION, 'referrerParticipantId', id, {
        secondaryField: 'referralStatus',
        secondaryValue: 'waitlisted',
      }),
      countReferralDocuments(WAITLIST_COLLECTION, 'referrerParticipantId', id, {
        secondaryField: 'referralStatus',
        secondaryValue: 'pending_payment',
      }),
      countReferralDocuments(WAITLIST_COLLECTION, 'referrerParticipantId', id, {
        secondaryField: 'referralStatus',
        secondaryValue: 'qualified',
      }),
    ]);

  const pendingCount = waitlistedCount + pendingPaymentCount;
  const discountPercent = Math.min(Math.max(qualifiedCount, 0) * 10, 50);

  return {
    referredCount,
    pendingCount,
    qualifiedCount,
    discountPercent,
  };
}

async function defaultReferralCountProvider(collection, field, value, extra = {}) {
  const { databaseId } = referralFirestoreConfiguration();
  const oidc = gcpOidcConfiguration();
  const structuredQuery = { from: [{ collectionId: collection }] };
  const filters = [];

  if (field !== undefined) {
    filters.push(fieldFilter(field, value));
  }
  if (extra.secondaryField !== undefined) {
    filters.push(fieldFilter(extra.secondaryField, extra.secondaryValue));
  }
  if (filters.length === 1) {
    structuredQuery.where = filters[0];
  } else if (filters.length > 1) {
    structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters,
      },
    };
  }

  const accessToken = await gcpOidcAccessToken(oidc);

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/${oidc.projectId}` +
    `/databases/${databaseId}/documents:runAggregationQuery`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: [{ alias: 'count', count: {} }],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Referral Firestore aggregation failed (${response.status})`);
  }

  const rows = await response.json();
  const encoded = rows.find(
    row => row.result?.aggregateFields?.count,
  )?.result?.aggregateFields?.count;

  return Number(encoded?.integerValue ?? encoded?.doubleValue ?? 0);
}

async function defaultReferralPageProvider({
  collection,
  limit,
  cursor,
  projection,
}) {
  const { databaseId } = referralFirestoreConfiguration();
  const oidc = gcpOidcConfiguration();
  const accessToken = await gcpOidcAccessToken(oidc);
  const cursorName = decodeCursor(cursor, collection, oidc.projectId, databaseId);

  const structuredQuery = {
    select: {
      fields: projection.map(fieldPath => ({ fieldPath })),
    },
    from: [{ collectionId: collection }],
    orderBy: [
      {
        field: { fieldPath: '__name__' },
        direction: 'ASCENDING',
      },
    ],
    limit,
  };

  if (cursorName) {
    structuredQuery.startAt = {
      values: [{ referenceValue: cursorName }],
      before: false,
    };
  }

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/${oidc.projectId}` +
    `/databases/${databaseId}/documents:runQuery`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!response.ok) {
    throw new Error(`Referral Firestore query failed (${response.status})`);
  }

  const rows = await response.json();
  return rows.flatMap(row =>
    row.document
      ? [decodeDocument(row.document)]
      : [],
  );
}

let referralCountProvider = defaultReferralCountProvider;
let referralPageProvider = defaultReferralPageProvider;

export function countReferralDocuments(collection, field, value, extra) {
  assertReferralCollection(collection);
  assertCountFilter(collection, field, extra?.secondaryField);
  return referralCountProvider(collection, field, value, extra);
}

export function setReferralCountProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error('Test-only Referral Firestore override');
  }

  referralCountProvider = provider ?? defaultReferralCountProvider;
}

export function setReferralPageProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error('Test-only Referral Firestore override');
  }

  referralPageProvider = provider ?? defaultReferralPageProvider;
}

async function readFilteredPage({
  collection,
  limit,
  cursor,
  projection,
  filterActive = false,
  predicate,
}) {
  assertReferralCollection(collection);
  const validatedCursor = validateCursorToken(cursor, collection);
  const scanLimit = filterActive
    ? Math.min(PAGE_SIZE_MAX * FILTER_SCAN_MULTIPLIER, limit * FILTER_SCAN_MULTIPLIER)
    : limit + 1;

  let nextReadCursor = validatedCursor;
  let lastScannedName = null;
  const matches = [];
  let remaining = scanLimit;

  while (remaining > 0 && matches.length < limit + 1) {
    const batchSize = Math.min(PAGE_SIZE_MAX, remaining);
    const documents = await referralPageProvider({
      collection,
      limit: batchSize,
      cursor: nextReadCursor,
      projection,
    });

    if (documents.length === 0) break;

    for (const document of documents) {
      lastScannedName = document.__name;
      if (predicate(document)) {
        matches.push(document);
        if (matches.length >= limit + 1) break;
      }
    }

    remaining -= documents.length;

    if (documents.length < batchSize || matches.length >= limit + 1) break;
    nextReadCursor = encodeCursor(collection, lastScannedName);
  }

  const pageDocuments = matches.slice(0, limit);
  const hasMoreMatch = matches.length > limit;
  const nextCursor =
    hasMoreMatch
      ? encodeCursor(collection, pageDocuments.at(-1).__name)
      : remaining === 0 && lastScannedName
        ? encodeCursor(collection, lastScannedName)
        : null;

  return {
    documents: pageDocuments,
    nextCursor,
  };
}

function waitlistMatches(document, filters) {
  const planInterest = normalizeKnown(document.plan_interest, WAITLIST_PLAN_INTERESTS);
  const status = normalizeKnown(document.status, WAITLIST_STATUSES);
  const language = normalizeKnown(document.language, WAITLIST_LANGUAGES);
  const referralAttributed = isReferralAttributed(document);

  return (
    (!filters.planInterest || filters.planInterest === planInterest) &&
    (!filters.status || filters.status === status) &&
    (!filters.language || filters.language === language) &&
    (!filters.referralAttributed ||
      filters.referralAttributed === String(referralAttributed))
  );
}

function participantMatches(document, filters) {
  const status = normalizeKnown(document.status, PARTICIPANT_STATUSES);
  return (
    (!filters.status || filters.status === status) &&
    (!filters.campaignId || filters.campaignId === String(document.campaignId || ''))
  );
}

function sanitizeWaitlistDocument(document) {
  return {
    id: document.id,
    maskedEmail: maskEmail(document.email),
    planInterest: normalizeKnown(document.plan_interest, WAITLIST_PLAN_INTERESTS),
    status: normalizeKnown(document.status, WAITLIST_STATUSES),
    language: normalizeKnown(document.language, WAITLIST_LANGUAGES),
    source: safeText(document.source),
    createdAt: safeTimestamp(document.createdAt),
    planInterestUpdatedAt: safeTimestamp(document.plan_interest_updated_at),
    referralAttributed: isReferralAttributed(document),
    referralStatus: safeText(document.referralStatus, 'none'),
    referralCapturedAt: safeTimestamp(document.referralCapturedAt),
  };
}

function sanitizeParticipantDocument(document, counts) {
  return {
    id: document.id,
    campaignId: safeText(document.campaignId),
    status: normalizeKnown(document.status, PARTICIPANT_STATUSES),
    termsVersion: safeText(document.termsVersion),
    termsAcceptedAt: safeTimestamp(document.termsAcceptedAt),
    eligibleFrom: safeTimestamp(document.eligibleFrom),
    captureEndsAt: safeTimestamp(document.captureEndsAt),
    createdAt: safeTimestamp(document.createdAt),
    maskedReferralCode: maskReferralCode(document.referralCode),
    referredCount: counts.referredCount,
    pendingCount: counts.pendingCount,
    qualifiedCount: counts.qualifiedCount,
    discountPercent: counts.discountPercent,
  };
}

function maskEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator === email.length - 1) return 'UNKNOWN';
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return 'UNKNOWN';
  if (code.length <= 5) return `${code.slice(0, 2)}***`;
  return `${code.slice(0, 3)}***${code.slice(-2)}`;
}

function isReferralAttributed(document) {
  return Boolean(
    document.referralCampaignId ||
    document.referrerParticipantId ||
    document.referralStatus ||
    document.referralCapturedAt,
  );
}

function normalizeKnown(value, allowlist) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized && allowlist.has(normalized) ? normalized : 'unknown';
}

function safeText(value, fallback = 'unknown') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function safeTimestamp(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function assertValidLimit(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX) {
    throw new TypeError(`Page size must be between 1 and ${PAGE_SIZE_MAX}`);
  }
}

function optionalAllowlisted(value, allowlist, label) {
  const normalized = optionalScalar(value, label);
  if (!normalized) return undefined;
  const lower = normalized.toLowerCase();
  if (!allowlist.has(lower)) throw new TypeError(`Invalid ${label}`);
  return lower;
}

function optionalScalar(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) throw new TypeError(`Invalid ${label}`);
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 100) throw new TypeError(`Invalid ${label}`);
  return normalized;
}

function fieldFilter(fieldPath, value) {
  return {
    fieldFilter: {
      field: { fieldPath },
      op: 'EQUAL',
      value: encodeValue(value),
    },
  };
}

function encodeValue(value) {
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

function assertReferralCollection(collection) {
  if (!REFERRAL_COLLECTIONS.has(collection)) {
    throw new Error('Referral collection is not allowed');
  }
}

function assertCountFilter(collection, field, secondaryField) {
  if (field === undefined && secondaryField === undefined) return;

  const allowed =
    collection === WAITLIST_COLLECTION
      ? new Set([
          'plan_interest',
          'language',
          'referralCampaignId',
          'referrerParticipantId',
          'referralStatus',
        ])
      : new Set(['status', 'campaignId']);

  for (const candidate of [field, secondaryField]) {
    if (candidate !== undefined && !allowed.has(candidate)) {
      throw new Error('Referral filter field is not allowed');
    }
  }
}

function validateCursorToken(cursor, collection) {
  if (!cursor) return null;

  const { databaseId } = referralFirestoreConfiguration();
  const oidc = gcpOidcConfiguration();
  decodeCursor(cursor, collection, oidc.projectId, databaseId);

  return String(cursor).trim();
}

function encodeCursor(collection, documentName) {
  if (!documentName) return null;
  return Buffer.from(
    JSON.stringify({
      v: 1,
      collection,
      name: documentName,
    }),
  ).toString('base64url');
}

function decodeCursor(cursor, collection, projectId, databaseId) {
  if (!cursor) return null;
  if (Array.isArray(cursor)) throw new TypeError('Invalid cursor');
  const encoded = String(cursor).trim();
  if (!/^[A-Za-z0-9_-]{1,2048}$/.test(encoded)) throw new TypeError('Invalid cursor');

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new TypeError('Invalid cursor');
  }

  const prefix =
    `projects/${projectId}/databases/${databaseId}/documents/${collection}/`;

  if (
    decoded?.v !== 1 ||
    decoded?.collection !== collection ||
    typeof decoded?.name !== 'string' ||
    !decoded.name.startsWith(prefix) ||
    decoded.name.slice(prefix.length).includes('/')
  ) {
    throw new TypeError('Invalid cursor');
  }

  return decoded.name;
}

function decodeDocument(document) {
  const values = {};
  for (const [key, encoded] of Object.entries(document.fields || {})) {
    values[key] =
      encoded.stringValue ??
      encoded.timestampValue ??
      encoded.booleanValue ??
      (encoded.integerValue === undefined
        ? encoded.doubleValue
        : Number(encoded.integerValue)) ??
      null;
  }

  return {
    __name: String(document.name || ''),
    id: String(document.name || '').split('/').pop(),
    ...values,
  };
}
