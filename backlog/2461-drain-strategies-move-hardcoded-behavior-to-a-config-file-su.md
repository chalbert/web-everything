---
bornAs: xw9m2cf
kind: story
size: 5
status: open
dateOpened: "2026-07-12"
tags: []
scope:
  # WE lander + new declared drain-strategy config layer
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/drain-config.mjs
  - we:scripts/lib/__tests__/drain-config.test.mjs
  - we:drain.config.json
  - we:drain.config.schema.json
  # trust-chain roster: register the new lander-governing config artifact
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
  # plateau drain-daemon (reads config → pass-arg strategy) + dev-panel loop UI surface (#2454)
  - plateau:tools/drain-daemon/lib.mjs
  - plateau:tools/drain-daemon/lib.test.mjs
  - plateau:tools/drain-daemon/daemon.mjs
  - plateau:tools/drain-daemon/cli.mjs
  - plateau:tools/dev-panel/vite-plugin.ts
  - plateau:tools/dev-panel/drain-daemon.html
---

# drain strategies: move hardcoded behavior to a config file surfaced in the plateau loop UI

Operator direction (2026-07-12, drain git-hygiene review): stop hardcoding drain strategy choices in we:scripts/merge-ai-prs.mjs and per-invocation flags — make them a declared config. Today the strategy knobs are scattered and code-fixed: rebase-drop on/off (`--no-rebase-drop`), land strategy (`gh pr merge --merge` vs `--squash`), watch interval, review-escalation overrides, repo scope. Fix shape: (a) a drain config file (repo-root, e.g. we:drain.config.json, schema-validated) that we:scripts/merge-ai-prs.mjs and the resident daemon (plateau:tools/drain-daemon, #2449) both read as the default strategy layer — CLI flags stay as per-invocation overrides on top, never the only way to choose; (b) surface the config in the plateau dev-panel drain-daemon loop UI (#2454's surface: status/history/controls) so the operator edits strategies from the browser — the panel writes the config file through the existing control endpoint (same loopback-only guard, plateau#21); (c) first strategies to carry: rebase-drop scope (item 2460 carries the new default), merge vs squash land strategy (the git-hygiene lever — squash collapses branch noise to one commit per PR on main), watch cadence. Cross-repo by nature (WE lander + plateau UI) — expect a coupled impl PR.

## Design

**Where each knob actually lives today** — all four are already isolated enough to take a default from a
config layer without restructuring `we:scripts/merge-ai-prs.mjs`:

| knob | today | config seam |
|---|---|---|
| rebase-drop on/off | `const REBASE_DROP = flags['no-rebase-drop'] ? false : true;` in `runCli`, plus the separate `--no-content-rebase-drop` derived from it | the two constants — flag overrides config, config overrides the built-in default |
| land strategy | `mergePr({ …, method: 'merge', … })`, one call site; `mergePr` in `we:scripts/lib/pr-merge-gate.mjs` already takes `method` and defaults it to `'merge'` | pass the configured method at that call site |
| watch cadence | `parseWatchOpts` (exported, pure) hardcodes `30` when `interval` is absent | give it a default argument fed from config; keep the pure signature |
| repo scope | `resolveRepos` / the `--repos` + `--only` narrowing | config supplies the default repo list |

**Keep the exported knob functions pure — a second consumer depends on it.** `we:scripts/lane-resume.mjs`
ES-imports `resolveRepos` from `we:scripts/merge-ai-prs.mjs` (and separately shells the lander as a
subprocess for its trigger-drain step). If config is baked INTO `resolveRepos` rather than threaded at the
lander's call site, `lane-resume` silently inherits drain-config defaults it never asked for. So: config is
resolved by the caller and passed in; the exported functions keep today's signatures and today's built-in
defaults. `we:scripts/lane-resume.mjs` is not in this card's `scope:` and should not need to be. (Raised by
the independent review below.)

**Precedence must be one function, tested, not a `??` chain repeated at four sites.** `flag > config >
built-in default` is the whole contract; write it once in the new `we:scripts/lib/drain-config.mjs` and have
every knob resolve through it. That also makes "config absent entirely" a first-class case — the loader must
return the built-in defaults, so a checkout with no `we:drain.config.json` behaves exactly as today.

**The plateau half has a hard fail-closed constraint, and this is the item's real risk.**
`buildPassArgs` in `plateau:tools/drain-daemon/lib.mjs` builds the child argv and then refuses to return it
unless `childPassEnforcesHoldInvariant(argv)` holds — the WE #2832 guarantee that every daemon-spawned pass
is label-scoped with the label-reconcile ON, so a held PR can never carry `ready-to-merge`. A config layer
that can inject arbitrary flags into that argv can defeat it. So: the config's schema must be a **closed
enumeration of knobs**, never a free-form flag array, and the `childPassEnforcesHoldInvariant` check must
stay AFTER config is applied. Adding a config-driven argv and moving that check earlier would silently
re-open the hole that landed a plateau PR with no review.

**The browser write path already exists and is already guarded.**
`plateau:tools/dev-panel/vite-plugin.ts` serves `/__dev-panel/drain-daemon/{status,queue,evidence,stuck,review-ledger}`
as GETs and `/__dev-panel/drain-daemon/control` as the one POST, gated by `rejectCrossSiteControl` (loopback
peer + local origin + declared JSON content type). A config write is state-changing with the same blast
radius as `control`, so it goes through that same guard — and, per the file's own comment that the panel
"shells the daemon CLI (the single source) — no daemon logic lives here", the write must shell a CLI
verb rather than editing JSON inside the vite plugin.

**Trust-chain registration is part of the job, not an afterthought.** `we:scripts/merge-ai-prs.mjs` is
registered in `we:scripts/lib/gate-config.mjs` at engine tier. A config file that *decides how the lander
behaves* is lander-governing, so it belongs in the roster too — the roster matches on **basename**, so
register the basenames of `we:drain.config.json` and `we:scripts/lib/drain-config.mjs` with a
deliberate `tier`/`leash`. Note that
`we:scripts/lib/gate-config.mjs` is itself `leash: 'spec'`, so editing the roster forces `review:human` —
expected, and the reason to decide the tier once rather than iterating.

**Sequencing.** (1) `we:scripts/lib/drain-config.mjs` + schema + the precedence function, with the loader
returning built-in defaults on an absent file — landable alone, changes no behaviour. (2) Thread the four
knobs in `we:scripts/merge-ai-prs.mjs` through it. (3) Roster registration. (4) The plateau daemon reads
config → `buildPassArgs`. (5) The dev-panel surface. Steps 1–3 are WE-only and can land before the plateau
half exists; only 4–5 need the coupled PR.

**Do not land the rebase-drop default change here.** #2460 owns that ruling; this item only makes it
*configurable*. Landing both at once makes a behaviour regression indistinguishable from a config bug.

## Done when

- The precedence function resolves `flag > config > built-in default` for every knob, and an **absent**
  config file yields exactly today's defaults. Both pinned in the new suite; both fail before and pass
  after:

  ```
  npx vitest run scripts/lib/__tests__/drain-config.test.mjs
  ```

- Each of the four knobs takes its value from config when no flag is given, and from the flag when one is —
  pinned in the lander's own suite over the existing pure exports (`parseWatchOpts`, `resolveRepos`) and
  the `mergePr` call's `method`:

  ```
  npx vitest run scripts/__tests__/merge-ai-prs.test.mjs
  ```

- A malformed `we:drain.config.json` is rejected against `we:drain.config.schema.json` with a message naming
  the offending key — it does not silently fall back to defaults, which would hide an operator's typo'd
  strategy.
- `buildPassArgs` still throws when config would produce an argv that fails
  `childPassEnforcesHoldInvariant`, with a case proving a config value cannot drop `--label` or disable the
  label-reconcile. (`npm test` in the plateau checkout.)
- The dev-panel config write goes through `rejectCrossSiteControl` and shells the daemon CLI; a non-loopback
  peer is refused, matching the existing `control` endpoint's behaviour.
- The basenames of `we:drain.config.json` and `we:scripts/lib/drain-config.mjs` are registered in
  `we:scripts/lib/gate-config.mjs` with an explicit tier and `leash`.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — Every load-bearing citation checked out against the live repo: we:scripts/merge-ai-prs.mjs:2513 REBASE_DROP ternary, we:scripts/lib/pr-merge-gate.mjs:168 mergePr's method default, we:scripts/merge-ai-prs.mjs:1570 parseWatchOpts' hardcoded 30, we:scripts/merge-ai-prs.mjs:1826 resolveRepos, plateau:tools/drain-daemon/lib.mjs:57-91 buildPassArgs/childPassEnforcesHoldInvariant, plateau:tools/dev-panel/vite-plugin.ts:293/614/650 rejectCrossSiteControl, and we:scripts/lib/gate-config.mjs's own leash:'spec' entry. Referenced backlog items #2449 and #2454 (the daemon and dev-panel surfaces this card builds on) are both status:resolved, and #2460/#2832 (which the card correctly treats as separately-owned/open) are both status:open.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/lane-resume.mjs also imports resolveRepos from we:scripts/merge-ai-prs.mjs by ES import (and separately shells `we:scripts/merge-ai-prs.mjs` as a subprocess for its trigger-drain step) — a consumer the card's declared scope never names. The card is not explicitly harmed by this: its own 'Done when' pins the precedence tests 'over the existing pure exports (parseWatchOpts, resolveRepos)', and the design table's stated pattern (thread config in at the call site, keep every knob's export pure) protects `we:scripts/lane-resume.mjs`'s independent call from inheriting drain-config defaults it never asked for. But the card never performs the ES-import-plus-subprocess sweep the taxonomy calls for, so this protection is incidental to the design rather than a checked fact, and no test in the declared scope (e.g. we:scripts/__tests__/lane-resume.test.mjs) pins that resolveRepos' behavior for that caller stays unchanged.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The WE/plateau seam gets explicit round-trip coverage: the schema-rejection test (naming the offending key), and buildPassArgs' childPassEnforcesHoldInvariant check pinned to run AFTER config is applied with a case proving config cannot drop --label or the label-reconcile. The card also sequences steps 1-3 (WE-only, no behavior change) ahead of 4-5 (the coupled PR), which is the right mitigation for two halves built separately.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card explicitly flags that a config-driven argv could defeat childPassEnforcesHoldInvariant if the check were reordered ahead of config application, and requires 'closed enumeration of knobs, never a free-form flag array' plus a named test case proving a config value cannot drop --label or disable the label-reconcile — this is a concrete, falsifiable requirement rather than a check-the-box item.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Malformed we:drain.config.json must be rejected against we:drain.config.schema.json with a message naming the offending key, explicitly called out as required so a typo'd strategy doesn't silently fall back to defaults.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card pins 'an absent config file yields exactly today's defaults' as a tested requirement and sequences the config-plumbing steps (1-3) as landable alone with 'changes no behaviour' — the zero-impact claim for the base case is testable, not asserted.

**Corrections recommended:**

- none — the preparation held up as written.

The preparation is accurate against the live repo on every citation checked, keeps the four knobs' exported functions pure while threading precedence at call sites, and explicitly protects the one identified safety invariant (childPassEnforcesHoldInvariant) against being defeated by config — the only gap found is that it never names we:scripts/lane-resume.mjs as a second consumer of resolveRepos, though the design pattern it commits to structurally shields that caller anyway.

_Recorded through the declared `review-prep` operation._
