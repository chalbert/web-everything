---
bornAs: xgcpi2v
kind: decision
status: open
dateOpened: "2026-08-16"
tags: [constitution, spec, governance, reconciliation]
---

# Reconcile #2564's constitution-tier artifact with #2561 F4's rejection of a standalone constitution doc, then quantify the amendment-entrenchment gate

A 2026-08-16 build pass attempted to create the constitution-tier artifact #2564 calls for and found
a **direct, unreconciled conflict with a same-day sibling ratification (#2561 F4)** that explicitly
names a standalone constitution file as the broken/excluded branch. No artifact was built — this item
files the reconciliation + the follow-on quantification work instead.

## The conflict, precisely

- **#2564** ("Adopt spec-based programming…", ratified 2026-07-19, codified at
  [`we:platform-decisions.md#spec-is-schema-human-gates-spec`](../docs/agent/platform-decisions.md#spec-is-schema-human-gates-spec))
  specifies a federated **constitution → law/spec → implementation** hierarchy. It treats the
  constitution as something with independent existence: Fork 5 gates *amending* it with a
  substantively-entrenched ceremony (exempt from #911 supersede-with-lineage, a cooling period,
  a committed external record) — language that presumes a distinct artifact/event to entrench.
  It names no file.
- **#2561 F4** ("Console substrate & contract forks," also ratified 2026-07-19, same day) rules
  the opposite on artifact-vs-index: *"Fork exists (forced invariant): the excluded branch —
  **author a standalone constitution artifact** (a new, hand-maintained `CONSTITUTION` doc that
  copies rules) — is **broken**: it stands up a second authoring home for rules that already live
  in the statute layer… This holds regardless of sync state."* The ratified default (a) is a
  **build-time derived compact projection** — an index of pointers into
  `we:docs/agent/platform-decisions.md` / the WE standards / `we:AGENTS.md`, regenerated at build
  time, never a hand-authored artifact.
  - The item's own top-of-file "Ruling" summary is more equivocal than the fork body: it records
    F4 as **"PRINCIPLE RATIFIED, FORM DEFERRED"** — the few-core-principles/no-duplication
    *principle* is settled, but *which form* (derived index vs standalone artifact) and *which
    principles* were explicitly **delegated to a follow-up decision**, filed the same session as
    the `constitution-curation-form` item.
- That follow-up is **#2568** ("Constitution curation + form"), `kind: decision`, `status: open`,
  **not yet prepared** (no `preparedDate`). Its `blockedBy: ["2561"]` is now **stale** — #2561
  resolved 2026-07-19 — so #2568 is actually unblocked and ready to prepare, it just hasn't been
  picked up. #2568 explicitly reopens form (a) vs (b) as live: *"(b) back in play now that a
  non-duplicating split defuses its drift objection."*
- **Neither #2564 nor #2561/#2568 cites the other.** `we:docs/agent/platform-decisions.md`'s
  `#spec-is-schema-human-gates-spec` entry (which codifies #2564) makes no mention of #2561/#2568;
  #2561/#2568 make no mention of #2564's Fork 5 entrenchment requirement. They were ratified the
  same day, on the same underlying concept ("the constitution"), by what reads as two separate
  deliberation threads that never crossed.

## Why this is load-bearing, not cosmetic

If #2568 resolves form toward **(a) derived index** (the currently-ratified default in #2561 F4's
fork body), the constitution has **no content of its own to amend** — editing it means editing the
underlying `we:docs/agent/platform-decisions.md` anchors it points at, which already gets the
ordinary statute gate (`review:human`, per `STATUTE_PATHS` in
`we:scripts/lib/review-escalation.mjs`), not the *stronger* entrenchment #2564 Fork 5 ratifies
(irreversibility beyond #911, a cooling period, a committed external record). Fork 5's ceremony has
nothing distinct to attach to under form (a). **#2568's prep pass needs to inherit #2564 Fork 5 as a
hard constraint on the form choice** — form (a) needs to explain what "amending the constitution"
even means if the constitution has no standalone body, or form (b) needs to be revisited with
#2561 F4's single-authoring-SoT rejection squarely re-examined given #2564's Fork 5 wasn't in view
when F4 was ruled.

## What was NOT built (and why)

A `we:docs/agent/constitution.md` standalone artifact — the file this task set out to create — was
drafted, then reverted before landing, once the #2561 F4 conflict surfaced. Landing it would have
been landing the exact "broken branch" #2561 F4 names, pending #2568's live, unprepared decision on
the same question. Building it anyway would have preempted a decision that already has a home.

## Remaining gaps once form/membership resolve (out of #2568's current scope)

Even after #2568 picks a form and curates membership, #2564 Fork 5's amendment-entrenchment gate is
still under-specified for a mechanical build:

1. **No ratified cooling-period day-count** — Fork 5 says "days, not sessions," never a number.
2. **No defined "committed external artifact" format/location** — a `we:reports/*.md` entry, a
   dedicated log, or the PR diff + linked red-team transcript are all consistent with the text.
3. **No script-level mechanism for #911's supersede-with-lineage to exempt this tier from** —
   supersede-with-lineage today is a documented *process* convention
   (`we:docs/agent/backlog-workflow.md` → "A ratified decision is reversible"), not a CLI/script
   gate, so there is nothing mechanical to carve an exemption out of yet.
4. **Whether any project needs its own constitution**, per #2564's federated-scope framing — left
   as a non-blocking open sub-question there too.

## Suggested path

1. **First**, get #2568 prepared and ratified — it already owns "which form, which principles" and
   just needs the prep pass + a note that #2564 Fork 5's entrenchment requirement is now a
   constraint on the form call. Do not re-litigate F1–F4 of #2561; only F4's *form* is reopened by
   its own text.
2. **Then**, a follow-up (this item, revised, or a new one scoped off #2568's resolution) quantifies
   Fork 5's remaining qualitative clauses (cooling-period days, external-artifact format, the #911
   hook) with the same fork-existence + skeptic + fresh-context-screen discipline #2564 itself used.

Not agent-buildable without that human-deliberate pass — `status: open`, no `preparedDate` yet.

## Related

- #2564 (ratified 2026-07-19; codified at
  [`we:platform-decisions.md#spec-is-schema-human-gates-spec`](../docs/agent/platform-decisions.md#spec-is-schema-human-gates-spec)) —
  the constitution-tier + Fork 5 entrenchment source.
- #2561 F4 (ratified 2026-07-19, same day) — rejects a standalone constitution artifact as the
  broken branch; delegates form + membership to #2568.
- #2568 ("Constitution curation + form," `status: open`, unprepared, `blockedBy` stale) — the
  existing item that owns the form/membership call this task was asked to make.
- #2571 (plateau-app constitution/spec review UI) — a downstream consumer of Fork 5's ceremony,
  unaffected by this reconciliation gap but worth revisiting once the ceremony is quantified.
