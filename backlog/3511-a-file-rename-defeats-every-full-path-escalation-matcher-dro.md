---
bornAs: xzw59we
kind: story
size: 3
status: open
dateOpened: "2026-09-06"
tags: []
---

# A file rename defeats every full-path escalation matcher, dropping humanRequired on statute files

`scoreEscalation` (`we:scripts/lib/review-escalation.mjs`) matches its path predicates against raw git
numstat entries, which render a rename in git's arrow forms rather than as a plain path. Reproduced: the
statute file `we:docs/agent/platform-decisions.md` scores `humanRequired: true`, and the same file **renamed**
scores `escalate: false`, `humanRequired: false`, no reasons. High-anchored prefixes like `^scripts/` survive
the rendering and still fire, so the failure is selective and silent. `plainDiffPath` is applied only to
`diffHunksBasisFiles`.

## Done when

1. **Executable** — a unit test over `scoreEscalation` (`we:scripts/lib/review-escalation.mjs`) asserting that
   a renamed `we:docs/agent/platform-decisions.md` — in BOTH of git's rename renderings, the braced form and
   the bare arrow form — still scores `humanRequired: true` with the statute reason, exactly as the
   un-renamed path does. Red before, green after.
2. Every path predicate scores over `plainDiffPath`-normalised entries, not just `diffHunksBasisFiles`.
3. The false comment in `we:scripts/merge-ai-prs.mjs` citing `newPathFromNumstatEntry` — a function that exists
   nowhere in the repo — is corrected to name the real normaliser.

## Why this one first

The other escalation gaps cost a wasted cycle. This one silently removes a **human** review requirement from
the statute, declarative-leash and contract files, which is the one class where `humanRequired` is the whole
point. The evasion needs no privilege and leaves no trace: rename the file in the same commit that edits it.
