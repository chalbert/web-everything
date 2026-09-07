---
bornAs: xn7yaiz
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/lane-drain.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/queue.mjs"]
relatedTo: ["3570", "3567", "3478"]
dateOpened: "2026-09-07"
tags: []
---

# JIT-renumbering never re-keys the conveyor queue sidecar, so a cleared item silently falls out of dispatch under its stale hash

Live-observed 2026-09-07: at least 16 entries in the conveyor's session-local we:.conveyor/queue.json sidecar are still keyed by their pre-JIT-renumbering birth hash (e.g. xyaf9lm, x7nvaq0, xw6814m) even though each item's card was already renumbered to a real NNN when its filing PR landed (confirmed via bornAs: on main and the drain's own `JIT-number <hash>→#<NNN>` land commits). This is the same class of drift a sibling session hand-fixed for #3567 tonight (we:scripts/conveyor/queue.mjs remove x6qdz9n && we:scripts/conveyor/queue.mjs add 3567) but nothing sweeps it systemically. Distinct from #3570 (held already-done items whose real work already landed elsewhere): these items are still genuinely open and ready, just mis-keyed. Traced in we:scripts/readiness/dispatch-plan.mjs's IO shell: the sidecar's cleared set is matched against we:scripts/backlog.mjs build-queue --json rows (keyed by CURRENT numeric id) via we:scripts/readiness/dispatch-plan.mjs#selectClearedRows, with no bornAs fallback — so a stale-hash-keyed entry matches NO ready row, drops out of the launchable set entirely, and instead lands in we:scripts/readiness/dispatch-plan.mjs#clearedNotReady's cleared-but-not-ready held bucket forever. This is DISPATCH-FUNCTIONALLY BROKEN, not cosmetic: a genuinely ready, highest-priority item stays permanently held under its old key. Root cause confirmed in we:scripts/lane-drain.mjs#numberPendingHashes (the sole JIT-renumbering path, 'drain: JIT-number <hash>→#<NNN> at land' commits): it rewrites we:backlog/*.md, we:docs/agent/*.md and we:agent-memory-src/*.md but has no hook that touches any conveyor queue sidecar. That is a genuine architectural fork, not a mechanical one-liner: the drain's own self-hosting boundary decision (we:docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary, #2501) runs the drain from a DEDICATED clone distinct from the operator's primary checkout, and #3478 separately proved live that the conveyor's cleared-set sidecar can legitimately live in yet another checkout entirely (a runner rooted in an ad hoc scratch clone) — so a rekey-at-renumber-time fix inside numberPendingHashes cannot in general reach the sidecar file that actually matters, because the renumbering process has no reliable way to know which checkout(s) hold a live we:.conveyor/queue.json referencing the hash it just renumbered. The alternative — teach the sidecar's CONSUMERS (we:scripts/readiness/dispatch-plan.mjs#selectClearedRows / #clearedNotReady) to resolve a non-matching sidecar id against each candidate item's bornAs frontmatter field before giving up, mirroring the bornAs fallback we:scripts/conveyor/queue.mjs#kindOf already implements for its own kind-check (we:scripts/conveyor/queue-store.mjs's readinessOf lacks this fallback too, a related gap) — needs no cross-checkout coordination at all, since we:scripts/readiness/dispatch-plan.mjs already reads the live backlog directly out of the same checkout it dispatches for. Recommendation: resolve dynamically via bornAs at the consumer (Fork B), not rekey-in-place at JIT-number time (Fork A), specifically because of the demonstrated cross-checkout gap; this fork needs a stated ruling before either gets built.

## The fork

**Fork A — re-key the queue sidecar in place, at JIT-number time.** we:scripts/lane-drain.mjs#numberPendingHashes
already builds the exact `hash → NNN` ledger this needs; teach it (or a step it calls right after committing the
rename) to also open any `we:.conveyor/queue.json` it can find and swap a matching hash entry for the new NNN —
the same edit already hand-proven correct for #3567 (`we:scripts/conveyor/queue.mjs remove x6qdz9n && we:scripts/conveyor/queue.mjs add 3567`),
just made automatic. Cost: the drain's own self-hosting boundary decision
(we:docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary, #2501) runs the drain from a DEDICATED
clone, not the operator's primary checkout — and #3478 independently proved live that the conveyor's cleared-set
sidecar can legitimately live in yet a THIRD checkout (an ad hoc scratch clone the runner happened to be rooted
in). `numberPendingHashes` has no general way to discover every checkout that might hold a live
`we:.conveyor/queue.json` referencing the hash it just renumbered, so this fork can reliably rewrite only a
sidecar that happens to be co-located with wherever the fix runs — it does not close the gap for the common case
where the operator's queue lives elsewhere, which is exactly the case both the motivating incident and #3567's
own manual fix were.

**Fork B — resolve dynamically via `bornAs`, at the sidecar's consumers.** Leave the sidecar's stored id alone
(it may be a stale hash forever) and instead teach the code that MATCHES a sidecar entry against a live backlog
item — we:scripts/readiness/dispatch-plan.mjs#selectClearedRows and #clearedNotReady today, and
we:scripts/conveyor/queue-store.mjs's `readinessOf` for the CLI's own warning — to fall back to a `bornAs:`
match when the id doesn't match any current item's numeric id directly. This is not a new pattern:
we:scripts/conveyor/queue.mjs#kindOf already does exactly this for its own kind-check, so the fallback is proven
in this same file family. It needs no cross-checkout coordination at all, because every consumer already reads
the live backlog directly out of the checkout it is running in — the checkout-discovery problem Fork A runs
into simply does not arise.

## Default (lean — NOT prepared)

**Recommend Fork B.** The cross-checkout evidence is concrete, not hypothetical: #2501 (ratified) and #3478
(resolved, live incident) both establish that the drain's checkout, the conveyor runner's checkout, and the
operator's primary checkout can all legitimately differ, and that mismatch has already caused a real production
incident once (#3478). A fix that lives inside the renumbering step can only ever patch the sidecar(s) it
happens to be co-located with; a fix that lives in the matcher works everywhere, unconditionally, because it
piggybacks on the same live-backlog read every consumer already does for its primary purpose. This is a capture,
not a prepared ruling — no `preparedDate`: prepare it (confirm no third option is preferable, e.g. having
`numberPendingHashes` ALSO best-effort patch the co-located sidecar as defense-in-depth even if Fork B ships)
before ratifying.

Links: #3567 (the hand-fixed instance) · #3570 (the DISTINCT already-done-hold sweep — not this gap) · #3478
(the cross-checkout sidecar-resolution incident this fork's cost analysis rests on) · #2501 (the drain
self-hosting boundary ratification) · #3383 (parent epic).
