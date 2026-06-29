// Tiny zero-dependency static file server for the interaction test lane (#: deterministic Playwright).
//
// Why a separate server (not the live :3000 dev server the other specs reuse): these specs drive the
// CLIENT-SIDE behaviour of the Prioritisation table (filter pills, sort, the empty-state) over a FIXED
// fixture page, so the run is deterministic and never collides with the user's always-running dev server.
// It serves files relative to the REPO ROOT, so a fixture can `<script src="/src/assets/js/...">` the REAL
// shipped JS — the test guards the actual file, not a copy.
//
// Port: WE_INTERACTION_PORT (default 3137) — deliberately off the dev ports (Vite :3000, 11ty :8080).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // repo root
const PORT = Number(process.env.WE_INTERACTION_PORT) || 3137;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    // Resolve under ROOT and refuse anything that escapes it (path traversal).
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(ROOT, rel);
    if (!filePath.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => console.log(`[interaction] serving ${ROOT} on http://localhost:${PORT}`));
