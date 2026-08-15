---
bornAs: xxhnbew
kind: story
size: 3
status: open
dateOpened: "2026-07-18"
tags: []
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/pr-land.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
---

# Gate: new backlog items must be hash-keyed, not hand-numbered

A new backlog file added in an unlanded lane must carry a hash id (xNNNNNN), never a bare NNN — the drain assigns the real number at land (#2288). check:standards accepts NNN because it is valid for LANDED items; that hole let a hand-numbered batch (#558) collide with a concurrent session and trigger the collision-heal that blanked files. Add a deterministic pre-merge check that flags a new/unlanded backlog file with an NNN id as an error, so hand-numbering is a loud failure not a silent collision. Hookable per the hookable-vs-judgment rule.

## Grounded findings

- **The gap is real and still open.** `we:scripts/check-standards.mjs:517-519` only asserts every item HAS
  a leading id token (`if (!item.num) err(...)`) — true for both a landed NNN and a provisional hash, so it
  never distinguishes them. The only NNN-vs-hash cross-check that exists today runs the OTHER direction:
  `we:scripts/check-standards.mjs:523-531` (`strandedHashesOnMain`, #2319) flags a HASH that reached
  `origin/main` — nothing flags the reverse, a hand-typed NNN in an unlanded item. Confirmed by reading both
  the call site and `we:scripts/check-standards-rules.mjs:2104-2139` (`duplicateBacklogNums` +
  `strandedHashesOnMain`, the two existing id-hygiene detectors).
- **The incident is real and correctly cited.** Commit `86fd66fe` ("prevention items for the
  hand-numbering/collision-corruption class") filed this exact item (`bornAs: xxhnbew`) plus two siblings
  after "the #558 incident (hand-numbered ids collided with a concurrent session; the drain collision-heal
  blanked 6 files)": `xgagt89` → landed as **#2546** ("make the drain collision-heal renumber
  content-preserving"), `xgl2ptq` → landed as **#2547** ("batch-scaffold helper"). Both still `open`. This
  item is the strongest of the three — it prevents the mistake, where the other two only limit the damage or
  reduce the temptation to hand-batch.
- **A write-time half already exists and does NOT cover this gap.** `we:scripts/backlog-guard.mjs`'s
  `--pre` hook (added 2026-07-26, commit `98721a2c`, citing this same #2288/#2323) already DENIES a Claude
  Code `Write` tool call that hand-creates a new numeric-NNN file (`we:scripts/backlog-guard.mjs:101-103`).
  But it is a `PreToolUse(Edit|Write)` hook — it only sees Claude Code's own `Edit`/`Write` tool calls. A
  file authored via `Bash` (heredoc / `cat >`), a plain text editor outside Claude Code, or a session with
  the hook disabled/bypassed reaches `git commit` with **zero** check. This card's "pre-merge" ask
  (`check:standards`, the required CI gate) is the tool-agnostic backstop the write-time hook structurally
  cannot be — a second, independent layer, not a duplicate of the first.

## Decided design

Add a pure detector, `handNumberedNewItems(items, mainBacklogPaths)`, to
`we:scripts/check-standards-rules.mjs` — the mirror image of `strandedHashesOnMain` (#2319):

- Build the set of NNN tokens actually present on `origin/main` from `mainBacklogPaths` (the SAME
  `git ls-tree -r --name-only origin/main -- backlog/` listing `we:scripts/check-standards.mjs:527-529`
  already fetches for `strandedHashesOnMain` — reuse it, no second git call, same fail-soft-on-unresolvable
  behavior).
- For every working-tree backlog `item` whose `num` is numeric (`/^\d+$/`), if that exact token is **not**
  in the on-main set, emit one error: this item's number is not used by anything on `origin/main`, so it was
  hand-picked rather than assigned by the drain at land.
- **Match by ID TOKEN, not the full filename.** `we:docs/agent/backlog-workflow.md:45` documents that a
  landed item's slug "may be reworded" — an ordinary edit that changes the filename (new slug, same NNN)
  while the item stays genuinely landed. Matching on the full path would flag that ordinary edit as a fake
  "new hand-numbered item"; matching on the token alone is immune to it.
- Wire it into `we:scripts/check-standards.mjs` inside the existing
  `try { … strandedHashesOnMain(mainBacklog) … } catch { … }` block (`:527-531`) as one more
  `for (const msg of …) err(msg)`.

### De-risking finding: one real false-positive path, and its fix (checklist item 8)

Comparing a NEW item's num against `origin/main`'s ls-tree is not safe unconditionally. I traced every
automated caller that runs `check:standards` against a tree that could legitimately contain a fresh NNN not
yet on `origin/main`:

- `we:scripts/lane-drain.mjs` (`numberPendingHashes`, the JIT-numbering path the normal `/drain` uses) never
  calls `check:standards` at all — no exposure there.
- `we:scripts/pr-land.mjs`'s `runHeal()` (`:1134-1173`, the post-collision-heal self-check, reachable only
  via the already-break-glass `--fallback-git` route) **does**: it `checkout --detach`es to `origin/main`
  (`:1141`), runs `we:scripts/backlog-renumber-collisions.mjs` **without `--dry-run`** (`buildRenumberHealArgs`,
  `:410-414`; the script's own `writeFileSync` at `we:scripts/backlog-renumber-collisions.mjs:157` confirms
  it writes to disk), THEN runs `check:standards` (`:1152`) on that locally-modified, **not-yet-pushed**
  tree — the renumbered item's new NNN provably is not yet in `origin/main`'s ls-tree at that exact moment
  (the commit+push happen only afterward, `:1167-1171`, and only if this `check:standards` call is green).
  Verified by reading the full call order, not assumed.
- `we:scripts/merge-ai-prs.mjs`'s equivalent duplicate-id tripwire (`:3895-3908`, #2318) deliberately does
  **NOT** auto-run the renumber heal ("a human runs `we:scripts/backlog-renumber-collisions.mjs` … by hand",
  `:3901`) — so it never reaches this tree state and needs no change.
- I considered gating the new check on "`HEAD` equals `origin/main`" to tell `runHeal`'s tree apart from a
  genuine producer mistake, and rejected it: a freshly-adopted, not-yet-committed lane (this very lane, right
  after `git reset --hard origin/main`) has **the same** HEAD-equals-origin/main git state as `runHeal`'s
  detached checkout — that signal cannot distinguish the two, and using it would silently blind the check to
  the exact scenario this card exists to catch.
- **Fix: a narrowly-scoped escape hatch, `WE_SKIP_HAND_NUMBERED_GATE`,** in the same family as this repo's
  existing break-glass envs (`WE_MERGE_BREAK_GLASS`, `STALE_LANE_OK`, `LANE_CLOBBER_OK`). Checked only around
  the new `handNumberedNewItems` call in `we:scripts/check-standards.mjs` — never around
  `strandedHashesOnMain` or any other check. `we:scripts/pr-land.mjs`'s `runHeal()` sets it **only** on its
  own `check:standards` `execFileSync` call (`:1152`), with a comment citing this card. No other caller
  needs it.

## Interfaces

```js
// scripts/check-standards-rules.mjs — new export, alongside strandedHashesOnMain
/**
 * @param {Array<{id?:string, num?:string}>} items       loaded backlog items (working tree)
 * @param {string[]} mainBacklogPaths  `backlog/<id>-slug.md` paths tracked on origin/main
 * @returns {string[]} one error per hand-numbered new item (empty when every new NNN is already on main)
 */
export function handNumberedNewItems(items = [], mainBacklogPaths = []) { /* … */ }
```

```js
// scripts/check-standards.mjs — inside the existing try block, ~:527-531
try {
  const mainBacklog = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'backlog/'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  for (const msg of strandedHashesOnMain(mainBacklog)) err(msg);
  if (!process.env.WE_SKIP_HAND_NUMBERED_GATE) {
    for (const msg of handNumberedNewItems(backlog, mainBacklog)) err(msg);
  }
} catch { /* origin/main not resolvable here — fail-soft, same as strandedHashesOnMain */ }
```

```js
// scripts/pr-land.mjs — runHeal(), the ONE execFileSync at ~:1152
try {
  execFileSync('npm', ['run', 'check:standards'], {
    cwd: REPO, stdio: 'ignore',
    // #2548 — this self-check runs on an unpushed, freshly-renumbered tree (checkout --detach at
    // origin/main + the heal's own uncommitted writes) that the new hand-numbered-item gate cannot tell
    // apart from a real mistake by git state alone; the heal IS the sanctioned numbering path.
    env: { ...process.env, WE_SKIP_HAND_NUMBERED_GATE: '1' },
  });
} catch { return { healed: false, renumbered, warning: `id collision healed (${tag}) but check:standards is RED on the healed tree — NOT pushed; fix on ${BASE} by hand` }; }
```

**Size basis (3):** one new pure function + doc (`we:scripts/check-standards-rules.mjs`), a ~4-line wire-in
(`we:scripts/check-standards.mjs`), a ~2-line env passthrough at one existing call site
(`we:scripts/pr-land.mjs`), and one new `describe` block mirroring `strandedHashesOnMain`'s existing test
pattern (`we:scripts/__tests__/check-standards-rules.test.mjs:1735-1751`). No new script, no new
abstraction — same shape as #2319's own addition.

## Tasks

1. Add `handNumberedNewItems(items, mainBacklogPaths)` to `we:scripts/check-standards-rules.mjs`, next to
   `strandedHashesOnMain` — match by NNN token against `mainBacklogPaths`, never by full path.
2. Import it in `we:scripts/check-standards.mjs` and call it inside the existing origin/main `try` block,
   guarded by `WE_SKIP_HAND_NUMBERED_GATE`.
3. In `we:scripts/pr-land.mjs`'s `runHeal()`, pass `WE_SKIP_HAND_NUMBERED_GATE: '1'` on the
   `check:standards` `execFileSync` call, with a comment citing this card.
4. Unit tests in `we:scripts/__tests__/check-standards-rules.test.mjs`:
   - a new item with an NNN not on main → one error naming the item + the fix.
   - a new item with an `xNNNNNN` hash → clean (the correct path never fires).
   - a LANDED item edited with a **reworded slug** (same NNN, different filename) → clean (the
     false-positive this token-matching design specifically avoids).
   - a landed item unmodified → clean.
5. Run `npm run check:standards` on the repo itself (0 errors) and the vitest suite (or the scoped test
   file) to confirm the new cases pass and nothing existing regresses.

## Done when

- [ ] `handNumberedNewItems` exists in `we:scripts/check-standards-rules.mjs`, matches by NNN token (not
      full path), and is unit-tested per Tasks item 4 (all four cases pass).
- [ ] `check:standards` reports an ERROR for a backlog file with a hand-picked NNN id that does not appear
      on `origin/main`, and does NOT error on a hash-keyed new item or a landed item's reworded-slug edit.
- [ ] `we:scripts/pr-land.mjs`'s `runHeal()` sets `WE_SKIP_HAND_NUMBERED_GATE=1` on its own
      `check:standards` call, so the collision-heal's self-check is unaffected by this new gate.
- [ ] `npm run check:standards` is 0 errors on the landing tree.

## Delivery shape

Lands in one PR — one pure function, one call site, one narrowly-scoped env passthrough, and tests; nothing
here is safely separable without leaving the gate half-wired (a check with no wire-in does nothing; a
wire-in with no escape hatch breaks the collision-heal's own self-check). No `blockedBy`.
