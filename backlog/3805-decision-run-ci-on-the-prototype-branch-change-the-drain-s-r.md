---
bornAs: xxpu8tm
kind: decision
parent: "3383"
status: open
relatedTo: ["3674", "3653", "3443"]
scope: ["we:.github/workflows/ci.yml", "we:.github/workflows/review-gate.yml", "we:scripts/merge-ai-prs.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Decision: run CI on the prototype branch, change the drain's required check, or neither

Rule whether the prototype branch `lane/mechanical-dispatcher` gets real CI, or whether the drain's hardcoded required check changes, or neither. Today the two cards that raised it (#3674 and #3653) each name one half of the fork and rule nothing. Relates #3674 (the drain stalls forever on a base with no `test` check; two candidate fixes, "not deciding here"), #3653 (allow CI for POC branches) and #3443 (graduation: each slice gets its own reviewed pull request to `main`).

*Not prepared:* no skeptic pass has run on the forks below and there is no `preparedDate`. The default is mine, from the code reads and probes cited here.

## FOUND (re-verified 2026-09-21)

- **CI never runs on the prototype.** `we:.github/workflows/ci.yml` triggers on `push` and `pull_request` for `branches: [main]` only, and `we:.github/workflows/review-gate.yml` on `pull_request` for `branches: [main]` only. Probed today: `gh api repos/chalbert/web-everything/branches/lane%2Fmechanical-dispatcher/protection` returns 404 (no protection rule), and `commits/<tip>/check-runs` for the branch tip returns `total_count: 0`. The two workflow files are identical on the branch and on `main`.
- **The drain and the pull-request lander disagree.** The drain (`we:scripts/merge-ai-prs.mjs`, `classifyPr`) defaults `requiredCheck = 'test'` and skips any pull request whose `test` check is not green, so a pull request on a base where `test` never runs waits forever with no error. `we:scripts/pr-land.mjs` reads the base's actual required-check contexts and treats zero required checks as passed (its `no required checks` result). The drain's `--base=` flag exists but its default is any base.
- **Nobody is opening pull requests against the prototype any more.** `gh pr list --base lane/mechanical-dispatcher --state open` is empty. The last two were #2264 (closed, 2026-09-15) and #2236 (merged, 2026-09-14). Under the operator's 2026-09-21 ruling, prototype work lands by DIRECT PUSH (the build-3717 worker pushed `0f1d0fb8f` that way), verified by the tests the worker's brief names and the tracker-note pre-push guard, not by CI. `we:scripts/operations/poc-land.mjs` is the gated landing path (it runs the item's own tests through `we:scripts/verify-lane.mjs`) but a direct push does not go through it. The mechanical sync merge (`we:scripts/conveyor/poc-branch-sync.mjs`, prototype only) deliberately has no test gate.
- **Precedent for the workaround.** #3674 records PR #2198 landing through the `WE_MERGE_BREAK_GLASS=1` override after the tests were run locally.

## Fork 1 — where the check comes from

- **(a) Run CI on pull requests against the prototype.** Extend both workflows' `pull_request` trigger to include the prototype (a static branch list in the workflow files, since a workflow cannot read `we:scripts/lib/poc-branches.json`). Gives a real, visible check on any pull request based on it (#3653's acceptance). Rejected as the default: the branch's own `check:standards` is not clean (15 errors on the branch tip per the health card #3768 until the catch-up merge lands), so the check would be red on day one; the full sharded suite would run for a base nobody opens pull requests against; and two hardcoded branch lists must be kept in step with the registry.
- **(b) Change the drain to read the base's real required checks, as `we:scripts/pr-land.mjs` does.** Zero required checks on a base then counts as passed. Fixes the silent stall (#3674 candidate b). Rejected as the default: it edits the gate of the ONLY writer to `main` to serve a base that receives no pull requests; a bug in "zero checks counts as passed" (an API error read as zero) would let an unchecked pull request reach `main`. If chosen it must fail closed on any API error and relax only for a base named in the POC registry.
- **(c) [default] Neither: pull requests are not the delivery path for the prototype.** Prototype work lands by direct push, verified locally by the worker's brief (or through `poc-land`'s own tests); each slice gets the full CI at its graduation pull request against `main` (#3443), which is the only place CI is load-bearing. #3674 and #3653 are then closed as superseded by this ruling. Cost: the prototype carries no CI record of its own, and the sync merge stays ungated by design.

*Default (c), because the failure both cards describe needs a pull request against the prototype to happen, none has for a week, and the ruling made the direct push the path; both (a) and (b) spend effort on a path that is not in use. If the operator wants a stray pull request to fail loudly rather than stall, that is the one small guard in Fork 2.*

## Fork 2 — a pull request opened against the prototype anyway

Only matters under (c). What should the drain do with it?

- **(a) [default] Skip it with a named reason** (`base is not main`), so it shows as held instead of silently waiting. One line in `classifyPr`, or the runner passing `--base=main`.
- **(b) Leave it as today.** It stalls with no message, which is the defect #3674 was filed for.
- **(c) Close it automatically.** Rejected: a human may have opened it on purpose.

## Concrete code to read before ruling

`we:.github/workflows/ci.yml`, `we:.github/workflows/review-gate.yml`, `we:scripts/merge-ai-prs.mjs` (`classifyPr`, `isRequiredCheckGreen`), `we:scripts/pr-land.mjs` (the required-check read), `we:scripts/operations/poc-land.mjs`, `we:scripts/lib/poc-branches.mjs`.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*run-ci-on-the-prototype-branch*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for both forks).
2. After the ruling, `gh pr list --base lane/mechanical-dispatcher --state open` shows no pull request waiting on a check that cannot run (under (c): the drain reports any such pull request as held with the named reason, and #3674 and #3653 are resolved as superseded).
