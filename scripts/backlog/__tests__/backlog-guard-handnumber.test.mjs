// Regression guard for the backlog-guard.mjs --pre "hand-authored new file" DENY (#2288/#2323, widened #3383).
//
// New backlog items must be minted via `scaffold` (or the `scaffold`/`file-item` declared operations), which
// write via `fs` DIRECTLY — never via the Write/Edit tools. That is what makes "is this a Write that CREATES
// a backlog file not yet on disk?" a clean, script-decidable signal for "this bypassed the declared path",
// regardless of what the id looks like (context-sweep, hookable-vs-judgment #51).
//
// WIDENED 2026-09-06 (#3383) from numeric-only to ANY new id shape. The original rule caught only a
// hand-picked NNN (races concurrent sessions into a duplicate id); it did NOT catch a hand-typed `xNNNNNN`
// hash, which cannot collide the same way but is the OTHER real failure mode named live that session: every
// item filed went through a hand-dispatched subagent with a bespoke prompt, not a declared operation. A
// Write tool call creating ANY new backlog file — hash-prefixed or not — is, by construction, not that path.
//
// This pins behaviour by spawning the hook with synthetic PreToolUse events. An existing on-disk card (Edit
// or overwrite, any id shape) is the must-allow case; ANY brand-new file via Write is now a must-deny case.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(here, '../../backlog-guard.mjs');
const BACKLOG_DIR = resolve(here, '../../../backlog');
// a real landed numeric card, for the "edit existing / overwrite existing" allow-cases
const existing = readdirSync(BACKLOG_DIR).find(f => /^\d+-.*\.md$/.test(f));
const GOOD_BODY = `---\nkind: story\n---\nA real prose summary sentence.`;

function runPre(tool_name, file_path, extra = {}) {
  const ev = { tool_name, tool_input: { file_path, ...extra } };
  return spawnSync('node', [HOOK, '--pre'], { input: JSON.stringify(ev), encoding: 'utf8' }).status;
}

describe('backlog-guard --pre — hand-authored new file DENY', () => {
  it('DENIES a Write creating a NEW numeric-NNN backlog file', () => {
    expect(runPre('Write', resolve(BACKLOG_DIR, '99999-hand-picked.md'), { content: GOOD_BODY })).toBe(2);
  });
  it('DENIES a Write creating a NEW hash-prefixed (xNNNNNN) backlog file too (#3383) — scaffold/file-item write via fs, never this tool', () => {
    expect(runPre('Write', resolve(BACKLOG_DIR, 'xa1b2c3-minted.md'), { content: GOOD_BODY })).toBe(2);
  });
  it('ALLOWS an Edit of an EXISTING numeric card (not hand-authoring a new one)', () => {
    expect(existing).toBeTruthy();
    expect(runPre('Edit', resolve(BACKLOG_DIR, existing), { old_string: 'x', new_string: 'x' })).toBe(0);
  });
  it('ALLOWS a Write overwriting an EXISTING numeric card (file already exists)', () => {
    expect(runPre('Write', resolve(BACKLOG_DIR, existing), { content: GOOD_BODY })).toBe(0);
  });
  it('ignores non-backlog paths', () => {
    expect(runPre('Write', resolve(BACKLOG_DIR, '../src/whatever.ts'), { content: GOOD_BODY })).toBe(0);
  });
});
