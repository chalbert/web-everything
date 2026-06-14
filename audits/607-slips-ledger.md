# #607 — Slips ledger (retrospective conformance sweep)

> Judgment layer on top of `audits/backlog-health-audit.md` (deterministic sweep, 596 items).
> Method: deterministic flags → multi-agent judgment against guiding-principle catalog A–E →
> **adversarial verification** of every candidate slip (refute-by-default). Generated 2026-06-14
> for backlog #607. **No code changed, no item reopened** — this is a findings ledger only.
> Every confirmed current-state fix is filed as its own backlog item (column 5), never applied here.

## Headline

The audit's real yield is **how few real slips survived verification, and that the verification
layer was load-bearing**: of the 3 G3 "confirmed slips" the judgment layer produced, adversarial
refutation **killed 2** (a governing decision existed in prose / one epic-hop up that the
frontmatter-only tool could not see) and **downgraded the 3rd** from slip to drift. All 7 G2 hits
and all 9 D1 hits were artifacts. Net **zero clean slips**; the substantive findings are **pre-rule
mis-allocations** (decisions made correctly for their era, now reframable) and **current-state
drift** (data that no longer matches reality). The largest deliverable is the
[audit-improvement log](./607-audit-improvement-log.md) — the tooling, not the backlog, is what
this run most exposed.

## Tag legend

- **slip** — rule applied at the time the item resolved; work missed it (a real defect).
- **pre-rule** — item predates the rule (rule ratified after `dateResolved`). Not a fault.
- **drift** — conformant when shipped; the project moved since. Not the item's fault.
- *(no defensible tag → dropped; not listed.)*

## Findings (judgment-confirmed, post-verification)

| # | pool / kind | tag | violated rule | finding (evidence) | current-state fix |
|---|---|---|---|---|---|
| **#353** | G3 / placement | **drift** | E:decisions-are-work-items + D:placement | Minted a new project (`weblifecycle`) **and** protocol (`lifecycle`) inline from exercise-app work, same-day open+resolved, no governing `type:decision` anywhere — its own body lists the placement as an open question. *Verification:* real, but the carve-rule ("a fork lives in a `type:decision`, never inline") was introduced in the **same commit** that created #353 already-resolved → drift against an emerging norm, not a clean slip. | **#616** — retroactively ratify the weblifecycle project+protocol placement (mirrors #467). No reversal of #353. |
| **#045** | strictness / fake-invariant | **pre-rule** | A:most-flexible-default / dimension-vs-fixed-mechanic | DC-2 baked `shadow="open\|closed\|none"` as the sole authoring spelling while **conceding** the native DSD `shadowrootmode` is legitimate ("1:1 platform familiarity"), holding it only "as a possible future alias." The `open\|closed` sub-axis is exactly 1:1 with `shadowrootmode`; only the light-DOM `none` case justifies `shadow=` as the *default*. *Verification:* most-flexible-default + the doc codification postdate the 2026-06-08 resolution → pre-rule; but the alias-withholding is a real lapse with a live fix. | **#615** — recognize `shadowrootmode` as an accepted alias of `shadow=` (mirrors same-batch #046 default+alias). Authoring vocabulary only. |
| **#023** | strictness / decision-epic-conflation | **pre-rule** | E:no-decision-epic-conflation | Frontmatter is `type: decision` **and** `workItem: epic` simultaneously — the canonical shape the later rule forbids (opposite lifecycles). | none — resolved 2026-06-10, before the rule landed (#382 / 2026-06-13/14); all four contracts already ruled. Noted as the exemplar the rule now catches. |
| **#107** | strictness / fork-is-prioritization | **pre-rule** | E:fork-is-not-prioritization | Fork 2 ("Tier-1 self-run first; hosted broker deferred") branches on delivery timing / operational burden, justified by "a solo founder should not take on hosted uptime at concept stage" — a sequencing call, not a best-end-state fork (open-core wants both ends). | none — predates the rule (#465, 2026-06-13/14; #107 resolved 2026-06-11); the end-state was identified correctly. |
| **#183** | strictness / fork-is-prioritization | **pre-rule** | E:fork-is-not-prioritization | Fork (b) "which MoR" leans primarily on build-effort saved ("Lemon Squeezy's license-key API collapses most of #182 into a thin webhook wrapper") to choose between two legitimate merchant-of-record end-states. | none — predates the rule; the branch also carries genuine merit (developer-tool fit, Stripe-acquisition longevity), so it survives even with the cost stripped. |
| **D3 ×4** | drift / stale-project | **drift** | — | `webadapters` (39 resolved, 10 adapters), `webintents` (23 resolved, 50 intents + surface), `webblocks` (43 resolved, 63 blocks + surface), `webvalidation` (12 resolved, plugs runtime) are still `status: concept` in projects.json despite substantial shipped work. | **#617** — graduate the four project statuses to what their shipped surface warrants. Data fix. |

## Refuted / cleared (the value of verification — these are *not* findings)

| candidate | why it cleared |
|---|---|
| **G2 ×7** (#21,#26,#27,#29,#35,#54,#135) | All **date artifacts**: backfilled / born-resolved-at-import frontmatter, false `blockedBy` lineage (#23 isn't the governor), or a correctly-deferred forward-ref (#135 shipped route-only with `blockedBy:[129]`). 0 real built-ahead-of-ruling. |
| **#355** webdecisions | Governed by **decision #409** (resolved 2026-06-12), which names "decision #355" and rules its Project+Protocol allocation correct. Prose link the frontmatter-only tool can't walk. |
| **#357** webaudit | Governed by the **#314 exercise-app charter** ("WE is the deliverable… when uncodified, propose a new standard"); sibling discoveries #350/#351 minted projects through the same governed path. |
| **~40 other G3 architectural candidates** | Governing decision exists in prose or one epic-hop up (e.g. capability-matrix #204–#220 under epic #203/#005; MaaS under #087/#088/#463; webnotifications under #009/#455; mock-contract under #107; plateau-app placements under #092/#096; FUI packages under #101/#398/#425). |
| **D1 ×9** | Every hit a tool false-positive (assertion-of-absence, will-create/planned file, runtime-output, shorthand/dir-relative or slash-joined enumeration). Zero true dead-refs. |
| **G1 ×104** | ~90% PROSE_PREREQ regex noise; **0 slips**. Two soft-edge drift notes only (#604→#398, #109→#91). |
| **#228 / #278** (plugs-layer) | Left to the in-flight **#606** plugs-ownership thread — not a separate finding. |

## Notes

- The single most actionable current-state lapse is **#045 → #615** (a conceded-legitimate native
  spelling withheld). The headline **#353 → #616** is governance hygiene (drift), not a defect in
  shipped behavior.
- The D3 project-status drift (**#617**) is the only finding touching live data; `webplugs` was
  correctly excluded (intentionally `concept` pending #606), `webcases` is too thin to graduate.
