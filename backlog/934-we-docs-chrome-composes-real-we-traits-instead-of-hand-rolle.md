---
type: idea
workItem: epic
parent: "777"
status: resolved
blockedBy: ["932"]
dateOpened: "2026-06-18"
dateResolved: "2026-06-18"
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# WE-docs chrome composes real WE traits instead of hand-rolled behavior

> **Resolved 2026-06-18 (batch-2026-06-18).** All six slices landed — #941 (shadow-safe `nav:section`),
> #942 (boot the webbehaviors registry in mode-C chrome), #943 (`nav:menubar` coordinator trait), #944
> (sectioned-nav composes `nav:section`), #945 (disclosure-nav composes `nav:menubar`+`nav:section`,
> `wireDisclosure()` deleted), #946 (regression guards assert trait composition; 16/16 nav e2e). The
> chrome blocks are now trait-marked templates the registry wires — the rendered nav genuinely exercises
> the standard, restoring #777's "site as conformance proof" premise. Blocker #932 resolved.

The #865/#931 chrome renders correctly but is a **weak conformance proof**: its blocks hand-wire interaction
behavior imperatively, re-implementing WE traits (`nav:section`, `nav:list`) that already exist. So the
dogfood currently proves "FUI can render a nav," not "WE's standards stack composes one" — undercutting
#777's "site as conformance proof" premise. This epic reworks the chrome so it **composes the real traits**
via the webbehaviors registry: chrome blocks become trait-marked DOM templates, the registry wires behavior,
and the rendered site genuinely exercises the standard. Blocked on #932 (whether mode-C boots the registry).

## Why (grounding, researched 2026-06-18)

- `disclosure-nav`/`sectioned-nav` hand-roll `addEventListener` for a pattern shipped as the registered
  `nav:section`/`nav:list` traits (`fui:blocks/navigation/`). Single-source-of-truth violation, twice over.
- The registry runs over shadow roots already (`CustomAttributeRegistry.upgrade(ShadowRoot)`); the only thing
  missing is the decision + wiring to boot it in mode-C — that is #932.
- This epic is the *build* that #932's ruling unblocks; it does not re-decide the seam.

## Sliced 2026-06-18 (`/slice 934`) — umbrella for #941–#946

**#932 ruling applied:** boot the registry & compose (Fork 1=A); no boundary issue (website≠standard,
`we:docs/agent/platform-decisions.md` `#we-fui-embed-boundary` rule 6); registry lifecycle **leans shared**.
Sliced against the real frontierui tree (report `we:reports/2026-06-18-backlog-split-analysis.md`) — confirmed
this epic is **NOT a pure rebuild**: it carries a genuine new coordinator-trait build (#943). Six slices:

- **#941** (task) — Shadow-scope `nav:section` lookup (`fui:blocks/navigation/NavSectionBehavior.ts:47` → `getRootNode()`-scoped);
  `nav:list` already shadow-safe. Precondition. *Root.*
- **#942** (story·2) — Boot a lean shared-per-page `CustomAttributeRegistry` in `fui:embed/chrome-in-document.ts`
  (`upgrade`/`downgrade` on mount/teardown). *Root.*
- **#943** (story·5) — Build the horizontal-menu coordinator trait (sibling-exclusive · outside-click/focus
  dismiss · responsive gating · Escape+refocus) — the genuinely new build. *blockedBy #941.*
- **#944** (story·2) — Rebuild `sectioned-nav` onto `nav:section` (no coordinator). *blockedBy #941, #942.*
- **#945** (story·3) — Rebuild `disclosure-nav` as a trait template; delete `wireDisclosure()`.
  *blockedBy #941, #943, #942.*
- **#946** (task) — Update the #931 regression guards to assert trait composition. *blockedBy #945, #944.*

**Could-not-split → carved to #947 (parked decision).** "Reconcile the `navigation` intent" buries a fork:
WE's intent→conformance is build-time only (`we:webtraits/intentProfileResolver.ts`), with **no runtime
conformance gate** — so "compose the intent meaningfully" would either fake a tie (forbidden) or silently
expand into building a gate (a separate epic). It is **not** in this epic's `Done when`. → #947 decides
*build the gate, or rule intent-reconcile out of scope.*

## Done when

- The mounted chrome's disclosure behavior is driven by the registered `nav:section`/`nav:list` traits (no
  per-block `addEventListener` for those patterns), verified by Playwright (behavior intact: open/Escape/
  outside-click) **and** a unit assertion that the traits are bound.
- `disclosure-nav`/`sectioned-nav` carry no hand-rolled behavior code; the conformance value is real.
- Aligns with #933's compose-not-hand-roll invariant (this epic is its first real application).

Supersedes the *behavioral* half of #931 (whose hand-rolled `disclosure-nav` is explicitly interim). Sliced
2026-06-18 into #941–#946 (with #947 carved out as a parked decision) once #932 ratified.
