---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [check-standards, review-integrity]
---

# check:standards — a backlog body asserting third-party test-runner semantics must carry an adjacent citation

Add a `check:standards` rule over `backlog/*.md`: a body that asserts the **runtime semantics of a third-party test runner** — `it.fails`, `it.todo`, `describe.skip`, `--shard`, `stryker`, and the like — must carry an **adjacent citation** grounding the claim: a `we:` locus, a `node_modules/…` path, or a URL to the runner's docs. A behavioral claim about someone else's tool that no one ran is exactly the kind of premise that sends a builder down the wrong path.

## Prevents (PR #998 finding 2)

The #998 spec claimed spec tests could land `it.fails`-annotated and be "green in CI because declared pending." A probe under `vitest run` refuted it: `it.fails` over a **passing** body hard-fails with `Expect test to fail` (`Tests 1 failed`), so an already-satisfied ratified invariant would turn the required `test` check red — the opposite of the claim. Requiring an adjacent grounding citation (a recorded probe result, a docs URL) forces the assertion to be checked before it is filed.

## Acceptance

- A backlog body asserting one of the named runner semantics with **no** adjacent `we:` locus / `node_modules/…` path / URL errors, naming the token.
- A citation adjacent to the claim clears it.
- Unit fixtures for a flagged case, a cited (cleared) case, and a false-positive guard (the token in prose that is not a semantics claim). Green on the current tree.
