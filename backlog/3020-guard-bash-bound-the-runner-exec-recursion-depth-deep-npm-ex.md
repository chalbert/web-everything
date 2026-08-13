---
bornAs: x2f9yxc
kind: task
status: open
dateOpened: "2026-08-08"
tags: [gate, footgun]
relatedTo: ["2997", "3002"]
scope:
  - we:scripts/guard-bash.mjs
  - we:scripts/__tests__/guard-bash.test.mjs
scopeRationale: >
  Both gaps this item fixes live entirely in we:scripts/guard-bash.mjs — the unbounded self-recursion
  is isTreeWritingBuildRun's own recursive call (line 423, no depth arg), and the uncontained throw is
  the CLI's `decide(...)` call (line 1616), which sits after (outside) the try/catch at lines
  1586-1615. we:scripts/__tests__/guard-bash.test.mjs is IN because both fixes need new tests: a
  pure-function depth-cap test (direct import, the file's existing pattern for
  isTreeWritingBuildRun/decide — see e.g. lines 393-407, 1107-1123) and a NEW subprocess-spawn test
  for the CLI try/catch (this file has no existing CLI-spawn test for guard-bash — confirmed by grep;
  execFileSync appears only once, at line ~1238, for differential quoted-shell fuzzing, never to
  invoke the guard-bash CLI entrypoint itself).
  ---
  Consumers checked, both ways (an ES-import grep across we:scripts/, plus a subprocess/registration
  grep across we:scripts/, we:.claude/, and the repo manifest): ES importers of we:scripts/guard-bash.mjs
  are we:scripts/__tests__/guard-bash.test.mjs, we:scripts/__tests__/golden-corpus-snapshot.test.mjs
  (imports `decide`), we:scripts/mine-golden-corpus.mjs (imports `decide`), and
  we:scripts/lib/converge-transports.mjs (imports `laneRootFromCwd`, an unrelated pure cwd helper this
  fix does not touch). SUBPROCESS caller: registered as the PreToolUse(Bash) hook at
  we:.claude/settings.json:54 — the harness shells the guard-bash entrypoint directly per Bash call,
  never via an ES import; this is the actual reachability path for both bugs and is exercised by the
  new CLI-spawn test above, not by any existing importer.
  EXCLUDED, considered: we:scripts/golden-corpus/hook-guard-bash/ and its scenario builder inside
  we:scripts/mine-golden-corpus.mjs — the golden corpus's existing 16 spec-derived scenarios are all
  shallow (single-layer) commands; this fix changes decide()'s behavior only on a code path (exec-chain
  depth beyond single digits) no existing fixture exercises, so no fixture needs regenerating and none
  of the corpus's expected values change. A new pinned fixture for this incident would be a
  nice-to-have follow-on, not required by this item's own "Done when", so it is left out of scope here.
  ---
  Overlap with siblings (say so, don't hide it — both are status:open, unbuilt, same locus):
  #2997 (open, task, no size) scopes we:scripts/guard-bash.mjs + we:scripts/__tests__/guard-bash.test.mjs
  too, for a DIFFERENT concern (foreign-lease/lane-ownership denial) — same two files, disjoint functions
  from this item's isTreeWritingBuildRun/CLI-decide() seam, so a textual scope collision but a low real
  merge-collision risk.
  #3002 (open, story, size 5, RULED 2026-08-08 R8, codifiedIn we:docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies)
  scopes the SAME two files for a related but distinct concern: flipping the EXISTING
  NESTED_DEPTH_CAP/NESTED_NODE_CAP caps in `withNestedCommands` (we:scripts/guard-bash.mjs:782-783,
  965-984) from fail-OPEN-on-exhaustion to fail-CLOSED, plus six new unresolved-re-execution deny
  positions. #3002's own "Dependencies" section says: "Related: #3020 already files the
  recursion-depth bound; reconcile with it rather than double-building." This item does NOT touch
  `withNestedCommands` or `NESTED_DEPTH_CAP`/`NESTED_NODE_CAP` — it adds a bound to a THIRD,
  currently-uncapped recursive function (`isTreeWritingBuildRun`) #3002's "What ships" list never
  names, and separately hardens the CLI's `decide()` call site, which #3002 never mentions at all. No
  functional double-build; flagged for the dispatcher because both PRs would edit the same file
  concurrently.
---

# guard-bash: bound the runner-exec recursion depth — deep `npm exec` nesting throws and fails the hook OPEN

`we:scripts/guard-bash.mjs#isTreeWritingBuildRun` recurses once per `exec`/`dlx` layer with no depth
cap, and `decide()` is called from the CLI *outside* the try/catch. A deeply nested command therefore
blows the JS stack, the hook exits 1 with no deny on stdout, and the command is allowed — where main
denies it.

## The bug

Two independent halves, both in `we:scripts/guard-bash.mjs`:

1. **Unbounded recursion.** Each `npm exec …` layer re-enters `isTreeWritingBuildRun` on the
   remainder. Nothing caps the depth, and each layer re-scans the whole remaining string, so the
   work is quadratic in the nesting depth. At depth ≈5000 (`npm exec ` repeated — about a 45 KB
   command line) `decide()` throws `RangeError: Maximum call stack size exceeded`.
2. **The throw is not contained.** The CLI's `try { … } catch { process.exit(0); }` wraps only the
   payload parse and cwd/lease resolution. `decide()` runs after it, so an exception there is an
   unhandled rejection: exit code 1, empty stdout, no `permissionDecision` — i.e. fail-OPEN.

## Why it is filed separately, not folded into PR #1092

Found during the #2986/#2994 review-r2 fix (PR #1092, `lane/guard-false-denies`). The trigger is a
~45 KB pathological string no honest agent produces, and the recursion rewrite that PR needed for
BLOCKER 2 does not create the problem — it inherits it from the first `RUNNER_EXEC` cut. Growing that
PR for a synthetic input was the worse trade.

## Confirmed still live (2026-08-13, against this lane's `main`)

Re-verified by importing `isTreeWritingBuildRun`/`decide` directly and calling them, rather than
trusting the original report:

- `isTreeWritingBuildRun('npm exec '.repeat(8000) + 'vite build')` does not throw at that depth in
  this environment (stack-overflow depth is environment/Node-build-dependent — the original report's
  ≈5000 is not reproduced verbatim here), but it IS unbounded and quadratic: 97ms at depth 500,
  1.36s at 2000, 8.9s at 5000, 24.5s at 8000. A PreToolUse hook that takes 24+ seconds (or minutes at
  a somewhat deeper chain, which costs an attacker/buggy-tool nothing extra to construct) is a de
  facto hang on every Bash call, independent of whether it ever throws.
- The full pipeline reproduces the same growth: `decide('npm exec '.repeat(3000) + 'vite build',
  { primaryCwd: true })` returns the primary-tree-write deny reason correctly, but takes 3.19s to do
  it — confirming the unbounded recursion is reachable through the real `decide()` entrypoint (gated
  behind `primaryCwd`, i.e. it fires exactly when an agent runs Bash from the primary checkout — the
  one context this arm exists to protect).
- `we:scripts/guard-bash.mjs:1616` (`const r = decide(cmd, {...});`) is confirmed still outside the
  try/catch at lines 1586-1615, and outside the separate try/catch at lines 1625-1644 (the WARN-nudge
  computation) — an exception from `decide()` is genuinely unhandled today, exactly as filed.
- No existing bound covers this. `we:scripts/guard-bash.mjs`'s OWN general-purpose nested-command
  recursion (`withNestedCommands`, lines 965-984) IS bounded (`NESTED_DEPTH_CAP = 4`,
  `NESTED_NODE_CAP = 64`, lines 782-783) — but that is a *different* function, used only to expand
  `decide()`'s top-level segment list (line 1524). `isTreeWritingBuildRun`'s own direct self-call at
  line 423 does not route through it and carries no bound of its own.

## Design / approach (decided, not a fork)

**The depth-cap-exceeded case is a DENY, not a silent stop — this is not an open design call, it is
already ratified.** `we:docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies` (built
as #3002, ruled 2026-08-08 R8) states the general rule: *"A bounded scanner has exactly three ways to
stop short of an answer — it exhausts its recursion depth bound, it exhausts its expansion-count
bound, or it meets nested text its parser cannot represent — and under this rule all three are
unresolvable, which is a deny, never a pass."* `isTreeWritingBuildRun`, once it gains a depth bound,
becomes exactly "a bounded scanner" in the sense that statute means — so its cap-exceeded branch must
return `true` (tree-writing ⇒ deny), matching the posture #3002 is landing for the OTHER two caps in
this same file. This item is the first place that posture actually ships in code (ahead of #3002's own
build, which is fine — different functions, same statute).

**Two layers, not one, and both are needed:**

1. **A real depth bound on `isTreeWritingBuildRun` itself** (new — today there is none). Converts the
   unbounded-recursion bug into a designed, in-policy DENY decision, reached in well under a second
   instead of tens of seconds or a stack overflow. This is the primary fix and, per the ratified
   statute above, should mean the fail-open path below is essentially never exercised for THIS bug
   again.
2. **A try/catch around the CLI's `decide()` call**, degrading any *unforeseen* exception (a bug in
   this fix, a different arm entirely, a future regression, an environment-specific stack-limit
   quirk) to the file's own already-documented contract for a guard bug: *"Fails open on unparseable
   INPUT ENVELOPE... a guard bug must never wedge the agent"* (`we:scripts/guard-bash.mjs:72-73`).
   This mirrors the two try/catch blocks the CLI section already has (payload-parse,
   `we:scripts/guard-bash.mjs:1586-1615`; nudge computation, `we:scripts/guard-bash.mjs:1625-1644`) —
   it is the established pattern in this exact file, not a new one.

These two layers are complementary: (1) is the fix for the specific bug filed here (deny cleanly,
fast); (2) is the general safety net this file already promises for every OTHER way `decide()` could
someday throw. Shipping only one leaves a real gap — see *Delivery shape*.

## Interface & protocol

**Seam A — `isTreeWritingBuildRun` gains an internal depth parameter (backward-compatible).**
- Current: `export function isTreeWritingBuildRun(segment)` (`we:scripts/guard-bash.mjs:412`); self-recurses
  at `we:scripts/guard-bash.mjs:423` via `return isTreeWritingBuildRun(inv.exec);`.
- New: `export function isTreeWritingBuildRun(segment, depth = 0)`. At entry: `if (depth >
  EXEC_CHAIN_DEPTH_CAP) return true;` (before any parsing — no work is done past the cap). The
  recursive call becomes `return isTreeWritingBuildRun(inv.exec, depth + 1);`.
- New module-level constant, alongside `NESTED_DEPTH_CAP`/`NESTED_NODE_CAP` (`we:scripts/guard-bash.mjs:782-783`):
  `const EXEC_CHAIN_DEPTH_CAP = 8;` — "single digits" per this item's original "Done when"; every real
  runner-alias chain a person or agent writes is 1-3 layers deep, so 8 has generous headroom with no
  realistic false-deny risk.
- Every existing caller passes one argument (`we:scripts/guard-bash.mjs:1067`'s
  `primaryTreeWriteReason`, and every existing test call in `we:scripts/__tests__/guard-bash.test.mjs`)
  — `depth` defaulting to `0` means none of them changes behavior.

**Seam B — the CLI's `decide()` invocation gets a try/catch.**
- Current, `we:scripts/guard-bash.mjs:1616-1621`:
  ```js
  const r = decide(cmd, { primaryCwd, staleBehind, foreignLiveLease, markedLeaseSlug, runInBackground });
  if (r) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Blocked: ' + r },
    }));
  }
  ```
- New: wrap the `decide()` call alone (not the `if (r)` block, which must still run):
  ```js
  let r = null;
  try {
    r = decide(cmd, { primaryCwd, staleBehind, foreignLiveLease, markedLeaseSlug, runInBackground });
  } catch (e) {
    process.stderr.write('guard-bash: internal fault in decide() — degrading to fail-open ALLOW (' + (e && e.message || e) + ')\n');
  }
  ```
- Error surface: on any throw, `r` stays `null` — no `hookSpecificOutput` is written, so the Bash call
  is allowed (indistinguishable on stdout from "nothing to deny"). The stderr line is the only signal;
  PreToolUse hooks don't feed stderr back to the model (same contract the existing nudge try/catch at
  `we:scripts/guard-bash.mjs:1625-1644` already relies on).

**Seam C — new tests in `we:scripts/__tests__/guard-bash.test.mjs`.**
- Pure-function (near the existing `isTreeWritingBuildRun` suite, e.g. lines 393-407 / 1107-1123):
  `isTreeWritingBuildRun('npm exec '.repeat(5000) + 'vite build')` must return `true` and complete in
  well under a second (assert e.g. `<500ms`, generously below the 8.9s this same input takes
  uncapped today). Also assert `decide(sameCmd, { primaryCwd: true })` returns the primary-tree-write
  deny reason (non-null) rather than throwing.
- CLI-level (a genuinely NEW pattern for this file — nothing here spawns the guard-bash subprocess
  today): use `execFileSync('node', [<absolute or relative path to we:scripts/guard-bash.mjs>], {
  input: JSON.stringify({ tool_input: { command: deepCmd }, cwd: '<a primary-looking path>' }),
  encoding: 'utf8' })` and assert exit code `0`, with stdout that is either empty or parses as JSON —
  never a raw stack trace / non-zero exit. This is the only way to prove Seam B actually protects the
  real entrypoint (the pure-function test alone cannot — it never goes through the `IS_CLI` block).

## Tasks

1. Add `EXEC_CHAIN_DEPTH_CAP = 8` near `NESTED_DEPTH_CAP`/`NESTED_NODE_CAP` (`we:scripts/guard-bash.mjs:782-783`).
2. Give `isTreeWritingBuildRun` the `depth = 0` parameter, the cap-exceeded `return true;` at entry,
   and thread `depth + 1` through the recursive call at `we:scripts/guard-bash.mjs:423`.
3. Update the function's own doc comment (`we:scripts/guard-bash.mjs:408-411`) to note the bound and
   cite `#guard-unresolvable-reexecution-denies` / #3002, matching how every other arm in this file
   cites the incident/statute it closes.
4. Wrap the CLI's `decide()` call (`we:scripts/guard-bash.mjs:1616`) in try/catch per Seam B, writing
   the stderr note on catch.
5. Add the pure-function unit tests from Seam C.
6. Add the CLI-subprocess integration test from Seam C.
7. Optionally add one bullet to the file's own top-of-file incident list (`we:scripts/guard-bash.mjs:3-70`)
   documenting this incident, matching the file's existing convention (every arm above has one).
8. Run `npm test` and `npm run check:standards`; both must be green.
9. In the PR body, name the #2997/#3002 scope overlap and non-duplication explicitly (see
   `scopeRationale` above) so the drain/dispatcher and any human reviewer see it up front.

## Delivery shape

Lands as **one PR, both seams together** — not split, and not landable behind a flag. A PreToolUse
hook has no partial-rollout mechanism (it runs synchronously and unconditionally on every Bash call;
there is no kill-switch to gate a "half-shipped" version behind). The two seams are technically
separable, but shipping only one leaves a real gap: Seam A alone still leaves every OTHER exception
source in `decide()`'s many arms wedge-capable (the general "a guard bug must never wedge the agent"
promise the file already makes stays broken everywhere except this one path); Seam B alone still lets
the pathological command burn 8-25+ seconds (or overflow the stack, environment-depending) before
falling into the catch, which is itself the hang this item exists to close. Both are small (a handful
of lines each), touch the same two files, and share the same reviewers/context — splitting them into
two PRs would double this file's historically heavy review-round cost (every prior guard-bash PR
cited in its own header comment needed 2-5 rounds) for no independent value on either half.

## Size

**No `size:` field is set — `kind: task` items are never sized** (`we:docs/agent/backlog-workflow.md`:
*"task — … its points belong to the parent"*; `we:scripts/check-standards-rules.mjs:251-252` hard-errors
`check:standards` if a task carries a `size`). This item has no `parent` (none of its guard-bash
siblings — #2367, #2413, #2749, #2788, #2986, #2994, #2997, #3002's non-parent items — file one
either; there is no "guard-bash hardening" epic in the backlog today), so per the schema its effort is
simply untracked in the burndown, the same as every other item in this file's incident history. `kind:
task` itself reads as correctly chosen: the taxonomy names "a bug fix" as a canonical task example, and
that is exactly what this is — not a standalone deliverable, not a design fork.

For scheduling context only (not written to frontmatter): the work is two small, well-understood,
mechanical changes in one already-hardened file (a new depth parameter + cap constant; a try/catch
around one call site) plus tests, including one genuinely new test pattern (CLI-subprocess spawn) this
file doesn't have yet. Judged against the sizing guide's bands (1 trivial · 2 small · 3 moderate · 5
substantial · 8 large), this reads as roughly a **3** — moderate, not trivial (the new CLI-spawn test
pattern and this file's track record of multi-round review on any change add real but bounded
overhead), and comfortably under the split threshold.

## Done when

- `isTreeWritingBuildRun` bounds its `exec`/`dlx` self-recursion at `EXEC_CHAIN_DEPTH_CAP` (single
  digits); past it, it returns `true` (DENY) rather than recursing further — per
  `#guard-unresolvable-reexecution-denies`, exhausting a bound is unresolvable, never a silent pass.
  **Test:** `isTreeWritingBuildRun('npm exec '.repeat(5000) + 'vite build')` returns `true` and
  completes in well under a second (assert e.g. `<500ms`; it takes 8.9s uncapped today).
- The same pathological command run through `decide(cmd, { primaryCwd: true })` returns the
  primary-tree-write deny reason (non-null), fast, not a throw.
- The CLI's `decide()` invocation (`we:scripts/guard-bash.mjs:1616`) runs inside its own try/catch; on
  any exception the hook still exits `0`, writes nothing to stdout (so the command is allowed — the
  documented fail-open contract for a guard bug), and writes an explicit `guard-bash: …` note to
  stderr. **Test:** a new subprocess-spawn test invoking the guard-bash CLI entrypoint
  (`we:scripts/guard-bash.mjs`) with a pathological/fault-inducing stdin payload asserts exit code `0`
  and stdout that is either empty or well-formed JSON — never a raw uncaught-exception stack trace.
- Every existing `isTreeWritingBuildRun`/`decide` test in `we:scripts/__tests__/guard-bash.test.mjs`
  and `we:scripts/__tests__/golden-corpus-snapshot.test.mjs` still passes unmodified — the new `depth`
  parameter is additive/optional and changes no existing single-argument call's result.
- `npm run check:standards` is 0 errors; `npm test` is green.
