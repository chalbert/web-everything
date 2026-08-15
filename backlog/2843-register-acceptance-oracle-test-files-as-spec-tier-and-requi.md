---
bornAs: x464p6l
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
tags: [conveyor, prevention, oracle, gate-config, anti-test-gaming]
---

# Register acceptance-oracle test files as spec-tier and require a non-author signal on the oracle diff

A slice that authors or relaxes its own acceptance oracle can weaken the very test that clears it, with no gate visibility and no independent sign-off. Register acceptance-oracle test files as spec-tier paths in `we:scripts/lib/gate-config.mjs` so weakening one becomes gate-visible, and require a non-author signal on the oracle diff. This is the mechanized form of the #2398 anti-test-gaming guard.

## Gap

Acceptance-oracle test files are not tiered in `we:scripts/lib/gate-config.mjs`, so a diff that loosens an oracle looks like ordinary test churn — nothing marks the change as touching a clearance mechanism, and nothing requires a second party to sign it.

## Why it matters

The `#deterministic-oracle-clears-slice` anchor rests on the oracle being trustworthy: a green oracle clears its slice. If the slice that *authors or relaxes* the oracle can also be cleared by that oracle's own green, the guarantee is circular — the exact anti-test-gaming case #2398 rejects. Making oracle files spec-tier plus a non-author signal restores independence mechanically.

## Current code state

`TRUST_CHAIN` (`we:scripts/lib/gate-config.mjs`) already registers three of the repo's OWN gate-conformance oracles as spec-tier: `we:scripts/lib/review-policy.contract.json`, `we:scripts/lib/__tests__/review-policy.conformance.test.mjs`, `we:scripts/check-standards.contract.json`, `we:scripts/lib/__tests__/check-standards.conformance.test.mjs`. Those are **not** the gap.

The concrete, currently-unregistered gap: each `leash: 'code'` (independent-committee-clearable) policy-tier derivation member — `we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-core.mjs`, `we:scripts/lib/disposition-land-seam.mjs`, `we:scripts/lib/auto-land-seam.mjs` — has its own unit-test suite that IS the acceptance oracle proving that file still behaves correctly, and **none of the four is registered in `TRUST_CHAIN` today** (verified against the live roster, 2026-08-15):

- `we:scripts/lib/__tests__/review-escalation.test.mjs` (+ a second suite over the same module, `we:scripts/__tests__/review-escalation.test.mjs` — basename-matched, both legitimately cover `we:scripts/lib/review-escalation.mjs`, not an accidental collision)
- `we:scripts/lib/__tests__/review-core.test.mjs`
- `we:scripts/lib/__tests__/disposition-land-seam.test.mjs`
- `we:scripts/lib/__tests__/auto-land-seam.test.mjs`

(`we:scripts/lib/review-policy.mjs`'s oracle is `we:scripts/lib/__tests__/review-policy.conformance.test.mjs`, already spec-tier — no action needed.)

Today a diff that weakens one of these four while also changing its subject file trips only `blast-radius` (agent-clearable, converged panel) — never `gate-self` — so nothing marks it as touching its own clearance mechanism and nothing forces a human.

## Mechanical fix

1. In `we:scripts/lib/gate-config.mjs`'s `TRUST_CHAIN`, add 4 new entries — same shape as the existing `policy-conformance` / `check-standards-conformance` entries — each `tier: 'policy', leash: 'spec'`, matched on the basenames `we:review-escalation.test.mjs`, `we:review-core.test.mjs`, `we:disposition-land-seam.test.mjs`, `we:auto-land-seam.test.mjs` (basename matching, per the roster's own `homes`-vs-`file` convention). Add a short comment block above them (matching the file's existing literate style, e.g. the drain-daemon / converge-daemon section headers) naming #2398/#2843 as the rationale.
2. No change needed to `we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-policy.contract.json`, or `we:scripts/lib/__tests__/review-policy.conformance.test.mjs` — `POLICY_SPEC_BASENAMES`/`isPolicySpecPath` and the existing `gate-self` reason token already key off `TRUST_CHAIN` generically, so the four new entries flow into `humanRequired` with zero additional wiring. This closes clause 2 for free: `leash: 'spec'` forces `review:human` unconditionally, and a human is by construction never the autonomous PR's authoring agent — that IS the non-author signal the Gap above asks for; no separate identity check needs inventing.
3. Extend `we:scripts/lib/__tests__/gate-config.test.mjs` with a new `describe` block (mirroring its existing "drain-daemon gate-deciding files" and "declarative-leash / derivation-code split" blocks) pinning: each of the 4 new basenames is a `TRUST_CHAIN` member with `tier: 'policy'`/`leash: 'spec'`, is a member of `POLICY_SPEC_BASENAMES`, and `isPolicySpecPath()` returns `true` for its real path (and stays `false` for an unrelated control path, mirroring the file's existing negative-control test).

**Non-goals (keep this slice small):**
- Don't invent a separate oracle registry — reuse `TRUST_CHAIN`/`leash: 'spec'` verbatim, the same mechanism already covering the two conformance suites.
- Don't register any ENGINE-tier member's own test suite (e.g. `we:scripts/__tests__/merge-ai-prs.test.mjs`, the drain/converge-daemon test suites) — engine tier is deliberately agent-clearable by the #2445 two-tier flip; forcing those human would contradict that ruling. A follow-on item may revisit this if warranted.
- Don't build an automatic oracle-discovery scanner. Like every other `TRUST_CHAIN` member, a newly-authored acceptance oracle (e.g. a future #2811-style per-slice render-conformance test) is registered by hand at authoring time — the same manual audit-and-register model #2480 used for the drain daemon.

## Acceptance

- [ ] `TRUST_CHAIN` in `we:scripts/lib/gate-config.mjs` contains all 4 new entries with `tier: 'policy'` and `leash: 'spec'`, each `desc` citing #2398 and #2843.
- [ ] `POLICY_SPEC_BASENAMES` (derived, no manual edit) contains all 4 new basenames.
- [ ] `we:scripts/lib/__tests__/gate-config.test.mjs` pins the 4 new entries' tier/leash and `isPolicySpecPath()` truth for a representative real path per file.
- [ ] `npx vitest run` over `we:scripts/lib/__tests__/gate-config.test.mjs` and `we:scripts/lib/__tests__/gate-invariants.test.mjs` (repo-root-relative paths, no `we:` prefix, when actually invoked) is green with **no edits to `we:scripts/lib/__tests__/gate-invariants.test.mjs`** — proving its existing generic property tests (INVARIANT 1/6/12) extend to the new entries for free.
- [ ] `npm run check:standards` exits 0 with no new errors.
- [ ] The diff to `we:scripts/lib/gate-config.mjs` is additive only — no pre-existing `TRUST_CHAIN` entry's tier/leash/desc changes.

## Provenance

Outstanding prevention **M2** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Composes with `#agent-convergence-independent-validation` (#2398). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
