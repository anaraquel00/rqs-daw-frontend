import { createClient } from '@supabase/supabase-js';
import { FIRESTORE_PROJECT_ID } from './_referral-core.mjs';

const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

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

  const production = String(req.headers.host || '').split(':')[0] === 'studio.raquelsynths.com';
  const url = production ? 'https://ucearnthodrltkvkmhit.supabase.co' : 'https://uwrqbywapomuloresoek.supabase.co';
  const key = production
    ? 'sb_publishable_v2YYX5ksPlYxbh2Xf4HwwQ_UEc5NZyR'
    : 'sb_publishable_evTmfCYwvcaPKqwyfEVMGA_kYXQftOX';
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user?.id || !data.user.email ? null : data.user;
}

export async function getDocument(collection, id) {
  const response = await fetch(`${FIRESTORE_ROOT}/${collection}/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return decodeDocument(await response.json());
}

export async function createDocument(collection, id, values) {
  const response = await fetch(`${FIRESTORE_ROOT}/${collection}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(values) }),
  });
  if (response.status === 409) return { created: false, document: await getDocument(collection, id) };
  if (!response.ok) throw new Error(`Firestore create failed (${response.status}): ${await response.text()}`);
  return { created: true, document: decodeDocument(await response.json()) };
}

export async function queryDocuments(collection, field, value) {
  const response = await fetch(`${FIRESTORE_ROOT}:runQuery`, {
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
