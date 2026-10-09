import { timingSafeEqual } from 'node:crypto';

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizeBasicRequest(header, environment = process.env) {
  if (environment.APP_AUTH_REQUIRED !== 'true') return 'disabled';
  if (!environment.APP_USERNAME || !environment.APP_PASSWORD) return 'misconfigured';
  if (typeof header !== 'string') return 'unauthorized';
  const match = header.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return 'unauthorized';

  let decoded;
  try { decoded = Buffer.from(match[1], 'base64').toString('utf8'); } catch { return 'unauthorized'; }
  const separator = decoded.indexOf(':');
  if (separator < 0) return 'unauthorized';

  const usernameOk = constantTimeEqual(decoded.slice(0, separator), environment.APP_USERNAME);
  const passwordOk = constantTimeEqual(decoded.slice(separator + 1), environment.APP_PASSWORD);
  return usernameOk && passwordOk ? 'authorized' : 'unauthorized';
}
