---
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# STAMP_LOST is documented as refused but no code path refuses it, so an author can self-clear

`decideClearerIndependence` returns `STAMP_LOST` for a PR opened after the #2844 stamp regime began that
carries no `authored-by-actor` marker. Both the module header and `we:scripts/review-set-label.mjs`'s own inline comment
state that this status is REFUSED rather than tolerated:

> `we:scripts/lib/review-independence.mjs:64` — "answers a NEW status, `STAMP_LOST`, that a
> stripped-but-once-stamped PR gets instead of `UNKNOWN_AUTHOR` — refused, not tolerated."

> `we:scripts/review-set-label.mjs:657` — "#3067 WIRED HERE … a post-regime PR with no stamp resolves to
> STAMP_LOST (refused) instead of UNKNOWN_AUTHOR (tolerated)."

**No code refuses it.** The only independence refusal in `we:scripts/review-set-label.mjs` is:

```js
if (to === 'accepted' && independence && independence.status === INDEPENDENCE.SELF_CLEAR) {
```

`STAMP_LOST` appears exactly ONCE in `we:scripts/review-set-label.mjs` — in the comment above — and in no conditional
anywhere in the file. The status is computed, rendered into the durable comment as a ⚠️ notice, and then
ignored by the gate.

## Observed live, twice, today

Both of these cleared with `STAMP_LOST` and the label moved:

- `chalbert/frontierui#43` → `review:accepted` at head `f5c66a9`, comment carrying *"Independence NOT
  established … this is NOT tolerated as unknown-author (#3067)"*.
- `chalbert/web-everything#1956` → `review:accepted`, same status, since **merged to main**.

Both were opened AND cleared by the same agent session. That is precisely the arrangement #2844 exists to
stop being recorded as an independent review. The `SELF_CLEAR` refusal did not fire because it compares the
`authored-by-actor` id to the clearer id, and with no stamp present there is no author id to compare — so the
one case the stamp was introduced to catch is the case that silently falls through.

## Why the stamp was missing at all

Neither PR was opened through `we:scripts/pr-land.mjs`, the home that stamps `authored-by-actor` at open.
They were opened through the GitHub MCP tooling, which writes no stamp. So `STAMP_LOST` here is not a
stripped stamp — it is the conservative reading of a post-regime PR that never got one, which
`distinguishMissingAuthorStamp` cannot tell apart by design. That is the right default; the gap is that
nothing acts on it.

## Done when

1. **Executable** — a `--to=accepted` run against a post-regime PR with no `authored-by-actor` stamp, from
   any session, is REFUSED and changes nothing. Red before, green after.
2. The refusal names the same two real routes the `SELF_CLEAR` message names (the human ceremony, or a
   session that did not open the PR) plus the third that applies only here: repair the stamp with
   `we:scripts/pr-body-edit.mjs --pr=<n> --repair`, then clear from a session that is genuinely not the
   author.
3. A test pins that the refusal fires, so the promise stops living only in prose. The two comments above are
   the exact defect class this repo's own review mandate names: *"a comment that promises something is a test
   with the wrong syntax."*
4. Decide what to do about the two records already written. Neither verdict is wrong on its merits — real
   jurors ran and real findings were fixed — but both are stamped with a clearance the machinery's own
   documentation says should not have been possible. A re-clear from an independent session would make the
   record true; leaving them is a decision, not a default.

## Not this item

Opening PRs through `we:scripts/pr-land.mjs` so the stamp exists. That would remove the trigger for these two PRs and is
worth doing, but a gate that depends on every author remembering to use one tool is the thing this gate was
built to replace.
