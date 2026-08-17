---
bornAs: xh56pz3
shortTitle: "Constitution curation + form"
kind: decision
size: 3
tier: pinned
parent: "2527"
status: open
dateOpened: "2026-07-19"
preparedDate: "2026-08-16"
tags: [plateau-loop, console, constitution, spec, curation, design-forks]
---

# Constitution curation + form — which core principles vs specs, and derived-index vs artifact

Carved from [#2561] F4 (ruled 2026-07-18): F4 ratified the **principle** — the constitution is the FEW big
core principles, the specifics become *specs* (§3b split), no duplication — but deferred the **form**. The
**same-day sibling [#2564] Fork 5** (ratified 2026-07-19, never cross-referenced with F4 — the conflict filed
as #3144 on 2026-08-16) adds a hard constraint the form choice must now satisfy: whichever form wins, an edit
to the constitution tier has to be **identifiable as such**, because Fork 5 gates that edit with a
substantively-entrenched ceremony strictly harder than the ordinary statute `review:human` gate — exempt from
#911 supersede-with-lineage, a cooling period measured in days, a committed external record
(`we:docs/agent/platform-decisions.md#spec-is-schema-human-gates-spec:2981-2984`). This item settles **form**
(the one live fork below, now read against that constraint) and provides a **researched candidate set** for
**membership** (a curation task, not a fork — see below), so the F4 mechanism is fully realized and Fork 5's
entrenchment gate has something concrete to attach to.

**`blockedBy: ["2561"]` removed as stale.** #2561 resolved 2026-07-19 (its own Ruling section records F4 as
"PRINCIPLE RATIFIED, FORM DEFERRED" to *this* item by name). This item was actually unblocked — and
un-prepared — the whole time; flagged by the #3144 reconciliation item filed 2026-08-16.

## What to decide
- **Form** (the fork below) — (a) a hand-curated **pointer index** tagging a subset of the existing
  `we:docs/agent/platform-decisions.md` anchors as constitution-tier, injected as a build-time derived compact
  projection (F4's already-ratified mechanism, extended from per-item scope to corpus scope) vs (b) a
  standalone hand-maintained constitution artifact.
- **Membership** — a curation task once form is picked, **not itself a fork** (see "Membership candidates,"
  below): which of the ~119 existing statute anchors are constitution-tier (few, invariant, cross-cutting) vs
  stay ordinary law/specs. The constitution stays deliberately small.
- **Injection** — **already settled**, not re-decided here: F4 (a) ratified a build-time derived compact
  projection as the injected form, with the exact prompt-wiring mechanics deferred to #2444/#2530
  (`we:backlog/2561-console-substrate-and-contract-forks.md:280-289`). This item's Fork 1 default extends that
  *same* mechanism from a per-item `constitution:` index to a corpus-level index — no new fork.

## Why #2564 Fork 5 changes the stakes here (the #3144 conflict)

#2564 Fork 5 entrenches a **constitution amendment** as strictly harder than an ordinary statute change:
exempt from #911's supersede-with-lineage, a days-long cooling period, a committed external record
(`we:backlog/2564-adopt-spec-based-programming-across-the-constellation-schema.md:462-473`). Today
`we:docs/agent/platform-decisions.md` is gated as one undifferentiated file: `STATUTE_PATHS` in
`we:scripts/lib/review-escalation.mjs:70-73` matches the **whole file** (`/^docs\/agent\/platform-decisions\.md$/`)
and routes every edit to the *same* `review:human` gate (`we:scripts/lib/review-escalation.mjs:41`) — there is
no existing mechanism that distinguishes a constitution-tier anchor (needing Fork 5's heavier ceremony) from an
ordinary statute anchor (needing only `review:human`) within that file. #2564's own codified text confirms the
constitution is a **small subset** of the statute, not the whole file — "the FEW big core principles" vs "the
specifics become specs" (F4) — so Fork 5's entrenchment cannot mechanically attach to
`we:docs/agent/platform-decisions.md` as a whole; it needs a way to *identify* which anchors are
constitution-tier. **That identification mechanism is exactly what this item's Fork 1 has to produce** —
#3144's reconciliation note frames it as "form (a) needs to explain what 'amending the constitution' even
means if the constitution has no standalone body" (worked out below), or "form (b) needs to be revisited...
given #2564's Fork 5 wasn't in view when F4 was ruled" (also addressed: Fork 5's three entrenchment clauses
turn out not to require a standalone body at all — see Fork 1).

## Fork 1 — Corpus-level constitution form: tagged pointer index vs standalone artifact

*Fork exists (forced invariant, same test [#2561] F4 already applied at the per-item scope, re-run here at
corpus scope now that Fork 5 raises the stakes): the excluded branch — **author a standalone, hand-maintained
constitution document whose body separately states the core principles' prose** — is *broken* on the same
precedent-consistency ground F4 already ruled: it stands up a second authoring home for prose that already
lives in `we:docs/agent/platform-decisions.md`, the drift `we:docs/agent/platform-decisions.md#single-authoring-sot-derived-projection`
forbids, *regardless of sync state* (`we:backlog/2561-console-substrate-and-contract-forks.md:271-278`). The
question this fork actually re-opens is narrower than "artifact vs index" in the abstract: **does #2564 Fork
5's entrenchment requirement force a standalone body after all** (the thing #3144 flagged as unexamined)? Run
through, it does not — see the default's reasoning below — so F4's precedent-consistency holds and the fork
resolves the same way, now with the mechanism spelled out. **What this fork actually rules on** (load-bearing
for the fresh-context screen, below) **is whether a second authoring home for core-principle prose exists —
not where bytes physically sit.** That is the same reframe F4's own screen already needed and passed at the
per-item scope (`we:backlog/2561-console-substrate-and-contract-forks.md:332-337`: flagged impl, fixed by
ruling on "the observable contract... deferring the prompt-wiring mechanics"): the existence of a second
writable surface is what a reviewer, a drift audit, or a downstream consumer can observe and be burned by; the
literal file path holding the pointer index is not.*

- **(a) No new authoring home: a hand-curated pointer index tags a subset of existing statute anchors as
  constitution-tier; injected as a build-time derived compact projection (F4's mechanism, extended to corpus
  scope).** **DEFAULT.** A new small file (e.g. `we:docs/agent/constitution-index.json`) holds **only anchor-id
  pointers** into `we:docs/agent/platform-decisions.md` — never copied rule text, exactly the shape F4 already
  ratified for a per-item `constitution:` field (`we:backlog/2561-console-substrate-and-contract-forks.md:306-311`:
  "pointers into the statute layer — never copied rule text"). **Read that file name as illustrative, not
  ruled — [#3144] Fork 1 settles *where* the index lives (note added 2026-08-17: a cross-reference, not a
  change to this fork's ruling).** That prep surfaced the governance cluster #2771/#2839/#2840, which this
  item does not cite: `we:docs/agent/constitution-index.json` would match **no** pattern in the escalation
  roster and so would be agent-clearable, whereas the `POLICY_SPEC` declarative leash is human-gated and
  permanently whole-file pinned. This fork's ruling — a pointer index, no second authoring home — holds
  either way; only the home is [#3144]'s call. The prose for every tagged principle stays
  exactly where it already lives; nothing moves. **This resolves the entrenchment question directly:** Fork 5's
  three clauses are process properties, not storage properties — (i) *exempt from #911* is enforced by
  `we:scripts/lib/review-escalation.mjs` reading the index to recognize a diff hunk under a tagged anchor's
  heading and routing it to the entrenched path instead of ordinary `review:human`; (ii) *cooling period* and
  (iii) *committed external record* are process steps the drain/reviewer runs on that recognized path,
  unrelated to where the anchor's prose is stored. None of the three requires the tagged prose to live in a
  file of its own — "amending the constitution" simply means *editing a tagged anchor*, identified by the
  index, not by document boundary. The index's *length* is also the concrete answer to "how few is FEW": the
  file stays small because the index stays small (F4's discipline is enforced by the index being auditable at
  a glance, not by the anchors being physically separated). **Two amendments folded from the skeptic pass
  (below), both closing a real hole, not a cosmetic fix:** (1) **self-referential closure** — the index file
  itself is constitution-tier by construction: an edit that adds, removes, or reorders a tagged anchor id
  routes through Fork 5's *own* entrenched ceremony, never the ordinary path, or membership could be laundered
  by de-listing a principle, editing its prose normally, then re-listing it, two ordinary edits standing in for
  one unratified amendment; (2) **stacking, not replacing** — Fork 5's ceremony is *additional* to, not a
  substitute for, the existing file-level gate: `we:scripts/lib/review-escalation.mjs`'s `STATUTE_PATHS`
  already routes *every* `we:docs/agent/platform-decisions.md` diff to ordinary `review:human`
  (`we:scripts/lib/review-escalation.mjs:70-73`); a diff that additionally touches a tagged anchor (or the
  index itself, per (1)) escalates *further*, past that floor, to the full entrenched ceremony. Untagged
  anchors keep exactly today's single gate; nothing about this fork loosens the existing statute floor.
- (b) Author a standalone, hand-maintained constitution artifact (e.g. `we:docs/agent/constitution.md`) that
  separately states the core principles' prose, either as the sole copy (relocating prose out of
  `we:docs/agent/platform-decisions.md`) or as a duplicate alongside it. *Rejected, same ground F4 already
  ruled plus one now-checked new one:* it is a second authoring home for prose the statute layer already owns
  (single-authoring-SoT, unaffected by sync state) — a diff to a duplicate `we:docs/agent/constitution.md` is drift the moment
  the original anchor is also touched, exactly the 64%-case-law-only failure mode
  `we:docs/agent/platform-decisions.md` exists to prevent (`we:docs/agent/platform-decisions.md:12-15`). **The
  Fork-5 check that could have flipped this — "maybe entrenchment forces physical separation so the amendment
  gate has one clean file to lock" — does not hold:** Fork 5's mechanism gates the *edit event* (a diff
  touching a tagged anchor), not a *file boundary*; a lock/ceremony keyed on file identity is no more or less
  enforceable than one keyed on an anchor-id in an index, and the file-boundary version pays the drift cost
  while the index version does not. A **generated** (never hand-edited) single-file rendering of the tagged
  anchors for human/UI consumption (e.g. for [#2571]) remains available under (a) as a future,
  separately-buildable emitter — it does not resurrect (b), because a generated rendering is a *projection*,
  not an authoring home (same relationship F4's per-item "derived compact projection" already has to the
  statute).

**Why this survives even a zero-cost/zero-drift hypothetical (the fresh-context screen's exact test, folded
in):** imagine drift were impossible and both forms were maintained by magic, free. (b) still needs an answer
to *who resolves two simultaneous, independently-authored edits to the same principle* — a hand-maintained
copy and its origin are, by construction, two independently-writable surfaces; "always perfectly synced"
either presupposes an arbiter (one drives the other, which **is** (a) plus a rendering step, not actually
(b) anymore) or is incoherent (two unmediated writers cannot both be authoritative on a single edit event, no
matter how fast the sync). (a) never needs that arbiter because there is only ever one writable surface. So
the merit gap is **structural (how many independent decision-points exist for one rule)**, not a
drift/maintenance-cost artifact — it does not evaporate under the magic-world test, it just becomes visible
that "true (b)" was never actually on the table as a distinct, coherent option. The one genuine consumer-facing
cost the magic-world test correctly surfaces — a human wanting to read the principles as one document rather
than jumping through an index — is not sacrificed under (a): the generated-rendering emitter above gives that
exact experience without reopening a second writable surface.

```jsonc
// Fork 1 (a) — we:docs/agent/constitution-index.json: pointers ONLY, never copied rule text (F4's shape, corpus scope).
{
  "anchors": [
    "constellation-placement",                 // we:docs/agent/platform-decisions.md:133 — WE holds zero implementation
    "primary-read-only-lanes-only",             // we:docs/agent/platform-decisions.md:67  — every change lands via lane→PR
    "agent-convergence-independent-validation", // non-author invariant / segregation of duties
    "single-authoring-sot-derived-projection"   // we:docs/agent/platform-decisions.md:1470 — one authoring home, ever
  ]
}
// we:scripts/lib/review-escalation.mjs (extension, not built here): a diff hunk falling under a TAGGED anchor's
// `### ... {#id}` heading routes to the Fork-5 ENTRENCHED path (exempt from #911 supersede, cooling-in-days,
// committed external record); a hunk under any OTHER platform-decisions.md heading keeps today's ordinary
// `review:human` (we:scripts/lib/review-escalation.mjs:41).
// (b) excluded — we:docs/agent/constitution.md, hand-authored prose duplicate: a second authoring home for text
// that already lives in platform-decisions.md, drifting the moment either copy is edited alone.
```

**Known occurrences:** F4 already ratified this exact shape one scope down (per-item `constitution:` index +
derived compact projection, `we:backlog/2561-console-substrate-and-contract-forks.md:280-303`) — this fork is
that same mechanism generalized from "which anchors does *this item* inherit" to "which anchors *are* the
constitution," not a new design. GitHub Spec Kit's `constitution` file and Anthropic's Constitutional AI are
the precedents for a *named principle layer* (cited in #2564's own research,
`we:reports/2026-07-18-spec-based-programming-deep-research.md`) — neither precedent is evidence for
*physical* separation specifically; Spec Kit's file is itself just a checked-in pointer-and-prose doc in a
framework with no pre-existing statute layer to point into, which the constellation already has.

`Skeptic:` **SURVIVES-WITH-AMENDMENT.** A throwaway skeptic sub-agent was run against this fork with the
four-axis prompt (classification, merit, statute-overlap, citation-scope), told to default to "this default
is wrong." Findings: (0) *classification* — no clean miss, but flagged that the (a)/(b) framing silently
assumes the tag-membership list is itself protected without saying so — folded below, it wasn't a
classification error so much as an incompleteness. (1) *merit* — **found a real hole (REFUTED as originally
stated, patched):** nothing in the original default text put the index/tag file's *own* edits under Fork 5's
ceremony, so membership could be laundered — de-list a principle via ordinary review, edit its now-unprotected
prose, re-list it, two ordinary edits standing in for one unratified constitutional amendment. **Amendment
folded:** added self-referential closure — the index file is constitution-tier by construction (see the
default's text above). (2) *statute-overlap* — **found a real gap (patched):** the original text didn't state
whether Fork 5's ceremony *replaces* or *stacks on* the existing file-level `STATUTE_PATHS` → `review:human`
gate that already fires on any `we:docs/agent/platform-decisions.md` diff. **Amendment folded:** stated
explicitly as additive/stacking, never a replacement — the existing floor stays for every anchor, tagged
anchors escalate further. (3) *citation-scope* — flagged that F4's own ruling text says "PRINCIPLE RATIFIED,
FORM DEFERRED," i.e. F4 explicitly punted the corpus-level mechanism to *this* item rather than deciding it —
so citing F4 as settled authority for the diff-to-tag routing *mechanism* (rather than for the no-duplicate-
prose *principle*, which F4 did settle) overclaimed. **Corrected:** the item now cites F4 only for the
principle + the per-item pointer-index *shape*, and states plainly that the corpus-level routing mechanism is
this item's own new content, not something F4 already decided.

`Screen:` **flagged(prio) → fixed.** A fresh-context two-confusion screen (separate agent, no visibility into
this session's authoring) ran the standard two questions. Q1 (impl-detail vs standard-side): answered clear on
its own — this rules on an operator/reviewer-observable contract (which edits require the entrenched ceremony
vs ordinary human review, visible at the PR-label layer), not a hidden implementation detail; it also
independently surfaced that a human's ability to read the principles as one document is a real
consumer-facing property worth weighing. Q2 (merit vs prioritization) was **flagged**: under a magic
zero-cost/zero-drift hypothetical (both forms instantly, perfectly maintained forever for free), the screen
found the original default's argument — framed entirely around drift risk and duplicate-maintenance cost —
evaporates, which is the signature of a cost/prioritization call dressed as a design fork. **Fix folded into
the fork above (not a cosmetic dismissal):** added the "why this survives even a zero-cost hypothetical"
paragraph — the real, non-cost merit gap is *structural*, not maintenance-cost: a hand-maintained (b) is either
(i) driven by an arbiter, which collapses it into (a) plus a rendering step, not a distinct option, or (ii) two
genuinely independent writable surfaces, which cannot both be authoritative on one simultaneous edit event no
matter how fast any "sync" runs — magic-fast sync cannot manufacture an arbiter that doesn't exist. That
argument does not evaporate under the magic-world test. **The Q1-adjacent readability finding is closed, not
dismissed:** the generated-rendering escape hatch already in (a)'s design gives the same single-document
reading experience without reopening a second writable surface, so nothing is actually traded away.

A **fresh-context re-screen of this fix** (a separate agent, the same two questions, re-asked against the
amended text) confirmed Q2 clear — the structural arbiter argument holds even when the re-screen tried hard to
recast it as cost-avoidance — but flipped and **re-flagged Q1(impl)**: both options, it argued, deliver an
identical consumer-facing experience (tiering, ceremony, single-document readability via the rendering
escape hatch), so the choice reads as "where a byte of metadata sits," which is implementation altitude, not
governance altitude. **This is the exact same shape of flag F4's own screen raised and resolved at the
per-item scope** (cited above) — the fix is the identical reframe, applied here rather than dismissed: the
fork is **not** ruling on file placement, it is ruling on **whether a second independently-writable authoring
surface for core-principle prose is allowed to exist at all** — a property a reviewer, a `check:standards`-
style drift audit, and any downstream consumer (`we:scripts/check-standards.mjs`'s own stated job, "keep the
spec … and the implementation in sync") can observe and be burned by, exactly as F4 already established one
scope down. Restated on that footing, both re-screen passes concur: Q1 clear (an authoring-home-count rule is
standard-side governance, not plumbing) and Q2 clear (the structural, non-cost merit gap holds). `Screen:`
**flagged(prio), then flagged(impl) → both fixed** by (1) the zero-cost structural-arbiter argument and (2) the
F4-precedented reframe from "where do bytes sit" to "does a second authoring home exist."

## Membership candidates (research, not a ruling)

Membership fails the standing fork-existence test — there is no single excluded branch; it is a partition
exercise over ~119 existing anchors against #2564's own bar ("FEW big core principles... cross-cutting" vs
"specifics... become specs," ratified in F4). So this is authored as **researched candidates for the ratifying
human to confirm, edit, or reject** — not a `## Fork N` with a pick. #2564's own codified text already names
three qualifying themes when describing what the constitution *is* — "core principles — non-author invariant,
WE-holds-zero-impl, segregation of duties" (`we:docs/agent/platform-decisions.md:2967-2968`) — which these
candidates are checked against, across every existing anchor:

| Candidate anchor | Why it plausibly qualifies (few, invariant, cross-cutting) |
|---|---|
| `we:docs/agent/platform-decisions.md#constellation-placement` (`:133`) | WE holds zero implementation — named by #2564 itself as a constitution-tier example (`:2967-2968`); governs every repo-placement call in the constellation. |
| `we:docs/agent/platform-decisions.md#primary-read-only-lanes-only` (`:67`) | Every change lands via a lane→PR, no exceptions — cross-cutting over every edit-action in every repo, not a per-domain rule. |
| `we:docs/agent/platform-decisions.md#agent-convergence-independent-validation` | The non-author invariant — explicitly named by #2564 as a constitution-tier example (`:2967-2968`); segregation of duties over every review/merge path. |
| `we:docs/agent/platform-decisions.md#single-authoring-sot-derived-projection` (`:1470`) | The drift-prevention principle this very fork leans on; cross-cutting over every derived-artifact question in the constellation (this item's own Fork 1 default is an instance of it). |

**Explicitly NOT candidates (specs, not constitution):** anything scoped to one domain even if important —
e.g. `#we-fui-embed-boundary`, `#brand-on-distinctness`, `#npm-scope-audience-layer` — these are "specifics"
under F4's own split, however load-bearing, because they govern one axis rather than the whole constellation's
conduct. The curation bar is "would removing this make every other rule in the file untethered," not
"is this important."

This table is a **starting point sized to F4's "FEW"** (4 candidates, not a sweep of all 119) — the ratifying
human should treat it as a first pass, not an exhaustive partition; growing it materially should re-trip the
"stays deliberately small" bar this item itself sets.

## Acceptance
The core-principle set is curated from the candidates above (constitution vs specs), Fork 1 is ruled (a vs b)
with the non-duplication invariant explicit, and the injection mechanism is confirmed as F4's existing
mechanism extended to corpus scope (no new build decided here) — so the [#2561] F4 mechanism is fully realized
and [#2564] Fork 5's entrenchment gate has a concrete attachment point. Follow-on: [#3144]'s remaining
quantification work (cooling-period day-count, committed-external-artifact format, the #911 exemption's
script-level mechanism) is explicitly **out of scope here** — it is gated on this item's form ruling and
proceeds after.

## Related
- [#2561] F4 (ratified 2026-07-19) — the principle this item's Fork 1 realizes; F4's per-item pointer-index +
  derived-projection mechanism is the precedent Fork 1 extends to corpus scope.
- [#2564] Fork 5 (ratified 2026-07-19, same day, same session, never cross-referenced with F4 until #3144) —
  the entrenchment requirement that raised the stakes on this item's form call; codified at
  `we:docs/agent/platform-decisions.md#spec-is-schema-human-gates-spec`.
- [#3144] — files the reconciliation gap between #2564 and #2561 F4 and names this item as the place to settle
  form; its remaining quantification scope (cooling-period days, external-artifact format, #911 script
  mechanism) is this item's explicit follow-on, not its own scope.
- [#2571] — plateau-app constitution/spec review UI; a downstream consumer of Fork 1's index + projection and
  a candidate consumer of the generated-rendering escape hatch noted in Fork 1(b)'s rejection.
