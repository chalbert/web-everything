---
kind: decision
size: 3
status: open
dateOpened: "2026-07-06"
tags: []
---

# frontierui has no CI test check, so the constellation drain can never auto-land its lanes

Frontierui has no fui:.github/workflows at all — zero CI checks on every PR. The constellation drain (we:scripts/merge-ai-prs.mjs) gates on a green required 'test' check, so its isRequiredCheckGreen returns false for every frontierui PR and the drain skips it with 'required check test is not green'. Observed 2026-07-06 finishing #10/#11, which had to be manually squash-merged (the batch-integrator path). Fix: either add a real 'test' workflow to frontierui so the drain can gate it like WE lanes, or make classifyPr treat a repo with no required-check configured as an explicit, deliberate case rather than a silent skip. Relates #2153.

## Design fork surfaced (2026-07-08 batch pre-flight — carried from batch-2026-07-08 with reason `outgrew`)

Option (a) "add a real 'test' workflow" is **not** a trivial `npm ci && npm run test:unit`: frontierui's
unit suite is **not standalone-green**. A clean `npm run test:unit` (`fui:vitest run`) fails **9 tests in
`fui:tools/maas/__tests__/*`** (e.g. `fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs`) with
`ENOENT` on `we:src/_data/authorModeSource.json` — those tests read the **WE sibling repo** at a fixed
sibling path (the mirror image of how `we:.github/workflows/ci.yml` checks out frontierui as a sibling for
the `@frontierui/*` alias). So a frontierui CI `test` job must resolve that dependency. **The fork to
decide before implementing:**

- **(a1) sibling-checkout** — frontierui CI checks out the WE sibling (token + `path:` layout, mirroring
  `we:.github/workflows/ci.yml`'s FUI-sibling step) so the maas tests find `we:src/_data/*`. Highest
  fidelity; adds a cross-repo read token + install cost to every frontierui PR.
- **(a2) scoped `test` job** — the CI `test` job runs only the sibling-independent suite (exclude
  `fui:tools/maas/__tests__/**` or gate those behind a "sibling present" guard), leaving the WE-dependent
  tests to run only where the sibling exists (locally / WE's own CI). Cheaper, but the `test` check no
  longer covers the maas authoring tests.

Also note: making the drain actually **require** the check (branch protection) is **#2246**'s scope and is
a credentialed/human action — but adding the workflow ALONE already makes `isRequiredCheckGreen` return
true for a green frontierui PR (it reads the rollup for a check named `test`), which is the core unblock.
Pick a1/a2 (or ratify option (b) instead) before authoring the workflow. Relates #2153, #2246.
