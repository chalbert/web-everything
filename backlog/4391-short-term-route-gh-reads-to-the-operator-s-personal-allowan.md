---
bornAs: xhcgdce
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
tags: []
---

# Short-term: route gh READS to the operator's personal allowance, writes stay on the App

The whole fleet shares ONE GitHub App installation GraphQL budget (5000 pts/hr) and it has been exhausted 3+ times in one day. Split gh READS (pr list/view/checks, api GET, run list/view, search) onto the operator's personal GitHub identity's separate 5000/hr allowance at runtime via gh auth token, read through the real gh binary (bypassing we:scripts/lib/gh-app-shim.mjs's generated shim), passed via env to the child only and never logged; every WRITE (comment/label/ready-draft/merge/review) stays on the App so bot-attributed actions are unchanged. Explicit MVP cut per 4385: classify via a conservative read allowlist added to we:scripts/lib/gh-throttle.mjs, unknown classification defaults to write/App; missing/invalid personal token falls back to the App transparently. Explicit SUNSET: remove the split once cost capture (4375) and the PR ledger (webhook-fed local PR state, epic #4281-#4284) cut read spend below ~50% of one 5000/hr budget for a week, with a health smell reporting the split's own read/write usage so the sunset is measurable.

## Design

**Problem.** Every dispatched agent and the conveyor daemon call `gh` through the generated App shim
(`~/.claude/github-app-token/gh-shim/gh`, rendered by we:scripts/lib/gh-app-shim.mjs), which authenticates
every call as the ONE GitHub App installation token. That installation shares a single 5,000-point/hour
GraphQL budget across the whole fleet, and it has been driven to 0 three-plus times in one day — every
mutation (comment, label, ready/draft, merge, review) blocks fleet-wide until the hourly reset, because reads
and writes spend from the same bucket.

**Mechanism.** The operator's own `gh` CLI login (`gh auth token`, read from gh's own local credential store)
is a SEPARATE GitHub identity with its OWN separate 5,000/hour allowance. we:scripts/lib/gh-throttle.mjs is
already the one chokepoint every shimmed `gh` call passes through (`runGhCliPassthrough`, wired in via
`WE_GH_THROTTLE_GH_BIN` — #4064), and it ALREADY keys its shared primary-budget-exhaustion block per
auth-identity+resource (`ghAuthIdentity`/`budgetBlockPath` — confirmed: a `ghs_`-prefixed token hashes to
`app`, any other token hashes to its own `t-<sha256-prefix>` bucket, so a personal token already gets an
independent block from the App's). This item adds exactly one thing: a conservative READ classifier, and
routing that swaps `GH_TOKEN` to the operator's personal token — for a classified read only, and only for
the one child-process env passed to that `gh` invocation — before the call reaches `runGhCliPassthrough`'s
spawn. Nothing about the App identity's own path changes for a write.

**Classification (conservative allowlist, unknown → write/App):**
- `gh pr list` / `gh pr view` / `gh pr checks` — read
- `gh api <path>` with no explicit non-GET/-HEAD `--method`/`-X` and no `-f`/`-F`/`--field`/`--raw-field`/
  `--input` (the same mutation-shaped-flag rule we:scripts/lib/gh-throttle.mjs's existing `classifyGhWrite`
  already uses for `gh`'s own POST-inference behavior) — read
- `gh run list` / `gh run view` — read
- `gh search ...` — read
- anything else (`pr comment/edit/merge/ready/create/review`, `issue *`, `label *`, `run cancel/rerun`, an
  `api` call with a mutating method or field flag, and anything this list does not name) — write → stays on
  the App, unconditionally, even if a personal token is available.

**Token acquisition.** `gh auth token`, run against the REAL `gh` binary (never the shim itself — recursion
guard reuses the shim's own resolved absolute path, the same one `WE_GH_THROTTLE_GH_BIN` already carries),
with `GH_TOKEN`/`GITHUB_TOKEN` stripped from that one child's env first (gh's own documented precedence:
an env token wins over the stored login, so leaving them set would just hand back whatever token this
process already has instead of the operator's personal one). The token is passed to the classified-read
child's env ONLY — never written to `process.env`, a file, stdout, or any log/telemetry line (every existing
log site in we:scripts/lib/gh-throttle.mjs already avoids raw tokens, e.g. `ghAuthIdentity`'s hash — this
item keeps that discipline, not loosens it).

**Fallback (transparent, no waiver).** Missing personal token (not logged in, `gh auth token` fails) → no
override, the call proceeds exactly as it does today (App). A personal token that IS present but rejected
(`HTTP 401`/`Bad credentials`, mirroring we:scripts/lib/gh-app-shim.mjs's own `looksLikeAppTokenAuthFailure`
check) → one automatic retry of the SAME call on the original (App) identity, so a stale personal login
degrades to today's behavior instead of failing the call outright.

## Explicit MVP cut (card 4385 rule)

**In scope:**
- The read/write classifier and the token-swap routing, inside `runGhCliPassthrough` (the shim's own call
  path — covers every dispatched session and the conveyor daemon with no per-call-site migration, exactly
  like #4064's own wiring).
- Falling back transparently on a missing or rejected personal token.
- A health smell reporting the split's own read/write call counts per identity (measures the sunset below).
- Live proof against real `gh api rate_limit` for both identities.

**Explicitly OUT of scope (follow-up, not silently dropped):**
- Migrating the ~78 not-yet-migrated `gh` call sites (#3670's own remaining slice) onto this routing — only
  calls that already pass through the shim/`runGhCliPassthrough` benefit today.
- Extending the split to the importable `runGhSync` adopters (we:scripts/lib/review-label-provider.mjs,
  we:scripts/conveyor/ci-queue-watch.mjs) — those mostly write; revisit if a read-heavy adopter shows up.
- A persistent per-process cache invalidation on a rejected personal token (today: falls back per-call,
  re-attempting the personal token on the NEXT call too — acceptable at MVP call volumes; a repeatedly-bad
  token costs one extra local, no-network `gh auth token` shell-out per read, not an extra GitHub request).
- Rebalancing the concurrency cap / points-per-minute / write-budget gates by identity — those are
  secondary-burst protections, host-wide by design; this item only splits the PRIMARY hourly quota.

## Explicit SUNSET

This is a short-term operational patch, not a durable architecture decision. Remove it once BOTH:
1. Cost capture (4375) is landed and reporting real spend, AND
2. The PR ledger (webhook-fed local PR state, epic #4281–#4284) is landed and reads are answered from local
   state instead of live `gh` calls for the read shapes it covers,

and the health smell below has reported read spend under ~50% of one 5,000/hour budget for a full week
running. At that point this card's routing is dead code to delete, not a permanent fixture — file the
removal as its own follow-up item at that time rather than leaving it to be rediscovered.

**Health smell (makes the sunset measurable):** report the split's own per-identity call volume (reads
routed to personal vs. App, writes on the App) from we:scripts/lib/gh-throttle.mjs's existing `calls.jsonl`
sidecar log (already recording `caller`/`w`/outcome per call — this item adds the resolved identity to that
same line) so a later read can answer "is the split still earning its keep" without new instrumentation.

## Done when

1. **Executable** — a test proves: (a) a classified read call, with a personal token available, spends
   against the personal identity's budget bucket, not the App's; (b) the SAME call with the App's primary
   budget already exhausted for the App identity is NOT blocked, because its bucket is separate; (c) a write
   call is unaffected by an available personal token (still spends/blocks on the App identity); (d) a call
   whose shape is not on the allowlist defaults to write/App even if it doesn't mutate anything the
   classifier knows about; (e) a missing or rejected personal token falls back to the App transparently, with
   one retry on rejection. Fails before this item's routing lands, passes after — no waiver.
2. **Live proof** — `gh api rate_limit` for both identities before/after a few daemon ticks, showing reads
   draining the personal account's bucket while the App's stays flat (or recovers), and a live write in the
   same window still shows the bot/App as the actor.
3. **Health smell** — the per-identity call volume is visible from `calls.jsonl` without new tooling.
