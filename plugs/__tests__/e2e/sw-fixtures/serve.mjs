/* Static fixture server for the real-browser service-worker lane (#684).
 *
 * Zero-dependency Node http server (no new package, no Vite transform) serving the
 * `public/` fixtures over http://localhost — the secure-context-equivalent origin a
 * service worker + Background Fetch require. It sends `Service-Worker-Allowed: /` and
 * `Cache-Control: no-store` so `/sw.js` claims root scope and never serves stale.
 *
 * Started by playwright.config.ts as a `webServer` entry; the `chromium-sw` project
 * points its baseURL here. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, 'public');
const PORT = Number(process.env.SW_FIXTURE_PORT) || 3210;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = join(ROOT, normalize(pathname));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    const body = await readFile(file);
    const ext = pathname.slice(pathname.lastIndexOf('.'));
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
      'service-worker-allowed': '/',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[sw-fixture] serving ${ROOT} on http://localhost:${PORT}`);
});
