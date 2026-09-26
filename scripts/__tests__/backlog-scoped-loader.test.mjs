/**
 * #4166 — `src/_data/backlog.js` gains a SCOPED entry point (`loadBacklogScoped`) that
 * `scripts/check-standards.mjs` uses under `--local --files=` instead of parsing the whole ~4.1k-item
 * corpus. This pins two things a source-anchor test can't: (1) the DEFAULT export's behavior is byte-
 * identical to before this card (still the full corpus — the site build and every other consumer are
 * unaffected); (2) `loadBacklogScoped(fileNames)` genuinely narrows the parse to just those files, through
 * the SAME per-item pipeline (a resolved `blockedBy` target is still a real, linked item — not a stub —
 * when its own file is included in the given list).
 *
 * Runs the loader in a CHILD process with `WE_BACKLOG_DIR` pointed at a throwaway fixture corpus:
 * `src/_data/backlog.js` resolves `BACKLOG_DIR` ONCE at module load (see `src/_data/__tests__/frozen-
 * backlog.test.ts`'s own note on this), so a same-process re-require with a different env would silently
 * keep reading the FIRST corpus — a child process is the only way to control which corpus each load sees.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BACKLOG_JS = join(ROOT, 'src/_data/backlog.js');

const card = (id, blockedBy) =>
  `---\nkind: story\nsize: 1\nstatus: open\ndateOpened: "2026-01-01"\n`
  + (blockedBy ? `blockedBy: ["${blockedBy}"]\n` : '')
  + `---\n\n# ${id}\n\nbody text for ${id}.\n`;

/** A three-card fixture corpus: 002 is blocked by 001; 003 has no relation to either. */
function synthCorpus() {
  const dir = mkdtempSync(join(tmpdir(), 'we-scoped-backlog-'));
  writeFileSync(join(dir, '001-alpha.md'), card('001'));
  writeFileSync(join(dir, '002-beta.md'), card('002', '001'));
  writeFileSync(join(dir, '003-gamma.md'), card('003'));
  return dir;
}

function runInChild(dir, scriptBody) {
  const out = execFileSync('node', ['-e', scriptBody], {
    encoding: 'utf8',
    env: { ...process.env, WE_BACKLOG_DIR: dir },
  });
  return JSON.parse(out.trim());
}

describe('src/_data/backlog.js — loadBacklogScoped (#4166)', () => {
  it('the default export still loads the FULL corpus — unchanged default behavior', () => {
    const dir = synthCorpus();
    try {
      const ids = runInChild(dir, `
        const load = require(${JSON.stringify(BACKLOG_JS)});
        console.log(JSON.stringify(load().map((i) => i.id).sort()));
      `);
      expect(ids).toEqual(['001-alpha', '002-beta', '003-gamma']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadBacklogScoped(fileNames) loads ONLY the given files, not the whole corpus', () => {
    const dir = synthCorpus();
    try {
      const ids = runInChild(dir, `
        const load = require(${JSON.stringify(BACKLOG_JS)});
        console.log(JSON.stringify(load.loadBacklogScoped(['002-beta.md']).map((i) => i.id).sort()));
      `);
      expect(ids).toEqual(['002-beta']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('an empty scoped file list returns an empty array (the zero-backlog-touched fast path)', () => {
    const dir = synthCorpus();
    try {
      const ids = runInChild(dir, `
        const load = require(${JSON.stringify(BACKLOG_JS)});
        console.log(JSON.stringify(load.loadBacklogScoped([])));
      `);
      expect(ids).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a scoped blockedBy target resolves to a REAL linked item when its own file is included too', () => {
    const dir = synthCorpus();
    try {
      const result = runInChild(dir, `
        const load = require(${JSON.stringify(BACKLOG_JS)});
        const items = load.loadBacklogScoped(['001-alpha.md', '002-beta.md']);
        const beta = items.find((i) => i.id === '002-beta');
        console.log(JSON.stringify({ blockerNums: beta.blockers.map((b) => b.num), blockerStatuses: beta.blockers.map((b) => b.status) }));
      `);
      // '001' resolves to a REAL item (status 'open'), not the loader's fail-safe 'unresolved-edge' stub —
      // proof the outgoing target's own file, when included, is genuinely parsed, not stubbed.
      expect(result).toEqual({ blockerNums: ['001'], blockerStatuses: ['open'] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
