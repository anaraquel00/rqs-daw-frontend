import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './contact.js';

function invoke(body, fetchImpl) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  const result = { body: null, statusCode: 0 };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return value; },
  };
  return handler({ method: 'POST', body }, res)
    .then(() => result)
    .finally(() => { globalThis.fetch = originalFetch; });
}

test('waitlist noop does not bypass the contact endpoint own fail-closed Brevo configuration', async () => {
  const originalEnvironment = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    RQS_CONTACT_EMAIL: process.env.RQS_CONTACT_EMAIL,
    RQS_SENDER_EMAIL: process.env.RQS_SENDER_EMAIL,
    WAITLIST_NOTIFICATION_MODE: process.env.WAITLIST_NOTIFICATION_MODE,
  };
  process.env.WAITLIST_NOTIFICATION_MODE = 'noop';
  delete process.env.BREVO_API_KEY;
  process.env.RQS_CONTACT_EMAIL = 'contact@example.invalid';
  process.env.RQS_SENDER_EMAIL = 'sender@example.invalid';
  let called = false;
  try {
    const result = await invoke({
      name: 'Staging User',
      email: 'staging@example.invalid',
      category: 'support',
      message: 'Isolated staging message',
      language: 'en',
    }, async () => {
      called = true;
      throw new Error('contact must fail before external calls');
    });
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { success: false, error: 'Server configuration error' });
    assert.equal(called, false);
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
