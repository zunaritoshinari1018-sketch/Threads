import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeBasicRequest } from '../server/auth.mjs';

const protectedConfig = { APP_AUTH_REQUIRED: 'true', APP_USERNAME: 'owner', APP_PASSWORD: 'not-a-real-deploy-password' };
const validHeader = `Basic ${Buffer.from(`${protectedConfig.APP_USERNAME}:${protectedConfig.APP_PASSWORD}`).toString('base64')}`;

test('production Basic Auth accepts only the configured username and password', () => {
  assert.equal(authorizeBasicRequest(validHeader, protectedConfig), 'authorized');
  assert.equal(authorizeBasicRequest(undefined, protectedConfig), 'unauthorized');
  assert.equal(authorizeBasicRequest('Bearer token', protectedConfig), 'unauthorized');
  assert.equal(authorizeBasicRequest(`Basic ${Buffer.from('owner:wrong').toString('base64')}`, protectedConfig), 'unauthorized');
});

test('required authentication fails closed when the deployment secret is missing', () => {
  assert.equal(authorizeBasicRequest(validHeader, { APP_AUTH_REQUIRED: 'true', APP_USERNAME: 'owner' }), 'misconfigured');
  assert.equal(authorizeBasicRequest(validHeader, { APP_AUTH_REQUIRED: 'true', APP_PASSWORD: 'secret' }), 'misconfigured');
});

test('local development remains accessible unless deployment auth is explicitly enabled', () => {
  assert.equal(authorizeBasicRequest(undefined, {}), 'disabled');
  assert.equal(authorizeBasicRequest(undefined, { APP_AUTH_REQUIRED: 'false' }), 'disabled');
});
