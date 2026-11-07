import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, countDocuments, getDocument, updateDocument } from './_referral-http.mjs';

process.env.GCP_FIRESTORE_DATABASE_ID = 'rqs-referral-preview';

const emulatorTest = process.env.FIRESTORE_EMULATOR_HOST ? test : test.skip;

emulatorTest('Firestore emulator preserves referral fields across idempotent plan updates', async () => {
  const id = `emulator-${Date.now()}`;
  const created = await createDocument('pro_waitlist', id, {
    email: 'emulator@example.invalid',
    status: 'waiting',
    plan_interest: 'master',
    referralCode: 'RQSA23456789',
    referrerParticipantId: 'participant-1',
  });
  assert.equal(created.created, true);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const updated = await updateDocument('pro_waitlist', id, {
      plan_interest: 'pro',
      plan_interest_updated_at: new Date('2026-11-07T12:00:00Z'),
    });
    assert.equal(updated.plan_interest, 'pro');
  }

  const persisted = await getDocument('pro_waitlist', id);
  assert.equal(persisted.plan_interest, 'pro');
  assert.equal(persisted.referralCode, 'RQSA23456789');
  assert.equal(persisted.referrerParticipantId, 'participant-1');
  assert.ok(await countDocuments('pro_waitlist', 'plan_interest', 'pro') >= 1);
});
