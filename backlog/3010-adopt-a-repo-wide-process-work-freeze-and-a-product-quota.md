---
bornAs: xh1d1el
kind: decision
size: 3
status: open
dateOpened: "2026-08-08"
relatedTo: ["2907", "2606", "3012", "3013"]
tags: [governance, throughput, backlog, statute-candidate]
---

# Adopt a repo-wide process-work freeze and a product quota

Decide two related rules that rebalance the board toward the product. The 2026-08-08 delivery review found
~70% of the open board (~305 of 430 items) is process work, and product output fell to +147 lines in the
last week while machinery grew by +38,000. #2907 already proved the freeze shape on a smaller scope ("open
no PR that does not unblock an existing PR"). This decision rules whether that rule goes repo-wide, and
whether a product-quota floor joins it. Un-prepared — run /prepare before ruling.

## Fork A — the freeze scope

Should "no new process item unless it unblocks an existing PR or is on the named load-bearing list" apply
repo-wide, until the review-machinery pile closes?

- **A1 — repo-wide freeze with a named exception list** (the delivery review's recommendation): the only
  admissible new process work is the load-bearing set (verdict ledger #3007, content-pinned accepts
  #2979, proportional review #2948, named operations #3001) plus anything that unblocks an open PR.
  Post-mortem *filing* stays allowed — building the fix waits.
- **A2 — keep #2907's scope** (review pile only): less disruption, but the ~25-item statute-lint tail and
  new prevention items keep entering the queue and competing with product work.

Cost of the freeze: known gate holes stay open longer. The review argues this is acceptable because the
ledger closes the worst class wholesale rather than hole-by-hole.

## Fork B — the product quota

Should a floor share of new lanes be product items, and at what level?

- **B1 — half**: each week, at least half of newly-opened lanes serve product items (~120 real product
  items are open and waiting). Simple to state, easy to check against the board metric (#3012).
- **B2 — no quota, metric only**: rely on the visible ratio to self-correct. Cheaper, but the last month
  shows drift survives being measurable-in-principle; it only stops when something pulls the other way.
- **B3 — quota above half**: fastest reversal, but risks starving the load-bearing process fixes the
  freeze exempts.

## What resolving this produces

A short statute entry (the freeze rule + the quota, if adopted) promoted to
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) with `codifiedIn:` set, and the
board metric (#3012) as the enforcement instrument. Enforcement is operator discipline at item-selection
time first; a deterministic readiness-ranker input is a possible later hardening, not part of this call.
