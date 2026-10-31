import test from 'node:test';
import assert from 'node:assert/strict';
import { authEnvironmentForRequest } from './_referral-http.mjs';

function tokenFor(issuer) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ iss: issuer })}.test-signature`;
}

test('preview functions validate tokens against their allowlisted Supabase issuer', () => {
  const request = { headers: { host: 'feature-example.vercel.app' } };
  assert.equal(authEnvironmentForRequest(request,
    tokenFor('https://ucearnthodrltkvkmhit.supabase.co/auth/v1')), 'production');
  assert.equal(authEnvironmentForRequest(request,
    tokenFor('https://uwrqbywapomuloresoek.supabase.co/auth/v1')), 'preview');
  assert.equal(authEnvironmentForRequest(request, 'malformed'), 'preview');
});

test('production host never routes authentication to the preview project', () => {
  const request = { headers: { host: 'studio.raquelsynths.com' } };
  assert.equal(authEnvironmentForRequest(request,
    tokenFor('https://uwrqbywapomuloresoek.supabase.co/auth/v1')), 'production');
});
