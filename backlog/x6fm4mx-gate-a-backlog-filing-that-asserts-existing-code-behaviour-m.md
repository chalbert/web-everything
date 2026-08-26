---
kind: story
size: 2
status: open
relatedTo: ["2548", "2823"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [backlog, gate, check-standards, filing-quality]
---

# Gate: a backlog filing that asserts existing code behaviour must cite file:line for it

When a filing says *"X already exists"* or *"the release path already checks it"*, an implementer reads that as surveyed fact and builds on it. Nothing checks that it was ever surveyed. Warn on a **new** (hash-keyed, unlanded) backlog item whose body makes an existing-code-behaviour assertion with no `we:path:line`-style citation in the same paragraph, so an unverified infrastructure claim is caught at filing time rather than after an implementer has gone looking for plumbing that does not exist.

## The incident that produced this

`we:backlog/x3884p1-the-lease-reaper-reclaims-a-lane-seconds-after-it-is-acquire.md` shipped this sentence
as its central diagnosis:

> *"…nothing consults holder liveness, which the pool already records: the holder slug carries a pid
> (`Mac:<pid>`), and the release path already checks it."*

Three assertions about existing code, **none cited, all false**:

- `mintHolderSlug` (`we:scripts/lane-pool.mjs:536-538`) mints
  `` `${tag}-${basename(dir)}-${randomBytes(4).toString('hex')}` `` — no pid.
- `Mac:<pid>` is `defaultSession()` (`we:scripts/lane-pool.mjs:526`), a different field, holding the shell's
  `ppid`.
- The release path never tests liveness — `leaseOwnedByCaller` (`we:scripts/lib/lane-lease.mjs:249-255`) is
  slug string equality, and `process.kill` appears nowhere in either file.

Two review rounds were spent on it (chalbert/web-everything#1567, juror finding `false-premise` plus an
independent reviewer confirming it). The failure mode is specific: **the claim was plausible, so it was not
questioned — the citation is what would have forced the author to look.**

## Why a warning on new items only

The prose signal is heuristic, so this must not be an error, and it must not redden the ~1400-warning
baseline by firing retroactively on every landed card. Gate it the way `#2548` gates
`handNumberedNewItems`: a hash-keyed `item.num` (`!/^\d+$/`) means the item has not landed yet
(`we:docs/agent/backlog-workflow.md`, `#2288` — the drain assigns the real NNN at land), so the check sees
exactly the filings still being authored and never an item already on `main`.

## Decided design

Add a pure detector to `we:scripts/check-standards-rules.mjs` and call it from the existing per-item body
linter `lintBacklogItemRendering` (`:757`), which is already wired into **both** the whole-repo gate and the
scoped `check:standards --item NNN` run (`we:scripts/check-standards.mjs:693`) — no new call site.

```js
// scripts/check-standards-rules.mjs — new export
/**
 * Paragraphs of a NEW (hash-keyed) item's body that assert existing code behaviour without citing it.
 * @param {string} body           the item's markdown body
 * @returns {Array<{line:number, quote:string}>}  empty when every such paragraph carries a citation
 */
export function uncitedCodeBehaviourClaims(body = '') { /* … */ }
```

- **Assertion cue** — a paragraph containing `already <verb>s` (`already exists`, `already checks`,
  `already records`, `already does`, `already handles`), or `<something> carries a <field>`. Kept to a
  short, explicit list; broadening it is a follow-up, not this card.
- **Citation cue** — the same paragraph contains a locus-prefixed reference (the `#883` `<repo>:` form the
  repo already lints for), a trailing `:NNN` line number on such a reference, or a fenced code block.
- **Skip** fenced code blocks and blockquotes when scanning for the assertion cue, so a quoted retraction of
  a false claim does not re-trip the check.
- Emit as a **warning**, one per offending paragraph, naming the item id, the body line, and the quoted
  clause.

## Tasks

1. Add `uncitedCodeBehaviourClaims(body)` to `we:scripts/check-standards-rules.mjs`.
2. Call it inside `lintBacklogItemRendering` (`:757`), guarded on `!/^\d+$/.test(item.num)`, pushing to
   `warnings`.
3. Unit tests in `we:scripts/__tests__/check-standards-rules.test.mjs`:
   - hash-keyed item, uncited "the release path already checks it" → one warning.
   - same sentence with `we:scripts/lib/lane-lease.mjs:249` in the paragraph → clean.
   - the claim only inside a blockquote (a retraction) → clean.
   - a numeric-`num` (landed) item with the same uncited sentence → clean.
4. Run `npm run check:standards` on the repo and confirm the warning count is unchanged for landed items.

## Done when

1. **Executable** — the four unit cases in Task 3 pass.
2. **Executable** — `npm run check:standards --item <a hash-keyed item with an uncited claim>` reports the
   new warning; the same body with a citation added reports nothing.
3. **Mutation** — removing the `!/^\d+$/.test(item.num)` guard reddens the landed-item case by name.
4. `npm run check:standards` on the whole repo shows **no new errors and no new warnings** against the
   baseline at build time (the new-items-only gate is what makes this true).
