---
kind: story
size: 8
status: open
blockedBy: ["1137", "2128"]
humanGate: { kind: setup, what: "Recruiting the external team, running the 6-week engagement, and writing the retro's continue/churn verdict are outbound business-development + human-judgment actions — no agent has the relationships, credentials, or standing to sign an external company to a pilot, and the engagement runs in the adopter's own codebase outside this repo. Same shape as #554 (founder go/no-go) and #907 (npm-publish ceremony). Clears when the retro (Done-when below) exists and #2129 is resolved citing it." }
dateOpened: "2026-07-02"
tags: []
---

# Gate-A external pilot adopter: one criteria-bound production pilot incl. a generated-artifact leg

The constellation's first external-evidence instrument, ratified by #2089 Gate A. Recruit ONE external team (not an open beta) building a production-bound JS/TS surface: >=3 FUI blocks + >=2 WE intents, consuming only published artifacts (via #2128), no insider support. Required generated-artifact leg: >=1 gen-wrapper artifact for an EXISTING emit target (react/vue) — new-target stacks are out of scope (Fork 2 gates those on this pilot). 6-week window; >=5 filed issues or a gap report; written retro with a continue/churn verdict incl. the generated-artifact leg. The retro is Fork 2(a)'s bootstrap un-gate evidence; a failed pilot re-opens #2089, never silently un-gates.

## Prep note (2026-08-15) — prepared as a human-gated item, not a code-build story

Verified against the live tree: both blockers are still `status: open` — #1137 (public gated deploy; the human
DNS/`workers_dev=false` step is the sole residual, `humanGate: deploy`) and #2128 (pilot-scoped artifact
publish; itself `blockedBy: ["907"]`, whose own `humanGate: setup` is an un-run npm-publish ceremony). So this
item cannot start yet regardless of anything below. But the deeper finding is that **once both blockers clear,
#2129 still isn't agent-workable** — every remaining step is a real-world human/business action (see
`humanGate` above), so it was missing the encoding that keeps a cleared-but-human-only item out of the ordinary
agent-selectable pool (we:docs/agent/backlog-workflow.md → "Human gate"). Added here. Design decisions,
acceptance, tasks and delivery shape below are the rest of the checklist, adapted for an item whose executor is
a person, not a builder session.

## Done when

- [ ] One external team is recruited (not an open beta) and signs on to build a production-bound JS/TS surface.
- [ ] That surface adopts **>=3 FUI blocks + >=2 WE intents**, consuming only the pilot-scoped artifact set
  published via #2128 — no constellation-insider support beyond what those published artifacts + docs provide
  (that absence *is* the test).
- [ ] The **generated-artifact leg** is exercised: the surface consumes **>=1 forward-generated wrapper**
  (fui:tools/gen-wrapper) for an **existing** emit target (react or vue). A stack requiring a **new** target
  (Svelte/Angular/etc.) is out of scope for this pilot — recruiting one would self-deadlock against Fork
  2(a)'s own start-gate, which this pilot's retro is meant to un-gate (#2089's ratify-turn fix).
- [ ] The engagement runs a **6-week window** measured from the adopter's first integration commit.
- [ ] Over that window, either **>=5 issues are filed** against the constellation **or** one **written gap
  report** is produced.
- [ ] A **written retro** is produced with an explicit **continue/churn verdict** and reasons, including a
  dedicated section on the generated-artifact leg.
- [ ] #2129 is resolved **citing the retro** — it is Fork 2(a)'s bootstrap un-gate evidence (every *new*
  polyglot-widening item takes `blockedBy: ["2129"]`, per
  we:docs/agent/platform-decisions.md#forward-target-start-gate). A **CHURN** verdict does **not** resolve this
  into a silent un-gate: it re-opens #2089 as a normal reversal turn instead (per #2089's own text).

## Decided design — no open fork on this card

The pilot's shape was already decided and ratified in #2089 (Gate A); this card executes that decision, it
does not carry a live one. Restated so a reader doesn't have to open #2089 to know what "the criteria" are:
one external team · production-bound JS/TS surface · >=3 blocks + >=2 intents · published-artifacts-only
consumption (#2128) · generated-artifact leg pinned to an existing emit target · 6-week window · >=5 issues or
a gap report · a written retro with a continue/churn verdict. Per the preparation checklist's item 4 (a real
fork must be named, never silently picked): #2089 already named and ratified this fork (Gate A "GO" vs "stay
internal-only," the latter refuted in-section) — there is nothing left to re-litigate here.

**Size basis (8):** not a code-complexity estimate — the size reflects a real 6-week external engagement plus
the up-front recruiting effort and the retro-writing pass, not a line-count or file-count proxy.

## Scope, consumers, and interfaces — explicitly none

This item's resolution touches **zero files in this repo**. Its Done-when facts are entirely external-world
facts (an outside company's decision to integrate, their shipped surface, their filed issues, a written retro)
— not a diff any gate here can check. So checklist items 1 and 5 resolve to a stated N/A rather than a silent
omission:
- **No `scope:`** — nothing to declare; the artifact-publishing surface a pilot consumes is #2128's scope,
  already carved out as its own item (that carve-out is what keeps this card free of a hidden agent-doable
  slice — verified by re-reading #2128's body, which already exists specifically to make "published artifacts"
  satisfiable).
- **No interfaces/protocol** — there is no code seam this item owns. The one real interface a pilot touches
  (the published package surface) is #2128's contract, not this one's.

## Tasks (ordered; all human-executed)

1. Wait for both prerequisites: #1137 (public gated deploy live — human DNS step) and #2128 (pilot-scoped
   artifact set published — itself blocked on #907's human npm-publish ceremony).
2. Identify and recruit **one** external team matching the criteria above; before signing, confirm their
   planned stack is satisfiable by the generated-artifact leg's existing-target pin (react/vue) — the
   self-deadlock #2089's ratify-turn skeptic pass already flagged and fixed by pinning the leg.
3. Onboard them to the pilot-scoped artifact set (#2128) with no constellation-insider support beyond it.
4. Track the 6-week window from their first integration commit; log filed issues (target >=5) or prepare a
   gap report if fewer land by the window's end.
5. At the 6-week mark (or on early exit), write the retro: continue/churn verdict + reasons + a dedicated
   generated-artifact-leg section.
6. Resolve #2129 citing the retro. If CHURN, reopen #2089 as a normal reversal turn — never resolve this card
   as if it silently un-gated Fork 2.

## Delivery shape

Cannot land incrementally behind `main` — there is no code to merge for this item's own acceptance. The single
deliverable is the written retro artifact at the end of a real 6-week external engagement; "done" is a document
carrying a verdict, not a diff. The item resolves in one step (task 6) once that retro exists, not through a
series of PRs.
