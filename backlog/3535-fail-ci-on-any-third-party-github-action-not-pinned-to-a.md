---
bornAs: xshapin
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# Fail CI on any third-party GitHub Action referenced by a mutable tag rather than a commit SHA

frontierui#43 added `uses: dtolnay/rust-toolchain@stable` to a required check. `@stable` is a mutable BRANCH
ref: whoever can move it decides what code runs inside a job in this constellation. Four jurors raised it
independently across the security and standards-conformance lenses, and it was the only finding in that run
marked `worseThanBase: true` — the PR did not inherit it, it introduced it.

It was fixed in that PR by pinning the SHA. **Nothing stops the next one**, which is the actual gap: the pin
is a habit, and a habit is not a gate. The same PR's author (an agent) wrote a comment beside the step
claiming the pin matched the `dotnet-version` discipline two lines above, which was false — so the review
round caught both the unpinned action and a confident wrong claim about pinning, in the same three lines.

## Done when

1. **Executable** — a workflow file containing `uses: <owner>/<repo>@<non-SHA>` fails a required check. Red
   before, green after, with a staged violation as the reproduction.
2. Runs in every constellation repo, since the exposure is per-repo: `we`, `frontierui`, `plateau-app`.
   `we:scripts/check-standards.mjs` is the natural home if the rule is ours; `zizmor` or `actionlint`'s
   own pinning rule is the natural home if we would rather not own it — that choice is this item's call.
3. First-party `actions/*` are the one defensible carve-out (GitHub's own, and universally tag-referenced).
   Whether to allow them is part of the ruling; if allowed, the allowance is explicit and named, not implied
   by the regex happening not to match.
4. The existing violations are pinned as part of landing it — a gate that ships red is not a gate.

## Why a lint rather than review

Every reviewer who looked at this PR's workflow hunk saw the same three lines. The two-lens `review-pr` panel
that ran first did NOT flag it; the five-lens convergence panel did, four times over. A property that depends
on which lenses happened to sit is not enforced, and this one is cheap to make deterministic: the shape of a
pinned ref is a 40-character hex string, checkable with a regex over the `uses:` lines.
