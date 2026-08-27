---
bornAs: xsbchju
kind: story
size: 5
status: open
scope: ["we:scripts/lib/", "we:scripts/check-standards.mjs", "we:scripts/operations/__tests__/helpers/"]
dateOpened: "2026-08-26"
blockedBy: ["3354"]
relatedReport: reports/2026-08-26-adversarial-fixtures-model-output-consumers.md
tags:
  - testing
  - adversarial-fixtures
  - model-output
  - gate
---

# Gate the declared model-consumer set on standing adversarial fixtures

Build the check that enforces the model-consumer clause ruled by
[#3354](/backlog/3354-require-adversarial-fixtures-for-machinery-that-consumes-mod/): a **declared**
member set widened by **import-graph reachability** from the single model-entry seam, a **two-exit** ratchet,
and a shared fake-juror fixture module. **Blocked on that decision being ratified and its anchor landing** —
the two-PR rule ([#principle-and-impl-two-pr](/docs/agent/platform-decisions.md#principle-and-impl-two-pr))
requires the cited anchor to be `status: resolved` on `main` before this PR may reference it.

This card exists because the mechanism is an **implementation choice with no statute output** — the fresh
two-confusion screen flagged it as such on the decision item, and the decision was rewritten to carve it here
rather than ask a human to rule on gate internals. The decision fixes *what* is bound; this fixes *how* the
gate finds it.

## Recommended approach (from the decision's prep — grounded, not binding on the builder)

1. **Membership is declared.** A `judge` step in the operation's declaration where one exists —
   `we:scripts/operations/cli-adapter.mjs:107` already computes
   `(declaration?.steps ?? []).some((s) => s?.step?.kind === 'judge')`. An explicit docblock marker for the
   module that has no declaration (`we:scripts/review-core-cli.mjs`, `we:scripts/lib/jury-core.mjs`).
2. **An import-graph widener catches the non-participant.** Model output is parsed in exactly one place —
   `we:scripts/lib/judge-spawn.mjs:490`. Any module reachable in the import graph from a `judgeSpawn` result
   must carry the marker or sit on the allowlist. Reachability is a graph question, and
   `we:scripts/lib/operation-io-fidelity.mjs:255` already associates a module to its test by import graph
   *"not by filename"*, so the traversal is a known shape here.
3. **Do NOT source-scan for the semantic property.** It was tried against the tree during prep and got it
   wrong in both directions: *"imports `judgeSpawn`"* misses `we:scripts/review-core-cli.mjs` and
   `we:scripts/lib/jury-core.mjs` — the two files the rule exists for — and false-positives on
   `we:scripts/operations/step-kinds.mjs`, whose own header (`:32`) declares it a pure leaf.
   `we:scripts/lib/operation-io-fidelity.mjs:320-327` records the same conclusion from its own attempt:
   *"a regex that tries gets it wrong in both directions (it did, three times)."*
4. **The ratchet needs TWO exits, not one.** Copy the shape at
   `we:scripts/lib/operation-io-fidelity.mjs:86,135,371` — frozen baseline, reasons on the line, closed by
   construction to modules written after the rule — but add a **`not-a-model-consumer` discharge**. The
   io-fidelity ratchet has a single exit (gain a test, `:335`), so a module listed *in error* can never
   leave: it has no guard over model output, so no discriminating fixture can exist for it, and `:371`
   forbids dropping it. Without the second exit the escape valve is a trap door, and a gate whose false
   positives cannot be discharged is a gate people disable.
5. **A fixture counts iff it discriminates** — a named line of guard code whose removal makes it fail. The
   proof is the shipped `we:scripts/operations/mutation-check.mjs`; only `killed` admits a fixture, never
   `survived` and never `unrun`.
6. **Extract the shared fixture module.** The 25 adversarial fixtures are currently module-local in
   `we:scripts/operations/__tests__/review-pr.test.mjs:1645-2041` (`FAKE_JURORS` at `:1676-1732`,
   `driveFixture` at `:1738`), none of it exported. The natural home is beside
   `we:scripts/operations/__tests__/helpers/fake-claude.mjs`, whose header (`:28-29`) already names this gap:
   *"The quality of what an agent produces is a different test and a different budget — this is the harness
   that makes that test a swap of one binding rather than a new build."*
7. **Register the rule the standard way** — the scan lives in the lib, three lines at the call site
   (`we:scripts/check-standards.mjs:2270-2274` is the template), **outside any try/catch**: a catch-all that
   demotes a scan failure to a warning is a gate that fails open.

## Known targets on day one

The declared set as of prep: `review-pr`, `review-prep`, `explore` (all declare a `judge` step), plus
`we:scripts/review-core-cli.mjs` and `we:scripts/lib/jury-core.mjs` by marker. Not model consumers despite
looking alike, and useful as negative fixtures for the widener's own tests:
`we:scripts/lib/jury-ledger.mjs:252` and `we:scripts/lib/verdict-ledger.mjs:430` (our own JSONL ledger) and
`we:scripts/conveyor/tick-core.mjs:932` (orchestrator bookkeeping from stdin).

## Done when

1. **Executable** — `npm run check:standards` fails on a module reachable from `judgeSpawn` that carries
   neither a marker nor an allowlist entry, and passes once it gains one; green on the tree as it stands.
2. **Executable** — a test proves both ratchet exits: an entry discharged as `not-a-model-consumer` leaves
   the allowlist *without* the module gaining a fixture, and re-adding a module outside the frozen baseline
   still errors.
3. **Executable** — the shared fixture module is imported by
   `we:scripts/operations/__tests__/review-pr.test.mjs` (its 25 cases keep passing from the new home), and
   `mutation-check` reports `killed` for at least one fixture per guard the first converted module declares.
4. **Observable** — `we:scripts/lib/operation-io-fidelity.mjs`'s `UNCONVERTED_IO_MODULES` entries for
   `'review-pr'` and `'review-prep'` name the new rule as what covers the half a real repo cannot prove.
