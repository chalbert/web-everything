---
bornAs: x19rb8c
kind: task
status: open
relatedTo: ["2965", "2971"]
scope: ["we:scripts/converge-cli.mjs", "we:scripts/lib/converge-core.mjs"]
dateOpened: "2026-08-07"
tags: [converge, cli]
---

# converge-cli bare boolean flags silently coerce instead of erroring, and a header cites a gate name that does not exist

Two small, verified defects in the converge front door, filed together because both are one-line fixes in
adjacent files. A bare `--transport` / `--care` / `--jurors` (no `=value`) parses to boolean `true` and is
silently swallowed into a default instead of being refused, defeating a fail-closed contract the transport
module explicitly documents; and `we:scripts/lib/converge-core.mjs` advertises its machine-check under a
function name that exists nowhere in the repo. Both found red-teaming the PR #1064 review.

## Bare boolean flags coerce instead of erroring

`we:scripts/converge-cli.mjs` resolves the transport with
`typeof flags.transport === 'string' ? flags.transport : 'working-tree'`. A valueless `--transport` is
`true`, fails the type test, and becomes the default — exit **0**, verified live.

That coercion happens *before* `resolveTransport` is called, so it defeats that function's stated
contract: *"Fails closed: an absent, unknown, or misspelled name returns an error rather than silently
defaulting, because defaulting would silently pick where a revision gets WRITTEN."* The CLI never lets
the fail-closed path see the bad value.

The same pattern applies to two more flags, which is why this is filed as a class rather than a
transport-only nit:

- `--care` — same `typeof … === 'string'` test, silently defaults to `elevated`, exit 0.
- `--jurors` — `Number(true)` is `1`, which passes the `>= 1` integer check, so a typo silently applies
  one juror per lens. Arguably the worst of the three: `1` is a plausible value, so the mistake is
  invisible in the output.

Only `--lane` refuses a bare flag, with exit 2 and an explicit message naming the failure mode. That is
the precedent to match.

## A header cites a gate name that does not exist

`we:scripts/lib/converge-core.mjs` says the declared list is machine-checked by `check:standards`
"rule 16, `checkDeclaredContract`". A repo-wide grep for `checkDeclaredContract` returns only that line —
the real export is `validateDeclaredModuleContract` in `we:scripts/check-standards-rules.mjs`. The "rule
16" numbering could not be verified against any scheme either.

Trivial in isolation, but the block's entire stated purpose is to be the thing a maintainer greps before
changing a shared export. Greping the name it advertises finds nothing.

## Done when

- A valueless `--transport`, `--care`, or `--jurors` exits 2 with a message naming the flag, matching the
  `--lane` precedent.
- The header cites the real exported name (and either a verifiable rule number or none).
