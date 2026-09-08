---
bornAs: xgewdfr
kind: task
status: open
scope: ["we:scripts/lib/review-skill-guard.mjs", "we:scripts/lib/__tests__/review-skill-guard.test.mjs"]
dateOpened: "2026-09-08"
tags: []
---

# Harden the #2416 review-label code-scan gate against expression-level label indirection (ternary/computed)

we:scripts/lib/review-skill-guard.mjs's checkReviewLabelSingleHomeCode / CODE_SWAP_RE (#2416) catches the ordinary raw-swap re-implementations but a round-2 panel review found it cannot catch a label value expressed as a conditional/ternary or otherwise computed expression at the call site (e.g. add: isHuman ? REVIEW_LABELS.accepted : undefined) — the same class of limitation as the documented variable-indirection residual (no bounded regex traces data flow), deliberately not chased in #2416 to avoid open-ended scope creep on a size-3 item. Decide whether to close it with a structural/token-based scan of call arguments, or formally accept it as a permanent documented limitation (same posture as #2895's actor-provenance residual); if closing it, extend we:scripts/lib/__tests__/review-skill-guard.test.mjs with a ternary/computed-label fixture.

A round-3 pass on the same PR found a second, related shape: the regex's `[^)]` filler between the process call and the `--add-label`/`add:` token cannot skip a `)` at all, so ANY nested function call earlier in the argument list (`String(pr)`, `path.join(...)`, a helper computing the repo slug) silently defeats the match even when the label itself is a plain literal — not obfuscation, just ordinary code. Separately (out of scope for this item, worth its own card if pursued): the file-walk only covers `scripts/**/*.{mjs,cjs}` — a `review:accepted` write minted from a GitHub Actions workflow step or a script outside `scripts/` is invisible to it.

## Done when

1. **Decision recorded** — either (a) `checkReviewLabelSingleHomeCode` is replaced with a structural/token-based argument scan, proven by a new test that catches BOTH a ternary/computed-label fixture and a nested-function-call-in-argv fixture (e.g. `execFileSync('gh', ['pr','edit', String(pr), '--add-label', REVIEW_LABELS.accepted])`) that the current regex misses, or (b) the residual is formally ratified as a permanent, accepted limitation (the same posture as #2895's actor-provenance residual) and this item is resolved won't-fix with that ruling recorded in its body.
