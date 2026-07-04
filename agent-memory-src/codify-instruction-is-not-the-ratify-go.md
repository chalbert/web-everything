---
name: codify-instruction-is-not-the-ratify-go
description: "An instruction to do a decision's resolution mechanics (codify/rewrite/clean-up) is NOT the ratify go"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd861edf-ccdb-4265-a724-1b9f1218f99b
---

During a decision session, an instruction to perform the decision's **resolution mechanics** — "codify the rule,"
"rewrite the story," "clean up the shape," "make it impl-neutral" — is **NOT** the ratification authorization. Do the
authoring, keep the item **un-resolved** (`active`/`open`, not `resolved`), and wait for an **explicit** ratify go.
The two are distinct even when the authoring instruction sounds final.

**Why:** hit live on #1989 (2026-07-01) — the user said "codify rule and rewrite the story to avoid implementation
details," I read it as the ratify trigger and flipped the item to `resolved` + wrote the rule into the statute. The
user caught it: "is the story up to date, I haven't ratified yet." A codification/formatting instruction is about
*how the eventual resolution should read*, not *whether to resolve now*. Collapsing them skips the explicit second
`go` the claim → discuss → red-team → ratify arc exists to protect.

**How to apply:** on any "codify / rewrite / restructure the decision" instruction mid-arc, author it into the item
and STOP at un-resolved; present it for review and ask for the ratify go before `resolve` + `codifiedIn` +
`dateResolved`. Reverting a premature ratification means: status back to `active`/`open`, strip
`dateResolved`/`codifiedIn`, revert the statute edit. Sharpens the two-go arc in [[never-take-an-unprepared-decision]]
and [[decision-item-single-source-not-discussion-log]].
