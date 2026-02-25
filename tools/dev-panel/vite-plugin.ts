/**
 * Vite plugin: Dev Panel Bridge to Claude Code.
 *
 * Adds middleware that spawns the Claude CLI in print mode and
 * streams responses as Server-Sent Events. Zero npm dependencies —
 * uses the locally-installed Claude Code binary.
 *
 * Endpoints:
 *   GET  /__dev-panel/health     → { available, binary }
 *   POST /__dev-panel/query      → SSE stream of NDJSON messages
 *   POST /__dev-panel/selection  → writes browser selection to .browser-selection.json
 *   GET  /__dev-panel/selection  → reads current browser selection
 */

import { readdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn, type ChildProcess } from 'child_process';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// ── Binary Discovery ───────────────────────────────────────────

/**
 * Discovers the Claude Code binary on macOS.
 * Searches the managed install directory for the latest version.
 */
function findClaudeBinary(): string | null {
  const searchPaths = [
    // macOS: Claude Desktop managed install
    join(homedir(), 'Library/Application Support/Claude/claude-code'),
    // macOS: VM variant
    join(homedir(), 'Library/Application Support/Claude/claude-code-vm'),
  ];

  for (const baseDir of searchPaths) {
    try {
      const versions = readdirSync(baseDir).sort();
      if (versions.length > 0) {
        return join(baseDir, versions[versions.length - 1], 'claude');
      }
    } catch {
      // Directory doesn't exist, try next
    }
  }

  return null;
}

// ── Request Helpers ────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── SSE Streaming ──────────────────────────────────────────────

function streamClaudeResponse(
  binary: string,
  prompt: string,
  req: IncomingMessage,
  res: ServerResponse,
  sessionId?: string,
) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Remove only CLAUDECODE to avoid nested-session check.
  // Keep other CLAUDE_* vars (they contain auth/config info).
  const env = { ...process.env };
  delete env.CLAUDECODE;

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
  ];

  // Resume previous session for conversation continuity
  if (sessionId) {
    args.push('--resume', sessionId);
  }

  const proc: ChildProcess = spawn(binary, args, {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],  // close stdin — CLI hangs without this
  });

  let buffer = '';

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) console.error('[dev-panel] stderr:', text);
  });

  proc.on('close', (code) => {
    // Flush remaining buffer
    if (buffer.trim()) {
      res.write(`data: ${buffer}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
    res.end();
  });

  proc.on('error', (err) => {
    console.error('[dev-panel] spawn error:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  });

  // Kill child process when client disconnects
  req.on('close', () => {
    if (!proc.killed) {
      proc.kill('SIGTERM');
    }
  });
}

// ── Browser Selection Bridge ──────────────────────────────────────
// Writes browser text selections to a JSON file that Claude Code can read.

const SELECTION_FILE = join(process.cwd(), 'tools', 'dev-panel', '.browser-selection.json');

function readSourceFile(sourceFile: string | undefined): string | null {
  if (!sourceFile) return null;
  try {
    return readFileSync(join(process.cwd(), sourceFile), 'utf-8');
  } catch {
    return null;
  }
}

function writeSelection(data: Record<string, unknown>) {
  // Resolve source file content server-side so agents don't need an extra read
  const sourceContent = readSourceFile(data.sourceFile as string | undefined);
  const enriched = { ...data, sourceContent };
  writeFileSync(SELECTION_FILE, JSON.stringify(enriched, null, 2) + '\n');
}

function readSelection(): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(SELECTION_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

// ── Plugin ─────────────────────────────────────────────────────

export function devPanel(): Plugin {
  const claudeBinary = findClaudeBinary();

  if (claudeBinary) {
    console.log(`[dev-panel] Claude binary found: ${claudeBinary}`);
  } else {
    console.warn('[dev-panel] Claude binary not found — dev panel will be unavailable');
  }

  return {
    name: 'web-everything-dev-panel',

    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void,
      ) => {
        const url = req.url?.split('?')[0] ?? '';

        // Health check
        if (url === '/__dev-panel/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            available: !!claudeBinary,
            binary: claudeBinary,
          }));
          return;
        }

        // Selection write — browser posts selection here
        if (url === '/__dev-panel/selection' && req.method === 'POST') {
          try {
            const body = await readBody(req);
            const data = JSON.parse(body);
            writeSelection({ ...data, timestamp: new Date().toISOString() });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
          }
          return;
        }

        // Selection read — Claude Code reads this
        if (url === '/__dev-panel/selection' && req.method === 'GET') {
          const data = readSelection();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data ?? { text: null }));
          return;
        }

        // Query endpoint
        if (url === '/__dev-panel/query' && req.method === 'POST') {
          if (!claudeBinary) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Claude binary not found. Install Claude Code or set the path manually.',
            }));
            return;
          }

          try {
            const body = await readBody(req);
            const { prompt, sessionId } = JSON.parse(body);

            if (!prompt || typeof prompt !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing or invalid prompt' }));
              return;
            }

            streamClaudeResponse(claudeBinary, prompt, req, res, sessionId);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
          }
          return;
        }

        next();
      });
    },
  };
}
