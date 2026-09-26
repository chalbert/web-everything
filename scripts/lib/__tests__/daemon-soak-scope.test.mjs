/**
 * @file daemon-soak-scope.test.mjs — proves `daemon-soak-scope.mjs`'s exported pattern (a) behaves the way
 * `.github/workflows/ci.yml`'s "Does this PR touch daemon code?" grep step intends, and (b) is byte-identical
 * to that step's own embedded pattern, so any future hand-edit to either copy without the other reddens here
 * immediately rather than silently drifting (see that module's header comment for why the two can't literally
 * share one string: ci.yml's step runs as plain bash before `npm ci`, so it cannot `import` this file).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DAEMON_SOAK_SCOPE_SOURCE, DAEMON_SOAK_SCOPE_PATTERN, isDaemonSoakScopePath, touchesDaemonSoakScope } from '../daemon-soak-scope.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CI_YML = join(HERE, '..', '..', '..', '.github', 'workflows', 'ci.yml');

describe('daemon-soak-scope', () => {
  it('matches paths the daemon-soak job is meant to catch', () => {
    expect(isDaemonSoakScopePath('scripts/conveyor/soak/breaks/index.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('skills-src/conveyor/SKILL.md')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/lib/daemon-rebuild.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/lib/gh-app-shim.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/lib/main-staleness.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/lane-pool.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/lane-pool-anything.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/review-set-label.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/operations/reconcile-dispatch.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('scripts/operations/fix-dispatch-cli.mjs')).toBe(true);
    expect(isDaemonSoakScopePath('vitest.soak.config.ts')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(isDaemonSoakScopePath('src/_data/blocks.json')).toBe(false);
    expect(isDaemonSoakScopePath('docs/agent/backlog-workflow.md')).toBe(false);
    expect(isDaemonSoakScopePath('scripts/backlog.mjs')).toBe(false);
    // scripts/review-set-label.mjs is anchored with a trailing $ — a same-prefix sibling must not match.
    expect(isDaemonSoakScopePath('scripts/review-set-label-extra.mjs')).toBe(false);
    // scripts/operations/*dispatch*$ requires the dispatch token AND no further path segment.
    expect(isDaemonSoakScopePath('scripts/operations/dispatch/nested.mjs')).toBe(false);
  });

  it('touchesDaemonSoakScope is true if ANY path in the list matches', () => {
    expect(touchesDaemonSoakScope(['README.md', 'scripts/lib/daemon-rebuild.mjs'])).toBe(true);
    expect(touchesDaemonSoakScope(['README.md', 'package.json'])).toBe(false);
    expect(touchesDaemonSoakScope([])).toBe(false);
    expect(touchesDaemonSoakScope(undefined)).toBe(false);
  });

  it('is byte-identical to the pattern embedded in ci.yml\'s "Does this PR touch daemon code?" step', () => {
    const ciYml = readFileSync(CI_YML, 'utf8');
    const m = /grep -E '(\^\(skills-src\/conveyor.*?\))'/.exec(ciYml);
    expect(m, 'expected to find the daemon-soak scope grep -E pattern in ci.yml — has that step moved or been reworded?').toBeTruthy();
    expect(m[1]).toBe(DAEMON_SOAK_SCOPE_SOURCE);
  });

  it('DAEMON_SOAK_SCOPE_PATTERN is constructed from DAEMON_SOAK_SCOPE_SOURCE', () => {
    // `.source` escapes `/` to `\/` (the spec's EscapeRegExpPattern, so the source could round-trip inside a
    // `/…/` literal) — compare against a freshly-built RegExp's `.source`, not the raw string, to avoid a false
    // mismatch on that escaping alone.
    expect(DAEMON_SOAK_SCOPE_PATTERN.source).toBe(new RegExp(DAEMON_SOAK_SCOPE_SOURCE).source);
  });
});
