---
kind: story
size: 3
parent: "3099"
status: open
dateOpened: "2026-08-14"
tags: [delivery, backlog, readiness, preparation, staleness]
scope:
  - we:scripts/backlog.mjs
  - we:scripts/readiness/prep-staleness.mjs
  - we:scripts/readiness/__tests__/prep-staleness.test.mjs
  - we:agent-memory-src/story-preparation-checklist.md
  - we:docs/agent/backlog-workflow.md
---

# Story preparation gets its own staleness signature: `preparedAgainstSha` alongside the existing `preparedDate`

Operator question, 2026-08-14: should preparation be signed with a version/timestamp so a build can tell if
it was prepared against a stale view of the code, and get an evaluation of whether re-preparation is needed
and to what degree?

**`preparedDate` already exists — this is NOT a new mechanism, it's extending an established one to a kind
that doesn't use it yet.** `we:docs/agent/backlog-workflow.md` (lines 317-432) documents a rich, already-live
staleness discipline for `kind: decision` items: `node we:scripts/backlog.mjs prepare-stamp <NNN>` writes
`preparedDate`, `check:readiness --select` ranks a stamped item `✓ ready to ratify`, and — the load-bearing
part — *"A stale prep is re-prepared before the first presentation... `preparedDate` certifies the research
was current when stamped; if the tree moved since, the bold default may no longer be factual"* (#1935). There
is even a mechanical backstop, `check:health`'s G4 gate, that keyword-scans a stamped decision's forks for
tells that the stamp is false.

**None of this exists for `kind: story` items.** The story-preparation-checklist (this session's own
artifact) has eight items and no stamp at all. `we:scripts/backlog.mjs`'s `prepareStamp()` (:448-459) is
already kind-agnostic — it just splices `status: open` + `preparedDate` into whatever file it's pointed at —
so the CLI plumbing is not the gap. The gap is: (1) nobody calls it for stories, and (2) even if they did,
`preparedDate` alone tells a builder *when* prep happened, not *whether the code it describes has moved
since* — decisions re-verify that by a human re-reading the fork sections fresh at claim time, which works
for a fork's prose but has no story-side analogue, because a story's claims are about concrete `file:line`
facts a machine CAN check.

## Why this is not hypothetical — tonight's own evidence

`#2803`'s preparation was accurate when written and wrong by the time it was independently reviewed: its
design reasoned from a resolve-time model (resolve happens in the producing lane) that the repo moved past
when #2748 landed (2026-07-28, ~2.5 weeks earlier) — the drain now owns that flip. A mechanical "did the
scoped files change since prep" check would not have caught this specific drift (the file that changed,
`we:scripts/lane-drain.mjs`, wasn't in #2803's own `scope:` — it was a separate subsystem the design leaned
on without citing). That is a real, named limit of what this item can promise — see Watch for.

## The decided design

1. **Reuse `preparedDate`, add one new field, don't invent a parallel system.** `preparedDate` keeps its
   existing meaning ("prep considered current as of this date") for both kinds. New: `preparedAgainstSha` —
   the commit prep was verified against — because a story's staleness check is a concrete git diff, which
   needs an anchor commit; a decision's re-verification is a fresh prose re-read, which doesn't.
2. **The mechanical check answers PRESENCE only, never SEVERITY** — the #2607 line already established by
   `#3103`. `we:scripts/readiness/prep-staleness.mjs` reports which of the card's `scope:` files changed since
   `preparedAgainstSha`; it does NOT classify that into "needs a light recheck" vs "needs full re-prep" — that
   stays judgment, same split #3103 already drew for its own risk enum.
3. **Standalone CLI first, not auto-wired into the readiness dispatcher.** Mirrors how the decision-side G4
   gate was ALSO added as a later hardening pass, not shipped day-one with `prepare-stamp`. Keeps this item
   small; wiring `we:scripts/readiness/dispatch-plan.mjs` to refuse launch on a stale-and-unchecked prep is a
   natural fast-follow, explicitly NOT bundled here.
4. **No retroactive migration.** Cards prepared before this ships (including every card prepared tonight)
   simply have no `preparedAgainstSha` and are silently unstaleness-checkable, not flagged as an error.
   Additive only.

## Interfaces and protocol

```js
// we:scripts/backlog.mjs — prepareStamp(), extended (currently :448-459)
// After the existing preparedDate splice, add one more scalar field using the SAME
// setFrontmatterField helper already used for preparedDate (scalar fields only — readField/
// setFrontmatterField are regex-line-based and do NOT handle block lists; preparedAgainstSha is a
// plain string so this is safe, unlike #2803's scope: block-list trap).
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: DIR, encoding: 'utf8' }).trim();
after = setFrontmatterField(after, 'preparedAgainstSha', `"${sha}"`, { after: ['preparedDate'] });
```

```js
// we:scripts/readiness/prep-staleness.mjs — new file
/**
 * @param {{ scope: string[], preparedAgainstSha: string, cwd?: string }} o
 * @returns {{ checked: true, stale: boolean, changedFiles: string[] } | { checked: false, reason: string }}
 *   checked:false when the card has no preparedAgainstSha (nothing to compare) or the sha is unreachable
 *   (e.g. squash-merged and gc'd) — NOT an error, a "can't tell" result the caller must handle explicitly.
 */
export function checkPrepStaleness({ scope, preparedAgainstSha, cwd = process.cwd() } = {}) { ... }
```

CLI: `node we:scripts/readiness/prep-staleness.mjs --item=<NNN>` — reads the card's own frontmatter (`scope:`,
`preparedAgainstSha`) via the existing `we:scripts/backlog/frontmatter.mjs` readers, runs
`git diff --name-only <sha> HEAD -- <scope files>`, prints the changed-file list (or "no drift" / "not
staleness-checked — no preparedAgainstSha"). No new consumer of `scope:`'s parsing beyond what already exists
elsewhere in `we:scripts/readiness/`.

## Tasks

1. Add `preparedAgainstSha` to `prepareStamp()` in `we:scripts/backlog.mjs`, per the interface above.
2. Write `we:scripts/readiness/prep-staleness.mjs`'s pure `checkPrepStaleness` + its CLI wrapper.
3. Test: a card whose scope files are unchanged since the sha → `stale: false`; a card whose scope files
   changed → `stale: true` with the real changed-file list; a card with no `preparedAgainstSha` →
   `checked: false`, not a thrown error; an unreachable/garbage-collected sha → `checked: false` with a
   stated reason, not a crash.
4. Update `we:agent-memory-src/story-preparation-checklist.md`: add item 10, "stamp `preparedDate` +
   `preparedAgainstSha` once items 1-9 are satisfied," referencing the new CLI.
5. Update `we:docs/agent/backlog-workflow.md`'s existing preparedDate section to note the story-kind
   extension exists, cross-referencing rather than duplicating the decision-kind prose.
6. Re-run `we:scripts/readiness/prep-staleness.mjs` against #2803, #2842, #3004, #2787, #3063, #3095, #2351 as a real-corpus
   smoke test, though none carry `preparedAgainstSha` yet (they predate this item) — confirms the
   `checked: false` path is exercised on real cards, not just fixtures.

## Done when

- [ ] `prepareStamp()` writes `preparedAgainstSha` alongside `preparedDate`, verified on a real scaffold.
- [ ] `we:scripts/readiness/prep-staleness.mjs` correctly reports `stale`/`changedFiles` for a card whose scope changed, and
      `checked: false` (not an error) for a card with no `preparedAgainstSha`.
- [ ] The story-preparation-checklist and backlog-workflow docs are updated and cross-referenced, not
      duplicated.
- [ ] Severity classification (how stale is "too stale") is explicitly NOT computed — the tool reports
      presence only, matching #3103's script-decides-presence / judgment-decides-severity split.
- [ ] Per this session's own newly-added checklist item 9: this card's preparation gets independent review
      before anyone builds it — this card does not exempt itself from the rule it exists to support.

## Delivery shape

One piece, additive, no migration. Two small new pieces (one CLI field, one new pure-plus-CLI script) plus
two doc updates.

## Watch for

- **This does not solve #2803's class of drift**, and should not be sold as if it does. A file-diff catches
  "a file in MY scope changed"; it cannot catch "a fact I leaned on, in a file NOT in my scope, changed." That
  residual is real and belongs to consumer-risk / premise-risk judgment, not to this mechanical tool.
- **Don't let the CLI become a gate people route around.** It's a signal for a human/agent deciding whether to
  re-verify, not a blocker — matching #3103's own "must not become a form" warning for the risk enum it
  extends.
- If `we:scripts/readiness/dispatch-plan.mjs` wiring is picked up later as the named fast-follow, it must
  default to WARN not REFUSE on `stale: true` — a false-stale (e.g. an unrelated formatting-only diff to a
  scoped file) blocking a real, still-correct build would be the same false-deny shape #2997's Gap 1 round 1
  shipped and had to walk back.
