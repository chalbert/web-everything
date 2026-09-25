---
bornAs: xsq55yw
kind: task
status: open
scope: ["we:scripts/review-set-label.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# review-set-label: infer --repo from the local checkout instead of refusing

we:scripts/review-set-label.mjs refuses with 'invalid --repo — expected <owner/name>' when --repo is omitted, even when run from a constellation checkout whose origin remote names the repo. Live case 2026-09-25: the operator's /review ceremony on PR #2625 (the clear-human run of we:scripts/review-set-label.mjs with --actor and --reason) from the main web-everything checkout failed until --repo=chalbert/web-everything was passed by hand. Fix in runReviewLabelCli (the --repo parse): when --repo is absent, default it from the cwd checkout (gh repo view --json nameWithOwner, or parse the origin remote), and keep refusing only when neither resolves. Proof required: re-run the same clear-human (or accepted) command WITHOUT --repo on a live parked PR and show before/after output, not only a unit test.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
