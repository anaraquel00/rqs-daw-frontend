import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './contact.js';

const ENVIRONMENT_NAMES = [
  'BREVO_API_KEY',
  'RQS_CONTACT_EMAIL',
  'RQS_DATA_ENVIRONMENT',
  'RQS_SENDER_EMAIL',
  'VERCEL_ENV',
  'VERCEL_TARGET_ENV',
  'WAITLIST_NOTIFICATION_MODE',
];

const validBody = {
  name: 'Staging User',
  email: 'staging@example.invalid',
  category: 'support',
  message: 'Isolated staging message',
  language: 'en',
};

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

function replaceEnvironment(values) {
  const originalEnvironment = Object.fromEntries(
    ENVIRONMENT_NAMES.map((name) => [name, process.env[name]])
  );
  for (const name of ENVIRONMENT_NAMES) delete process.env[name];
  Object.assign(process.env, values);
  return () => {
    for (const name of ENVIRONMENT_NAMES) delete process.env[name];
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value !== undefined) process.env[name] = value;
    }
  };
}

test('Preview blocks Firestore and Brevo even when commercial credentials are inherited', async () => {
  const restoreEnvironment = replaceEnvironment({
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'preview',
    BREVO_API_KEY: 'test-key',
    RQS_CONTACT_EMAIL: 'contact@example.invalid',
    RQS_SENDER_EMAIL: 'sender@example.invalid',
  });
  let called = false;
  try {
    const result = await invoke(validBody, async () => {
      called = true;
      throw new Error('Preview must fail before external calls');
    });
    assert.equal(result.statusCode, 503);
    assert.deepEqual(result.body, {
      success: false,
      error: 'Contact unavailable in this environment',
    });
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});

test('Staging noop cannot bypass the contact endpoint suppression', async () => {
  const restoreEnvironment = replaceEnvironment({
    RQS_DATA_ENVIRONMENT: 'staging',
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'staging',
    WAITLIST_NOTIFICATION_MODE: 'noop',
  });
  let called = false;
  try {
    const result = await invoke(validBody, async () => {
      called = true;
      throw new Error('Staging must fail before external calls');
    });
    assert.equal(result.statusCode, 503);
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});

test('cross-environment configuration fails closed before external calls', async () => {
  const restoreEnvironment = replaceEnvironment({
    RQS_DATA_ENVIRONMENT: 'production',
    VERCEL_ENV: 'preview',
    VERCEL_TARGET_ENV: 'preview',
    BREVO_API_KEY: 'test-key',
    RQS_CONTACT_EMAIL: 'contact@example.invalid',
    RQS_SENDER_EMAIL: 'sender@example.invalid',
  });
  let called = false;
  try {
    const result = await invoke(validBody, async () => {
      called = true;
      throw new Error('Invalid configuration must fail before external calls');
    });
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { success: false, error: 'Server configuration error' });
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});

test('missing Vercel environment fails closed even when credentials exist', async () => {
  const restoreEnvironment = replaceEnvironment({
    BREVO_API_KEY: 'test-key',
    RQS_CONTACT_EMAIL: 'contact@example.invalid',
    RQS_SENDER_EMAIL: 'sender@example.invalid',
  });
  let called = false;
  try {
    const result = await invoke(validBody, async () => {
      called = true;
      throw new Error('Missing environment must fail before external calls');
    });
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { success: false, error: 'Server configuration error' });
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});

test('Development suppresses contact side effects', async () => {
  const restoreEnvironment = replaceEnvironment({
    VERCEL_ENV: 'development',
    VERCEL_TARGET_ENV: 'development',
  });
  let called = false;
  try {
    const result = await invoke(validBody, async () => {
      called = true;
      throw new Error('Development must fail before external calls');
    });
    assert.equal(result.statusCode, 503);
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});

test('Production preserves Firestore persistence followed by Brevo notification', async () => {
  const restoreEnvironment = replaceEnvironment({
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
    BREVO_API_KEY: 'test-key',
    RQS_CONTACT_EMAIL: 'contact@example.invalid',
    RQS_SENDER_EMAIL: 'sender@example.invalid',
  });
  const calls = [];
  try {
    const result = await invoke(validBody, async (url, options) => {
      calls.push({ url: String(url), method: options?.method });
      if (String(url).includes('firestore.googleapis.com')) {
        return { ok: true };
      }
      if (String(url) === 'https://api.brevo.com/v3/smtp/email') {
        return { ok: true, json: async () => ({ messageId: 'test-message-id' }) };
      }
      throw new Error(`Unexpected external call: ${url}`);
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, {
      success: true,
      notificationSent: true,
      messageId: 'test-message-id',
    });
    assert.deepEqual(calls, [
      {
        url: 'https://firestore.googleapis.com/v1/projects/raquel-synths-platform/databases/(default)/documents/mensagens',
        method: 'POST',
      },
      { url: 'https://api.brevo.com/v3/smtp/email', method: 'POST' },
    ]);
  } finally {
    restoreEnvironment();
  }
});

test('Production with missing credentials fails before external calls', async () => {
  const restoreEnvironment = replaceEnvironment({
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
  });
  let called = false;
  try {
    const result = await invoke(validBody, async () => {
      called = true;
      throw new Error('Missing credentials must fail before external calls');
    });
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { success: false, error: 'Server configuration error' });
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});
