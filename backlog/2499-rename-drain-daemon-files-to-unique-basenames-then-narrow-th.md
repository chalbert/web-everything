---
bornAs: xqkt1ci
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, drain-daemon, gate, infra]
scope:
  - plateau:tools/drain-daemon/
  - plateau:tools/dev-panel/vite-plugin.ts
  - plateau:tools/dev-panel/drain-daemon.html
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
  - we:scripts/readiness/conveyor-state.mjs
  - we:scripts/conveyor/pr-watch.mjs
  - we:skills-src/drain/SKILL.md
---

# Rename drain-daemon files to unique basenames, then narrow their TRUST_CHAIN entries (follow-up to #2480)

#2480 registered the phase-1 drain daemon's three source files in `TRUST_CHAIN` at engine tier, but
`TRUST_CHAIN` matches by **basename** and those names are generic — the daemon's CLI basename already
collides with two unrelated WE files, so PRs touching them over-escalate (accepted as the safe direction
under #2480, not ideal). The durable fix: rename the daemon's sources to unique names in plateau-app
(updating imports, the launchd plist and the installed daemon), then narrow the three entries in
`we:scripts/lib/gate-config.mjs`. Impl spans plateau-app (rename) + WE (narrow); WE holds zero daemon impl.
Relates to #2480, #2449.

## Design

Two halves, and the **order matters**: the WE half must land *after* the plateau rename, or the narrowed
`TRUST_CHAIN` entries stop matching the live daemon files and the daemon's own source silently drops out of
the gate-self roster. Land plateau first, WE second (this is a couple, impl-half-first).

**What the WE side actually is.** `TRUST_CHAIN` (`we:scripts/lib/gate-config.mjs:99`) matches by **basename**
— `TRUST_CHAIN_BASENAMES` (`:335`) is `new Set(TRUST_CHAIN.map((m) => m.file))`, and `isTrustChainPath`
(`:394`) tests `basenameOf(path)` against it. **`homes` is not read by the *matcher*, but it is not inert
either**: `we:scripts/check-standards.mjs:1238` builds `specHomes` from `TRUST_CHAIN[].homes` to scope the
#3026 provenance-citation gate to `leash: 'spec'` members. The daemon's three entries are `tier: 'engine'`
with no `leash`, so they fall outside that set — `homes` is documentation *for them specifically*, not in
general. Do not generalise the shortcut. The three entries sit at `we:scripts/lib/gate-config.mjs:178`,
`:185` and `:192`, each already carrying an in-file note that its `file` token is generic.

**The collision is real and enumerable.** In WE today the entry at `:185` matches
`we:scripts/gen-wrapper/cli.mjs` and `we:scripts/ingest-adapter/cli.mjs` — both unrelated to the gate — so a
PR touching either over-escalates. The entries at `:178` and `:192` match no WE file today, so they
over-escalate nothing *right now*; their tokens stay generic enough that any future same-named file anywhere
in the constellation would collide, which is the durable reason to rename all three rather than just one.

**The plateau side, as it actually stands** (read 2026-08-21):

- Sources: `plateau:tools/drain-daemon/daemon.mjs`, `plateau:tools/drain-daemon/cli.mjs`,
  `plateau:tools/drain-daemon/lib.mjs`, with tests in `plateau:tools/drain-daemon/lib.test.mjs`.
- Internal imports to update: `plateau:tools/drain-daemon/cli.mjs:55` and
  `plateau:tools/drain-daemon/daemon.mjs:41` both import the shared pure module by relative path.
- The launchd entrypoint is **generated**, not hand-written: `renderLaunchdPlist({ …, daemonPath, … })` in
  `plateau:tools/drain-daemon/lib.mjs` builds `ProgramArguments`, and its caller at
  `plateau:tools/drain-daemon/cli.mjs:97` passes the daemon entrypoint resolved against its own directory.
  So the plist follows the rename automatically **at reinstall time** — an already-installed plist keeps
  pointing at the old path until the daemon is reinstalled and restarted. That reinstall is a required step,
  not an optional one.
- **Two** callers outside the daemon dir, not one: `DAEMON_CLI` in
  `plateau:tools/dev-panel/vite-plugin.ts:55` resolves the CLI by joining `'..'`, the daemon directory name
  and the CLI's filename (that file's comments name the CLI by path too, as does
  `plateau:tools/drain-daemon/README.md`); **and** `plateau:tools/dev-panel/operations-bridge.mjs:78` does a
  plain ES import of `resolveConfig` from the daemon's shared module — a hard `ERR_MODULE_NOT_FOUND` at
  dev-panel startup if the rename misses it.

**The WE-side consumers the original card body listed in `scope:` but never explained** — all three
hardcode the old names, and the first one fails *silently*:

- `we:scripts/readiness/conveyor-state.mjs:622` — `findDaemonCli()` probes a hardcoded
  sibling path at `plateau:tools/drain-daemon/cli.mjs`. When that path stops existing, `existsSync` returns false and
  the daemon section shapes to "unavailable" with **no `errors[]` row** — deliberately so
  (`we:scripts/readiness/conveyor-state.mjs:788-794`: a cross-repo daemon hiccup must never flip the tick's
  health verdict). That same by-design silence swallows a stale path caused by this rename. There is no
  guard on this seam today: the prep review mutated the literal to the renamed form and all 87 cases in
  `we:scripts/readiness/__tests__/conveyor-state.test.mjs` still passed. Update it in the WE half.
- `we:skills-src/drain/SKILL.md:19` — documents the operator command line that runs
  `plateau:tools/drain-daemon/cli.mjs` with `status|once|logs|install|stop`. Loud failure post-rename (file-not-found), but still stale documentation.
- `we:scripts/conveyor/pr-watch.mjs:69` and `:228` — two JSDoc comments naming the daemon CLI by path.
  Comments only; nothing breaks, but they drift.

**Naming.** `plateau:tools/drain-daemon/drain-daemon.mjs` / `plateau:tools/drain-daemon/drain-cli.mjs` /
`plateau:tools/drain-daemon/drain-lib.mjs`, as the digest proposes — unique across all three constellation
repos as of this reading.

## Done when

1. **tier 1 — the WE over-escalation stops.** `we:scripts/lib/__tests__/gate-config.test.mjs` asserts
   `isTrustChainPath` is **false** for `we:scripts/gen-wrapper/cli.mjs` and
   `we:scripts/ingest-adapter/cli.mjs`, and **true** for `plateau:tools/drain-daemon/drain-cli.mjs`. (The
   function takes a bare repo-relative path — pass these without the `<repo>:` prefix, which is a backlog
   citation convention, not part of the argument.) Fails before — today the first two are `true`. This is
   the criterion the whole item exists for.
2. **tier 1 — the plateau rename does not break the daemon.** In `plateau-app`, the drain-daemon unit suite
   (renamed alongside its subject) passes under `vitest run`, and the dev-panel bridge still imports
   `resolveConfig` successfully.
3. **tier 2 — no stale reference survives in EITHER repo.** A grep for the three old filenames returns
   nothing outside git history in `plateau-app` (`plateau:tools/dev-panel/vite-plugin.ts`,
   `plateau:tools/dev-panel/operations-bridge.mjs`, `plateau:tools/drain-daemon/README.md`) **and** in
   web-everything (`we:scripts/readiness/conveyor-state.mjs`, `we:skills-src/drain/SKILL.md`,
   `we:scripts/conveyor/pr-watch.mjs`). The first of those is the one that matters: it fails silently by
   design, so a grep is the only thing that will catch it.
4. **tier 2 — the installed daemon actually runs the renamed entrypoint.** The daemon is reinstalled and
   restarted, and its status output shows the plist `ProgramArguments` pointing at the renamed entrypoint. A
   rename without the reinstall leaves a launchd job pointing at a deleted file.
5. **tier 2 — `homes` and `file` are both updated.** All three `TRUST_CHAIN` entries in
   `we:scripts/lib/gate-config.mjs` carry the new paths in `homes` and the new tokens in `file`, and the
   "generic basename — collides with other WE …" notes are removed rather than left asserting a collision
   that no longer exists.

The commands that decide 1-3:

```
# in web-everything
npx vitest run scripts/lib/__tests__/gate-config.test.mjs
grep -rn "drain-daemon" scripts/ skills-src/          # must show only renamed paths
# in plateau-app, after the rename
npx vitest run tools/drain-daemon/drain-lib.test.mjs
grep -rn "drain-daemon/\(daemon\|cli\|lib\)\.mjs" --exclude-dir=.git .
```

## Independent review — 2026-08-21

Confidence: **High**. The operation's `record` step reported the review recorded but the note did not reach
this file (a write race with a concurrent edit in the same lane); it is transcribed here rather than lost.

**Verified as sound:** the collision claim (`we:scripts/gen-wrapper/cli.mjs` /
`we:scripts/ingest-adapter/cli.mjs` really do match; the daemon's other two tokens match nothing in WE
today), and the uniqueness of the three proposed new names across both repos.

**Risks it found NOT addressed, all now folded into *Design* and *Done when* above:**

- **consumer** — consumers were traced by subprocess spawn only, missing
  `plateau:tools/dev-panel/operations-bridge.mjs:78`'s ES import, and missing the WE-repo sweep entirely
  even though three WE files were already in `scope:`.
- **decorative-guard** — the reviewer mutated the CLI-path literal in
  `we:scripts/readiness/conveyor-state.mjs` to the renamed form and ran the file's own suite: **all 87
  cases still passed.** There is no guard on that seam, so nothing reddens if the WE half is forgotten.
- **legibility** — `we:scripts/readiness/conveyor-state.mjs:788-794` degrades a missing daemon CLI to a
  silent "unavailable" *by design*, and that same silence swallows a stale path caused by this rename.

**Correction accepted:** the claim "`homes` is documentation only; the matcher never reads it" is false in
general — `we:scripts/check-standards.mjs:1238` reads `TRUST_CHAIN[].homes` for `leash: 'spec'` members. It
holds only incidentally for the daemon's three `tier: 'engine'` entries. The *Design* section now says so.

_Transcribed from the `review-prep` run's recorded verdict._
