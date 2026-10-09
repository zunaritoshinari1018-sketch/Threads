import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.mjs';
import { authorizeBasicRequest } from './auth.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end('{"ok":true}');
    return;
  }
  const auth = authorizeBasicRequest(req.headers.authorization);
  if (auth !== 'disabled' && auth !== 'authorized') {
    const status = auth === 'misconfigured' ? 503 : 401;
    const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (auth === 'unauthorized') headers['WWW-Authenticate'] = 'Basic realm="Layer Research Studio", charset="UTF-8"';
    res.writeHead(status, headers).end(auth === 'misconfigured' ? 'APP_AUTH_REQUIRED is enabled, but APP_USERNAME and APP_PASSWORD must be set.' : 'Authentication required.');
    return;
  }
  if (pathname.startsWith('/api/')) return handleApi(req, res);
  let requestedPath;
  try { requestedPath = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, ''); }
  catch { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request'); return; }
  const filePath = path.resolve(DIST, requestedPath);
  const relative = path.relative(DIST, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
    return;
  }
  let file = filePath;
  try {
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    const content = await fs.promises.readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found. Run npm run build first.');
  }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '0.0.0.0', () => console.log(`Layer Research Studio listening on 0.0.0.0:${port}`));
