/**
 * #4167 — `check:standards --local` must not just DEMOTE findings a lane can't act on (path-less GLOBAL/
 * RELATIONAL findings, `descriptor.global`-marked ones); it must not COMPUTE them at all under `--local`, since
 * `partitionLocal` (claimScope.mjs) always demotes them to notes regardless. Source-level guard, same style as
 * `check-standards-leash-pin.test.mjs`'s wiring test — running the whole script here would re-run every gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(ROOT, 'scripts', 'check-standards.mjs'), 'utf8');

/** The substring between the FIRST occurrence of `start` and the NEXT occurrence of `end` after it. Throws
 *  (loudly, not a silent empty match) if either anchor is missing — a renamed anchor must fail this test, not
 *  quietly pass on an empty slice. */
function between(text, start, end) {
  const s = text.indexOf(start);
  if (s === -1) throw new Error(`anchor not found: ${JSON.stringify(start)}`);
  const e = text.indexOf(end, s + start.length);
  if (e === -1) throw new Error(`end anchor not found after start: ${JSON.stringify(end)}`);
  return text.slice(s, e);
}

describe('check-standards.mjs — `LOCAL_MODE` is read BEFORE sections run (#4167)', () => {
  it('declares LOCAL_MODE exactly once, at the top of the file — before `errors` is even declared', () => {
    const matches = src.match(/const LOCAL_MODE = process\.argv\.includes\('--local'\);/g) || [];
    expect(matches).toHaveLength(1);
    expect(src.indexOf('const LOCAL_MODE =')).toBeLessThan(src.indexOf('const errors = []'));
  });
});

describe('check-standards.mjs — a section whose findings `--local` always demotes skips its own work (#4167)', () => {
  it('the dup-id / stranded-hash / hand-numbered block (path-less, RELATIONAL) is gated', () => {
    const block = between(src, 'every finding in this block is path-less', "Every item's num — for `blockedBy`");
    expect(block).toMatch(/if \(!LOCAL_MODE\) \{/);
    expect(block).toContain('for (const msg of duplicateBacklogNums(backlog)) err(msg);');
    expect(block).toContain('duplicateBornAs(backlog)');
    expect(block).toContain('strandedHashesOnMain(');
    expect(block).toContain('handNumberedNewItems(');
  });

  it('the backlog blockedBy cycle walk (path-less — names the whole cycle, no owning file) is gated', () => {
    const block = between(src, 'Cycle detection over the resolved edges', 'Parent-deadlock guard');
    expect(block).toMatch(/if \(!LOCAL_MODE\) \{/);
    expect(block).toContain("err(`Backlog blockedBy cycle detected: #${cycle}`)");
  });

  it('the AGENTS.md derived-inventory check (unconditionally `global: true`) is gated', () => {
    const block = between(src, 'AGENTS.md inventory must be in sync', '── 8. No compiled artifacts');
    expect(block).toMatch(/if \(!LOCAL_MODE\) \{/);
    expect(block).toContain("kind: 'inventory', file: 'AGENTS.md', global: true");
  });

  it('the leash-pin check (unconditionally `global: true` via its own descriptor() helper) is gated', () => {
    const block = between(src, '17c. Leash pin', '17. Small-file preference');
    expect(block).toMatch(/if \(!LOCAL_MODE\) \{/);
    expect(block).toContain('checkLeashPin({');
    // unchanged wiring the sibling leash-pin test also pins — this change must not touch it.
    expect(block).toContain('for (const e of pin.errors) err(');
    expect(block).toContain('for (const w of pin.warnings) warn(');
  });
});

describe('check-standards.mjs — the default no-flag run is untouched (#4167)', () => {
  it('every #4167 guard is `if (!LOCAL_MODE)` — never `if (LOCAL_MODE)` or a truthiness flip', () => {
    // `LOCAL_MODE` is false with no flag, so `if (!LOCAL_MODE)` runs the section exactly as before (#4167);
    // guard the guard itself — a flipped condition would silently skip these sections on EVERY run instead.
    const guardCount = (src.match(/if \(!LOCAL_MODE\) \{/g) || []).length;
    expect(guardCount).toBeGreaterThanOrEqual(4);
    expect(src).not.toMatch(/if \(LOCAL_MODE\) \{/);
  });
});
