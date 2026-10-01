---
bornAs: xkcp5vc
kind: story
size: 3
status: resolved
scope: ["we:scripts/lib/gh-app-shim.mjs", "we:scripts/lib/__tests__/gh-app-shim.test.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Keep gh shim fallback calls visible when the throttle checkout disappears

The host has 162 generated shims whose throttle target is missing. Their direct fallback authenticates with the shared App cache and writes no spend record. Preserve compatibility while capturing sanitized cost and fallback provenance independently of the missing module graph.

## Evidence and fix design

See we:reports/2026-09-30-unmetered-app-graphql-spend.md. The installed shim inventory contains 177 scripts, of which 162 reference missing throttle files. Source we:scripts/lib/gh-app-shim.mjs:321 directly executes the real gh when its throttle target or imports disappear; fresh cached App auth survives while accounting does not. The shared shim target currently exists. No incident-hour fallback count or active use of the stale shims was established; this is a proven latent coverage defect, not a quantified historical spender.

Provide a stable minimal metering transport independent of disposable checkout module graphs. Preserve compatibility fallback, sanitized response-cost/unknown-cost capture, caller and installation provenance, and one execution per command. Regenerate through the shim owner and check adoption without deleting files still referenced by live sessions. This extends the fallback explicitly deferred by #4375.

## Done when

1. Tests remove the throttle entry and a transitive import separately, then prove one underlying gh invocation and a sanitized fallback ledger record for each.
2. Working throttle paths remain byte-compatible and do not double-count nested records. An unrelated command failure never causes replay.
3. A supervised disposable-checkout probe proves fallback observability and active PATH adoption without printing credentials or modifying production credentials.

## Follow-ups

Run we:scripts/lib/__tests__/gh-app-shim.test.mjs and we:scripts/verify-lane.mjs. Measure actual fallback executions separately from stale files. No production fallback was deliberately triggered during this diagnosis. Filed unqueued for review.

Implementation: we:scripts/lib/gh-app-shim.mjs embeds the existing pure response parsers and auth/resource classifiers into each generated shim. The fallback writes one allowlisted ledger row per actual attempt, with fallback reason, caller, nested invocation link, auth source, installation ID when known, and response cost or explicit unknown cost. Cache records without installation metadata remain unknown. The generated transport imports only Node built-ins at runtime; healthy throttle execution keeps its existing byte relay and accounting. Ledger append failure warns without replaying the command.

Disposable adoption proof: we:scripts/lib/__tests__/gh-app-shim.test.mjs regenerates through `ensureGhShim`, removes the disposable throttle entry or its dependency separately, and starts a shell whose PATH resolves bare `gh` to that surviving shim. Each run proves exactly one underlying invocation, preserved binary output, sanitized ledger contents, and known/unknown cost. Additional cases cover healthy throttle, unrelated command failure, caller-requested debug output, and nested spend deduplication. The probe uses synthetic credentials and a local fake executable; no production credentials or installed session shims are changed. This proves adoption in the supervised disposable process, not adoption by existing production sessions.

Validation follow-up: the complete targeted suite passes 70 of 72 tests; the two existing parent-process attribution assertions fail because the sandbox denies `/bin/ps` with `EPERM`. An unmodified HEAD shim reproduces the parent-script failure. No assertion was weakened. The default `node we:scripts/verify-lane.mjs` cannot write its marker under we:.git in this sandbox; its supported `run` mode completed with a temporary admission root: 200 files passed, five failed; 8,734 tests passed, ten failed, eleven skipped. Eight failures depend on the denied process table (two shim, three restart-reader, three stuck-session checks). One socket test times out with an uncaught `listen EPERM`, independently reproduced by a local bind probe. One transcript test passes when rerun with `ANTIGRAVITY_JUDGE_TRANSCRIPT_DIR` set to a writable temporary directory. The gate remains red; rerun on a host allowing these operations before integration. The full standards scan passes with zero errors (4,540 existing warnings), and the final scoped scan also passes. The final seven-case disposable probe passes, including resource classification and nested spend deduplication. Resolved through `node we:scripts/operations/run.mjs resolve --ref=4653`; no commit, push or PR was made.
