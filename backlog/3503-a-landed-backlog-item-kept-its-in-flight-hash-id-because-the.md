---
bornAs: x1l3exg
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# A landed backlog item kept its in-flight hash id because the drain only JIT-numbers manifest-carrying PRs

`we:backlog/3502-a-card-resolve-pr-can-land-before-the-impl-it-names-in-gradu.md` is on `main` with a hash
id. `we:docs/agent/backlog-workflow.md` says a hash-prefixed file is in-flight and a numeric one has landed,
so a landed hash-keyed card contradicts a documented invariant — its short ref and URL stay provisional
forever. The drain's JIT numbering (#2288) runs off the couple manifest, and a hand-opened PR carries none.

## Done when

1. **Executable** — a check that fails on a landed (on `main`) `we:backlog/` file whose id is still the
   `xNNNNNN` hash form. Red against the current tree while `3502` remains hash-keyed, green once numbered.
2. The existing item is numbered, or the rule that lets it stay hash-keyed is written down where the
   backlog-workflow doc currently asserts the opposite.

The invariant is already stated in `we:docs/agent/backlog-workflow.md` — *a hash-prefixed file is an in-flight
item that hasn't landed yet; a numeric one has landed* — so today's tree contradicts a documented rule.
