---
type: idea
workItem: story
size: 5
status: resolved
blockedBy: ["288"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: exit-guard
tags: []
---

# Exit guard intent — confirm before tearing down a region with unsaved or in-flight work

The exit-guard member of the Guard protocol (#272): a UX intent that confirms before a region the user is in is torn down while a loss-of-state predicate is true (dirty form, unsaved editor, in-flight task). Arms on teardown at any scale — the document is the outermost region (beforeunload), with same-document route changes (Navigation API intercept) and in-app dismissals (modal/panel close) as inner cases; it hooks cancelable dismissal triggers, not raw DOM removal. Deny-outcome is a user-mediated confirm (stay/discard); the shouldBlock predicate comes from the shared guard provider. Background Task (#113) and the Form block (#177) become consumers.

Successor build of #129 (resolved 2026-06-10), which ruled that "navigation guard" is really *exit guard* — one member of the open Guard protocol (#272). Design and author this member **on top of** the protocol; do not redefine the predicate/provider/region machinery here (that lives in #272).

## Shape to design (via [design-first.md](../docs/agent/design-first.md))

- **The armed condition** = a `shouldBlock()` loss-of-state predicate, supplied by the guard provider (default = a dirty/in-flight tracker; custom predicates pluggable). The intent declares *that* a confirm is presented when the region would be torn down and `shouldBlock()` is true — not *how* the predicate is computed.
- **Region scale-invariance** — same intent whether the region is the whole document, a route, or a modal. The document case is implemented via `beforeunload`; same-document route via the Navigation API `navigate`/`intercept`; in-app dismissal via the cancelable close action. All sit behind the provider.
- **Hook the cancelable trigger, not the removal** — raw `el.remove()`/`disconnectedCallback` is too late; intercept the intentful dismissal. State the boundary (imperative teardown that bypasses a guardable trigger can't be caught).
- **Deny-outcome** = user-mediated confirm (stay / discard) — distinct from the entry guard's `hide|redirect|forbid|cloak`.
- **Consumers**: Background Task `navigationGuard` dimension (#113) collapses to referencing this; Form block (#177) and any unsaved-editor surface reference it too.
- **Naming**: confirm **exit guard** (routing/transition vocabulary) reads right vs. alternatives, per #129's prior-art pass (Angular `CanDeactivate`, Vue `beforeRouteLeave`, React `useBlocker`, SvelteKit `beforeNavigate`).
