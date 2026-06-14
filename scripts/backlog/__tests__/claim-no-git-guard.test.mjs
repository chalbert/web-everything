// Regression guard for backlog #510 / #422: the pre-claim path must NEVER inspect the working tree.
// A `git status --short` truthiness guard treated an untracked (`??`) file as "another session is
// editing this" — but this repo's backlog is globally uncommitted, so a freshly-scaffolded item is `??`
// from birth, making `claim` refuse every brand-new item (a guaranteed false stop, not a real
// concurrency signal). Concurrency is owned by the status transition (`claim` only succeeds from `open`)
// + the reservation soft-holds (#083), so `claim` must not shell out to git at all. This test pins that:
// any reintroduction of a child_process/git dirty-or-untracked check in backlog.mjs fails here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../../backlog.mjs'), 'utf8');

describe('backlog.mjs claim path never inspects the working tree (#510)', () => {
  it('does not import child_process (no shelling out to git from the status CLI)', () => {
    expect(SRC).not.toMatch(/from\s+['"]node:child_process['"]/);
    expect(SRC).not.toMatch(/\bexecFileSync\b|\bexecSync\b|\bspawnSync\b/);
  });

  it('contains no `git status` dirty/untracked pre-claim guard', () => {
    expect(SRC).not.toMatch(/git['"\s,]+status/);
    expect(SRC).not.toMatch(/\bisDirty\b/);
  });
});
