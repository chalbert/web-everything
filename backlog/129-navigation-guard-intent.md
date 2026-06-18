---
type: decision
workItem: story
size: 5
status: resolved
codifiedIn: docs/agent/platform-decisions.md#guard-gate
dateOpened: "2026-06-06"
dateStarted: "2026-06-10"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [intent, navigation-guard, beforeunload, unsaved-work, async, ux, harvest]
relatedProject: webintents
crossRef: { url: /backlog/272-guard-protocol-predicate-gated-transitions-and-presence-open/, label: "Guard protocol (#272)" }
---

# Navigation guard — warn before leaving with in-flight or unsaved work (candidate intent)

**Resolved 2026-06-10.** The "navigation guard" framing was too narrow. Talking it through (with a prior-art pass across Angular `CanDeactivate`, Vue `beforeRouteLeave`, React `useBlocker`, SvelteKit `beforeNavigate`/`willUnload`, the browser `beforeunload`/Navigation API, and iOS `presentationControllerShouldDismiss`/`isModalInPresentation`) showed the real abstraction is **guarding a region's teardown against a predicate** — not "navigation." And the access-control item (#178) is its mirror image. So this does not become a lone intent; it becomes one **member of an open Guard protocol**.

## Ruling

- **This is the *Exit Guard*** — a routing/transition member, captured as its successor build **#273**. "Navigation" was the wrong noun: the guard arms when the *region the user is in is torn down* (the document is the outermost region → `beforeunload`; a route, modal, or panel are inner regions), gated by a loss-of-state `shouldBlock()` predicate; deny-outcome is a user-mediated **confirm** (stay/discard). It hooks the cancelable dismissal *trigger*, never raw DOM removal.
- **It belongs to a *Guard protocol*** (**#272**), not a one-off intent. Three tiers: the **protocol** (region + lifecycle event + predicate + provider seam + deny-outcome, surface-agnostic); a shared **guard provider** (default platform provider, project-overridable, custom-pluggable — enforcement is server-/platform-side, never in the intent); and **members grouped by interaction surface** — routing *entry/exit guards*, a rendering *access gate* (render-or-hide), open for future kinds. Vocabulary follows prior art: **Guard** = gate a transition, **Gate** = gate presence.
- **The protocol is open**, not an entry/exit pair — future members (action-confirm, edit/read-only, concurrency-lock) join without reopening it (intents-as-open-system).
- **#178 is the entry-guard / access-gate member** on a shared authz provider; it already independently converged on this shape (authorities + denial strategies + back-end-authoritative trust boundary).
- **Consumers** (Background Task `navigationGuard` #113, Form block #177) reference the exit guard rather than each redefining it — the duplication this item was harvested to kill.

The agent-ready successors are **#272** (design/author the protocol + provider seam) and **#273** (author the exit-guard member on top of it). This decision is closed.
