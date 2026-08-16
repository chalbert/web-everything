# #3055 prep — closing contributor-blindness in review independence

Prior-art + codebase-grounding pass for [backlog/3055](/backlog/3055-review-independence-is-blind-to-contributors-a-session-that-/),
which the capture-only item left open: the independence check compares only `authored-by-actor` (stamped once
at PR-open) against the live clearer id, so a third session that commits to the branch after open and then
clears it reads as `independent`.

## Industry prior art — this exact gap is already solved elsewhere, git-natively

- **GitHub branch protection — "Require approval of the most recent reviewable push."** When enabled, an
  approval is invalidated (and a new one required) if the approver is also the author of the most recent push
  to the branch — i.e. GitHub already refuses to let the *last pusher* count as an independent approver, purely
  from git push provenance, not from a session/account comparison layered on top.
- **Gerrit — "Code-Review" label reset on a new patch set,** plus the standing convention (enforced by several
  large projects' `PreSubmit` checks, e.g. Chromium's CQ) that the uploader of the latest patch set cannot
  self-`+2`. Same shape: the check is keyed off *who pushed the latest commit*, read from the review tool's own
  patch-set metadata — which Gerrit maintains natively, because every patch set is already tied to an uploader
  account.
- **The common thread:** every shipped implementation of "don't let a contributor clear their own fix" reads
  provenance that is captured **at commit/push time**, not reconstructed after the fact. None of them retrofit
  identity onto a git author field — GitHub and Gerrit both have first-party account-per-push tracking. WE does
  not (see below), which is the real gap.

## Codebase grounding — the two building blocks this needs already exist, built for other purposes

1. **A `gh pr view --json commits` read of every commit's authors + `Co-Authored-By` trailers is already
   production code**, not a new I/O pattern to invent: `we:scripts/merge-ai-prs.mjs#isAiCommit` (`:304-309`)
   and `#isAiAuthor` (`:244-249`) already parse `commit.authors[]` (`{name, email}`) for every commit on a PR,
   including co-authors, to decide if a PR is AI-generated. The "clearer must fetch the branch" cost the item
   names is real (it does add a network round-trip `decideClearerIndependence`'s current callers don't pay),
   but it is not new machinery — it is the same `gh pr view --json commits` shape `we:scripts/merge-ai-prs.mjs`
   already calls and tests.
2. **A local git-hook chokepoint that fires on every push, regardless of how the push was invoked, already
   exists and is already wired.** `we:scripts/guard-git-push.mjs` is a `pre-push` hook — `we:.githooks/pre-push`
   + `core.hooksPath .githooks`, set by the `prepare` npm script (`we:package.json:7`) — and its own doc
   comment explains exactly why a hook is the right chokepoint: "a git `pre-push` hook fires on EVERY push
   regardless of how it was invoked (agent, script, or terminal)." `we:.githooks/` also already carries
   `pre-commit` (a locus-prefix lint) and `post-merge` (a skills-deploy sync) — the wiring pattern for *adding*
   a new hook (`commit-msg` or `prepare-commit-msg`, to append a session-id trailer) is proven three times over
   in this same directory, not a new pattern.

## The finding that reshapes the item's own Option (2)

The item's own text is right that reusing `authored-by-actor` for a second, accumulating stamp is destructive
(`parseAuthorActorId`'s agreement-or-nothing collapses two *different* stamps to `''`). But tracing the
question one level deeper — *where would the session id that a new marker accumulates actually come from* —
shows Option (2) cannot stand alone. Git commits carry no session identity today (confirmed against
`we:scripts/pr-land.mjs` and `we:scripts/lib/review-independence.mjs`'s own header: "every commit on
`lane/3032-operation-engine`... is authored with the repo owner's own `name <email>`"). So *any*
contributor-tracking mechanism first needs a NEW write that captures "this commit belongs to session X" **at
commit time**, because that fact exists nowhere else to recover it from later. Once that write exists (a
`Session-Actor:` trailer via a new commit-time hook — the natural place, mirroring `we:scripts/guard-git-push.mjs`'s
wiring), reading it via `gh pr view --json commits` (mirroring `we:scripts/merge-ai-prs.mjs`) is a complete,
self-sufficient mechanism on its own. A *second* write that mirrors the same fact into the PR body/comments
(the item's literal Option 2) only saves one already-cheap `gh` call at clear time, at the cost of a second
write path, a second failure mode (the mirror going stale relative to the trailer), and a new marker key +
parser to build, test, and keep in sync. It does not stand as an independent mechanism — it is a caching layer
over Option 1's trailer, not a coequal alternative.

## Conclusion feeding the item's Fork 1

Bold default: **enforce, via a new commit-time session trailer + a branch read at clear time (Option 1's
shape)** — cheapest fully-grounded mechanism, reuses two already-shipped patterns in this exact codebase, and
matches how GitHub/Gerrit close the identical gap natively. Full fork writeup, tradeoffs, code shape, and the
skeptic/screen verdicts live in the item itself.
