// Regression guard for the backlog-guard.mjs --pre "hand-numbered new file" DENY (#2288/#2323).
//
// New backlog items must be minted via `scaffold`, which assigns a collision-free hash id (xNNNNNN). An
// agent that hand-authors a file with a numeric NNN- prefix via the Write tool races concurrent sessions
// into a duplicate id. "Is this a Write that CREATES a numeric-prefixed backlog file not yet on disk?" is
// fully script-decidable, so backlog-guard's --pre gate denies it (context-sweep, hookable-vs-judgment #51).
//
// This pins behaviour by spawning the hook with synthetic PreToolUse events. An existing on-disk numeric
// card (Edit or overwrite) and a scaffold-minted xNNNNNN file are the must-allow cases.

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

describe('backlog-guard --pre — hand-numbered new file DENY', () => {
  it('DENIES a Write creating a NEW numeric-NNN backlog file', () => {
    expect(runPre('Write', resolve(BACKLOG_DIR, '99999-hand-picked.md'), { content: GOOD_BODY })).toBe(2);
  });
  it('ALLOWS a Write creating a scaffold-minted xNNNNNN file (good summary)', () => {
    expect(runPre('Write', resolve(BACKLOG_DIR, 'xa1b2c3-minted.md'), { content: GOOD_BODY })).toBe(0);
  });
  it('ALLOWS an Edit of an EXISTING numeric card (not hand-numbering)', () => {
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
