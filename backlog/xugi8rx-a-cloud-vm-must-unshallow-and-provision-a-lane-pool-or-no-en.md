---
kind: story
size: 5
parent: "2445"
status: open
dateOpened: "2026-08-18"
tags: [delivery, lane, cloud-vm, bootstrap, portability]
scope:
  - we:scripts/bootstrap-session.mjs
  - we:scripts/__tests__/bootstrap-session.test.mjs
  - we:docs/agent/vm-sessions.md
---

# A cloud VM must unshallow and provision a lane pool, or no engine operation runs

A Claude Code cloud session clones `--depth 1`, and `lane-pool.mjs` clones lanes with
`--reference <primary>`, which git refuses against a shallow repository. No lane pool means no lane
clone, and the card-mutation guard refuses every scaffold/claim/resolve outside one with "there is no
override" — so a cloud VM cannot file or move a single backlog item, and `review-prep` cannot get the
juror lane it requires. `bootstrap-session` makes this worse by skipping the pool on purpose.
Unshallow the primary and each present sibling first, then provision.

## Done when

1. **Executable** — from a fresh cloud VM, `npm run bootstrap` then `node scripts/backlog.mjs scaffold
   --kind=task --size=1 --title=probe` exits 0. Today that scaffold exits non-zero with
   `backlog item-mutation BLOCKED`.
2. `node scripts/lane-pool.mjs provision --count=1` completes with no `is shallow` fatal for the
   primary or for either sibling, and `lane-pool.mjs list` prints one lane path.
3. `node scripts/bootstrap-session.mjs --ephemeral --dry-run` lists an `unshallow` step and a `lanes`
   step whose status is NOT `skipped`.
4. Re-running `npm run bootstrap` on an already-unshallowed VM still exits 0 — the idempotency
   contract the whole script rests on, and the failure mode most likely to slip (see interfaces).
5. `docs/agent/vm-sessions.md` no longer tells the reader a VM has no lane pool, and states the
   unshallow precondition instead.

## Why, measured rather than assumed

Probed live in a cloud VM on 2026-08-18, in this order:

- `lane-pool.mjs provision --count=1` gave `fatal: reference repository '/workspace/web-everything'
  is shallow`, exit 128.
- `backlog.mjs scaffold` from the checkout gave `backlog item-mutation BLOCKED ... must run in a LANE
  clone ... There is no override.`
- `git fetch --unshallow` on all three checkouts, then `provision` succeeded with siblings included,
  and `scaffold` inside `lane-1` succeeded. **This card was filed by that exact route.**

## The decided design

`planSteps` gains one `unshallow` step before the existing `lanes` step, on ephemeral hosts only. It
unshallows the primary and every *present* sibling — absent siblings stay reported, never cloned, per
the existing rule. The `lanes` step stops being an unconditional ephemeral skip and provisions.

**Open fork, NOT picked here and not to be picked silently: how much pool does a VM get?**
Provisioning costs an unshallow plus `npm ci` per lane on every fresh container, paid by every
session including ones that never touch the backlog. Branches: (a) always provision `--count=1`;
(b) provision lazily on the first blocked mutation; (c) `--no-install` at bootstrap and install on
first use. A real either/or with a cost/latency tradeoff — it wants its own `decision` item, and this
story lands behind whichever branch is ratified.

## Interfaces and protocol

- **`git fetch --unshallow` is NOT idempotent.** On a complete repository it exits **128** with
  `fatal: --unshallow on a complete repository does not make sense`. The step MUST gate on
  `git rev-parse --is-shallow-repository` returning the string `true` and treat any other value as
  nothing-to-do. Calling it unguarded breaks acceptance criterion 4 on the second run of a script
  whose entire contract is that re-running is a no-op.
- **`lane-pool.mjs provision --count=N [--no-install]`** exits 0 on success, but a failed *sibling*
  clone is a warning on stdout rather than a non-zero exit — so the step must not read the exit code
  alone if it wants to report sibling state honestly.
- **Step shape** — the existing `planSteps` contract is `{ id, title }` plus one of `skip` / `info` /
  `verify` / `argv` / `gitDir`. The unshallow step is a new effect kind; give it its own key rather
  than overloading `verify`, whose return value is already consumed as report detail.

## Scope consumers

`bootstrap-session.mjs` has **zero ES importers** outside its own test. Every real consumer is a
subprocess or config caller, which an import scan finds none of:

- `we:.claude/settings.json` — the repo-level SessionStart hook.
- `~/.claude/settings.json` — the user-level SessionStart registration the script writes itself.
- `we:package.json` — the `bootstrap` and `bootstrap:check` scripts.

`lane-pool.mjs` is the same shape at larger scale (ten-plus subprocess callers, no importers) — the
canonical case behind checklist item 1.

## Tasks

1. Add an `isShallow(root)` helper and an `unshallow` step to `planSteps`, ephemeral-only, guarded
   per the interface note.
2. Extend the runner to execute the new step kind and report per-repo before/after state.
3. Flip the ephemeral `lanes` step from `skip` to a provision call, behind the ratified fork.
4. Tests: shallow to unshallow is planned; already-complete is a no-op; an absent sibling is reported
   and not cloned.
5. Rewrite the `vm-sessions.md` table rows and the "do not provision a lane pool" paragraph.

## Delivery shape

Lands incrementally behind `main` as one PR — additive to `planSteps`, no consumer migration, no data
shape change. The doc correction must land in the SAME PR: `vm-sessions.md` currently states the
opposite of this card's conclusion, and a gap between them is actively misleading guidance.

## Preparation risk assessment

- **premise** — the card rests on "a shallow reference is why the pool fails". Probed directly via the
  git fatal quoted above, not inferred.
- **unmeasured-impact** — the cost side of the open fork is NOT measured. Unshallow was seconds for WE
  on a warm proxy; `npm ci` per lane is unmeasured. Do not ratify the fork on this card's numbers.
- **consumer** — the consumers above are config, not code, and were verified by hand.
- **blast-radius** — only the ephemeral branch changes, so a workstation run is unaffected; a reviewer
  should confirm `--laptop` forcing still skips the new step.

## Independent review — 2026-08-18

Confidence: **Low**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion BEFORE building) — The card claims to have 'probed live in a cloud VM' and quotes exact git fatals and a specific fix location (planSteps in we:scripts/bootstrap-session.mjs), but that file — and the SessionStart/bootstrap wiring it depends on — does not exist in the live repo at all (see corrections). A premise probe that cites a script which isn't in the repo isn't a verified premise; it's unverifiable as written. Net effect: introduced by this card's own text (not inherited from untouched material), makes the preparation worse than having no card (an implementer following it hits a wall immediately — there is no planSteps to add a step to), and is not something a parallel lane can quietly patch around since it undermines the card's entire factual basis. Impact if unfixed: broken — an implementer would either stall immediately or, worse, fabricate the 'existing' file from the card's confident-sounding description of internals that were never real, producing code inconsistent with whatever actually ships. Root cause (blameless): the preparer wrote highly specific, quote-shaped claims about 'existing' code and consumers without running a fresh `git grep`/`ls` against this exact checkout before filing, or verified against a different repo/branch/simulated state. Prevention: a deterministic pre-file gate that resolves every path in a card's 'Declared scope' (and every file path a card's body asserts already exists) via `git ls-files`/`existsSync` and fails the card if any is missing and not explicitly flagged 'new file' — this is scriptable and belongs in something like we:scripts/check-backlog-item.mjs. Not currently captured: grep of we:scripts/check-backlog-item.mjs and we:scripts/check-standards.mjs shows existsSync checks for many other artifact classes but none scoped to backlog-card declared-scope paths, so this must be filed as a new backlog item rather than treated as already gated.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The 'Scope consumers' section names we:.claude/settings.json (SessionStart hook), ~/.claude/settings.json, and we:package.json (bootstrap/bootstrap:check scripts) as consumers 'verified by hand' — but the live we:.claude/settings.json has no SessionStart hook and we:package.json has no bootstrap script (see corrections). The consumer-finding method described (an import scan plus manual subprocess/config check) is the right method in general, but its result here does not match the repo, so the claimed verification did not actually happen against this checkout. Same disposition as premise above: introduced by the card, worse than no card (a reader trusts a false 'verified' claim), not parallelizable since it's the same underlying fabrication. Impact: broken. Root cause: same as premise — no fresh check against the live tree. Prevention: same deterministic declared-scope/consumer-existence gate as above; not currently captured, would need filing.

**Corrections applied by this review:**

- we:scripts/bootstrap-session.mjs does not exist anywhere in the repository — confirmed via `git log --all --oneline` (zero commits ever touching that name), a full-tree grep for "bootstrap-session" (zero hits outside this card), and checking every sibling lane under /root/workspace/.lanes (none has it). This checkout's HEAD matches origin/main exactly (334e9b29, 2026-08-17) and is not shallow, so this is not staleness.
- we:docs/agent/vm-sessions.md does not exist — docs/agent/ contains no such file, contradicting the card's claim that it 'currently states the opposite of this card's conclusion' and needs its table rows rewritten.
- we:package.json has no `bootstrap` or `bootstrap:check` script (grep for "bootstrap" returns nothing), contradicting checklist item 1 ('npm run bootstrap then …') and the 'Scope consumers' section's claim that these scripts exist and were 'verified by hand'.
- we:.claude/settings.json has no SessionStart hook of any kind (full file read; only PreToolUse/PostToolUse hooks are registered), contradicting the card's claim that it is 'the repo-level SessionStart hook' consumer of bootstrap-session.mjs.
- The backlog item file for xugi8rx itself is not present in we:backlog/ (nor in any sibling lane's backlog/), so the card's own claim 'This card was filed by that exact route' cannot be corroborated against repo state.
- The premise that appears independently verifiable — we:scripts/lane-pool.mjs's cmdProvision/cloneLane path does `git clone --reference <primary>` (we:scripts/lane-pool.mjs:519-531), which is plausibly incompatible with a shallow reference — is real code and a real risk, but it is decoupled from the rest of the card since the file meant to fix it (bootstrap-session.mjs) doesn't exist to be edited.

The card is well-argued in prose and its interface reasoning is sound in the abstract, but it rests on a false premise: none of its declared-scope files, nor the bootstrap-session.mjs/SessionStart infrastructure it repeatedly quotes as already existing, are present anywhere in the live repo, so the preparation cannot be executed as written.

_Recorded through the declared `review-prep` operation._
