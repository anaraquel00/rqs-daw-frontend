import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './waitlist.js';
import { emailFingerprint } from './_referral-core.mjs';

const CODE = 'RQSA23456789';

function firestoreDocument(collection, id, fields) {
  return { name: `projects/test/databases/(default)/documents/${collection}/${id}`, fields: Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { stringValue: String(value) }])) };
}

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

async function invoke(body, fetchImpl) {
  process.env.BREVO_API_KEY = 'test-key'; process.env.BREVO_WAITLIST_LIST_ID = '7';
  const originalFetch = globalThis.fetch; globalThis.fetch = fetchImpl;
  const result = { statusCode: 0, body: null };
  const res = { setHeader() {}, status(code) { result.statusCode = code; return this; }, json(value) { result.body = value; return value; }, end() {} };
  try { await handler({ method: 'POST', headers: {}, body }, res); return result; }
  finally { globalThis.fetch = originalFetch; }
}

test('valid referral is embedded in the first waitlist write and survives a Brevo outage', async () => {
  let waitlistWrite;
  const result = await invoke({ email: 'friend@example.com', language: 'fr', referralCode: CODE }, async (url, options = {}) => {
    if (String(url).endsWith(':runQuery')) return response(200, [{ document: firestoreDocument('founding_referral_participants', 'participant-1', { referralCode: CODE, campaignId: 'founding-2026', status: 'active', emailFingerprint: emailFingerprint('owner@example.com') }) }]);
    if (String(url).includes('/pro_waitlist?')) { waitlistWrite = JSON.parse(options.body); return response(200, firestoreDocument('pro_waitlist', 'waitlist-1', {})); }
    if (String(url).includes('api.brevo.com')) return response(503);
    throw new Error(`Unexpected URL ${url}`);
  });
  assert.equal(result.statusCode, 200); assert.equal(result.body.referralAttributed, true);
  assert.equal(result.body.notificationSyncPending, true);
  assert.equal(waitlistWrite.fields.language.stringValue, 'fr');
  assert.equal(waitlistWrite.fields.referrerParticipantId.stringValue, 'participant-1');
});

test('invalid, self and disposable referrals do not create attribution', async () => {
  for (const body of [
    { email: 'friend@example.com', referralCode: 'invalid' },
    { email: 'owner@example.com', referralCode: CODE },
    { email: 'friend@mailinator.com', referralCode: CODE },
  ]) {
    let waitlistWrite;
    const result = await invoke(body, async (url, options = {}) => {
      if (String(url).endsWith(':runQuery')) return response(200, [{ document: firestoreDocument('founding_referral_participants', 'participant-1', { referralCode: CODE, campaignId: 'founding-2026', status: 'active', emailFingerprint: emailFingerprint('owner@example.com') }) }]);
      if (String(url).includes('/pro_waitlist?')) { waitlistWrite = JSON.parse(options.body); return response(200, firestoreDocument('pro_waitlist', 'waitlist-1', {})); }
      if (String(url).includes('api.brevo.com')) return response(200);
      throw new Error(`Unexpected URL ${url}`);
    });
    assert.equal(result.body.referralAttributed, false);
    assert.equal(waitlistWrite.fields.referrerParticipantId, undefined);
  }
});

test('an existing waitlist document is never reassigned by a later referral', async () => {
  const result = await invoke({ email: 'friend@example.com', referralCode: CODE }, async (url) => {
    if (String(url).endsWith(':runQuery')) return response(200, [{ document: firestoreDocument('founding_referral_participants', 'participant-2', { referralCode: CODE, campaignId: 'founding-2026', status: 'active', emailFingerprint: emailFingerprint('owner@example.com') }) }]);
    if (String(url).includes('/pro_waitlist?')) return response(409);
    if (String(url).includes('/pro_waitlist/')) return response(200, firestoreDocument('pro_waitlist', 'waitlist-1', { referrerParticipantId: 'participant-1', referralCode: 'RQSB23456789' }));
    if (String(url).includes('api.brevo.com')) return response(200);
    throw new Error(`Unexpected URL ${url}`);
  });
  assert.equal(result.body.alreadyJoined, true);
  assert.equal(result.body.referralAttributed, false);
});
