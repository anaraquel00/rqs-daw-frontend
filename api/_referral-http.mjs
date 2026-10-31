import { createClient } from '@supabase/supabase-js';
import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';
import { FIRESTORE_PROJECT_ID } from './_referral-core.mjs';

const REFERRAL_DATABASE_ID = 'rqs-referral-preview';
const REFERRAL_COLLECTIONS = new Set(['pro_waitlist', 'founding_referral_participants']);
const AUTH_ENVIRONMENTS = Object.freeze({
  production: {
    url: 'https://ucearnthodrltkvkmhit.supabase.co',
    key: 'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR',
  },
  preview: {
    url: 'https://uwrqbywapomuloresoek.supabase.co',
    key: 'sb_publishable_evTmfCYwvcaPKqwyfEVMGA_kYXQftOX',
  },
});

export function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  const origin = req.headers.origin;
  const allowed = !origin || /^https:\/\/([a-z0-9-]+\.)?raquelsynths\.com$/i.test(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return allowed;
}

export async function authenticateRequest(req) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;

  const environment = authEnvironmentForRequest(req, token);
  const { url, key } = AUTH_ENVIRONMENTS[environment];
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user?.id || !data.user.email ? null : data.user;
}

export function authEnvironmentForRequest(req, token) {
  const host = String(req.headers.host || '').split(':')[0];
  if (host === 'studio.raquelsynths.com') return 'production';

  // The issuer only selects an allowlisted Supabase project. auth.getUser still
  // performs the authoritative server-side token validation below.
  const issuer = tokenIssuer(token);
  if (issuer === `${AUTH_ENVIRONMENTS.production.url}/auth/v1`) return 'production';
  if (issuer === `${AUTH_ENVIRONMENTS.preview.url}/auth/v1`) return 'preview';
  return 'preview';
}

function tokenIssuer(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return '';
    return String(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).iss || '');
  } catch {
    return '';
  }
}

let firestoreAuthClient;
let firestoreAccessTokenProvider = async () => {
  const client = getFirestoreAuthClient();
  const credentials = await client.getAccessToken();
  if (!credentials.token) throw new Error('Google access token unavailable');
  return credentials.token;
};

function getFirestoreAuthClient() {
  if (firestoreAuthClient) return firestoreAuthClient;

  const projectId = requiredEnvironment('GCP_PROJECT_ID');
  const projectNumber = requiredEnvironment('GCP_PROJECT_NUMBER');
  const poolId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const serviceAccountEmail = requiredEnvironment('GCP_SERVICE_ACCOUNT_EMAIL');
  const oidcAudience = requiredEnvironment('GCP_AUDIENCE');
  const providerResource = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  if (projectId !== FIRESTORE_PROJECT_ID) throw new Error('Configured GCP project does not match Firestore project');
  if (oidcAudience !== `https:${providerResource}`) throw new Error('Configured GCP audience does not match provider');

  firestoreAuthClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: providerResource,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience: oidcAudience }),
    },
  });
  if (!firestoreAuthClient) throw new Error('Google external account client unavailable');
  return firestoreAuthClient;
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

function assertReferralCollection(collection) {
  if (!REFERRAL_COLLECTIONS.has(collection)) throw new Error('Firestore collection is not allowed');
}

function firestoreRoot() {
  const databaseId = requiredEnvironment('GCP_FIRESTORE_DATABASE_ID');
  if (databaseId !== REFERRAL_DATABASE_ID) throw new Error('Configured Firestore database is not allowed');
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${databaseId}/documents`;
}

async function firestoreFetch(url, options = {}) {
  const accessToken = await firestoreAccessTokenProvider();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...options, headers });
}

export function setFirestoreAccessTokenProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) throw new Error('Test-only Firestore credential override');
  firestoreAccessTokenProvider = provider;
}

export async function getDocument(collection, id) {
  assertReferralCollection(collection);
  const response = await firestoreFetch(`${firestoreRoot()}/${collection}/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return decodeDocument(await response.json());
}

export async function createDocument(collection, id, values) {
  assertReferralCollection(collection);
  const response = await firestoreFetch(`${firestoreRoot()}/${collection}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(values) }),
  });
  if (response.status === 409) return { created: false, document: await getDocument(collection, id) };
  if (!response.ok) throw new Error(`Firestore create failed (${response.status}): ${await response.text()}`);
  return { created: true, document: decodeDocument(await response.json()) };
}

export async function queryDocuments(collection, field, value) {
  assertReferralCollection(collection);
  const response = await firestoreFetch(`${firestoreRoot()}:runQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: {
      field: { fieldPath: field }, op: 'EQUAL', value: encodeValue(value),
    } }, limit: 1000 } }),
  });
  if (!response.ok) throw new Error(`Firestore query failed (${response.status}): ${await response.text()}`);
  return (await response.json()).flatMap(row => row.document ? [decodeDocument(row.document)] : []);
}

function encodeFields(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encodeValue(value)]));
}

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  return { stringValue: String(value) };
}

function decodeDocument(document) {
  const values = {};
  for (const [key, encoded] of Object.entries(document.fields || {})) {
    values[key] = encoded.stringValue ?? encoded.timestampValue ?? encoded.booleanValue ??
      (encoded.integerValue === undefined ? encoded.doubleValue : Number(encoded.integerValue)) ?? null;
  }
  return { id: String(document.name || '').split('/').pop(), ...values };
}
