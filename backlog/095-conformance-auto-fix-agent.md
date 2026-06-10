---
type: idea
workItem: story
size: 5
parent: "097"
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-08"
graduatedTo: "scripts/autofix/engine.mjs + scripts/conformance-autofix.mjs CLI (`npm run autofix`) + check-standards.mjs `--json` failure descriptors"
tags: [monetization, business-model, ai-agnostic, conformance, auto-fix, agent, propose-and-verify, webcases, self-run-tool, provider-registry]
relatedProject: webcases
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# Conformance auto-fix agent — AI proposes, the suite verifies

A **self-run AI agent that closes a failing conformance check**: it reads the
verification failures from the open suite (the tool form of [#089](/backlog/089-monetization-product-ideas/)
idea 1), proposes a spec-conformant fix, re-runs `check:standards` / the protocol
cases, and **loops until green** — the *propose-and-verify* moat made literal.
This is the AI-tool white space that incumbents can't touch: Copilot/Cursor lint
and complete generically; none can fix against **your protocol contracts**,
because no one else has a machine-checkable conformance target.

## How it differs from neighbours

- vs. **upgrader tools ([#094](/backlog/094-ai-upgrader-tools/))** — upgraders move
  existing/legacy code *forward in place*; this agent is narrower and reactive:
  given a *specific failing check*, drive it to pass. It can be the fix-engine #094
  and the verifier (#089 idea 1) call.
- vs. **mockup→code ([#086](/backlog/086-mockup-to-standard-code-tool/))** — that
  *creates* from a design; this *repairs* code that already exists but fails.

## Why it fits the solo-founder lens

- **Tier-1 self-run tool** — runs on the customer's dev/CI; no uptime/support SLA.
- **AI is a swappable provider, BYO key** — same registry shape as #086/#094; no
  model-hosting cost on us.
- **Self-verifying by construction** — the agent never ships a fix the suite
  hasn't accepted, so output trustworthiness is structural, not promised. This is
  why the moat *grows* as models commoditise: everyone gets good models; only we
  have the verifiable target that turns a model into a reliable fixer.

## Open follow-ons

- The agent loop contract: failure report → candidate patch → re-verify → accept /
  retry / give-up-with-explanation. Bound the loop; surface diffs for human review.
- Shared engine with #094 (input adapter = "a failing check" vs "existing code").
- Needs the verification tool (#089 idea 1) to emit machine-readable failure
  descriptors the agent can target.

## MVP scope — independently greenlit

This is **being worked** as one of the parallel product candidates under the
emergent MVP strategy ([#097](/backlog/097-roadmap-to-mvp/)) — **not** gated on a
"pick one product" decision (that framing was dropped). It's the tightest
verify-loop slice of the shared engine and effectively the narrowest input case of
the upgrader ([#094](/backlog/094-ai-upgrader-tools/)), so it can fold onto the
same core. Ship a bounded MVP (one failing-check class → fix loop), grow from
there.

## Progress

- **Status:** resolved (MVP shipped 2026-06-08)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `check-standards.mjs` gained a `--json` mode emitting structured failure
    descriptors (the #089-idea-1 machine-readable feed); `deprecated-status`
    enriched with `{ kind, entity, id, file, field, from, to }`. Human output
    unchanged when the flag is absent.
  - `scripts/autofix/engine.mjs` — pure, fs-free engine mirroring
    `upgraderEngine.ts`: `CustomFixer` contract + `CustomFixerRegistry`
    (replace-by-id) + the bounded, verify-gated `autofix()` loop (propose →
    apply → re-verify → accept / revert-and-give-up / skip).
  - Deterministic reference fixer `reference:deprecated-status` — surgical
    string edit (anchors on the id, rewrites only the one field value, so the
    diff stays reviewable).
  - `scripts/conformance-autofix.mjs` CLI + `npm run autofix` (and `--dry-run`),
    wiring the engine to the live suite via spawned `check:standards --json`.
  - vitest (`scripts/autofix/__tests__/engine.test.mjs`, 6 tests): green path,
    both revert paths (target not cleared / new failure introduced), skipped
    (no fixer), surgical-edit byte-fidelity. `vitest.config.ts` include widened
    for `scripts/**/__tests__`.
  - Verified end-to-end against the real repo: seeded a `wip` synonym → `npm run
    autofix` repaired it to `draft` in 2 verify rounds with a clean one-line
    diff. Full suite green (1625 tests), `check:standards` green.
- **Next:** follow-ons — [#196](/backlog/196-ai-model-fixer-provider/)
  (BYO-key model fixer for content-generation classes — the actual moat) and
  [#197](/backlog/197-broaden-conformance-failure-descriptors/) (descriptor
  coverage for the remaining failure classes + order-independent anchoring).
- **Notes:** MVP = one deterministic failing-check class (`deprecated-status`;
  the fix is encoded in `STATUS_SYNONYMS`). AI is a swappable provider into the
  same `CustomFixerRegistry` — documented (#196), not built. The verify gate is
  the moat: a patch is kept only if its failure cleared and no new error appeared.
