# Split analysis — #1391 dev-browser shell build (Chromium shell embedding plateau-app panels)

**Date:** 2026-06-22
**Target:** [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) — `kind: epic`, `status: open`, no children (unsliced epic)
**Verdict:** ❌ **Could not split** — slicing now buries two live forks and lands no demoable incremental state. Three concrete unblocking actions below.

---

## Context recheck (why this was even screened)

#1391 was gated behind [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) (the dev-surface monetization bet), which **resolved 2026-06-22**. The ruling: dev-browser is the flagship/end-state paid product, **build is decoupled from release/monetization timing — "pursue the full product now"**, and the soft-deferred-park framing is dropped. That lifts the *timing/funding* deferral the epic leaned on ("not funded to build yet"), which is what makes #1391 a fair slice candidate today.

But #1590 resolved the **monetization-surface** question, not the epic's **build-shape** questions. The three blockers below survive its ruling untouched.

---

## Could NOT split — rubric failures

### 1. Two scope bullets are unresolved forks — slices would bury them
The epic's own `## Scope (to slice when funded)` lists three bullets; two are explicitly open design forks, not volume:

- **Panel embed seam (#141 Fork 4-A)** — "package vs iframe/web-component boundary to plateau-app's panels (**the deferred build detail**)." This is a live either/or about how the shell mounts `plateau:src/technical-configurator/`, `intent-configurator/`, `profiles/`. A slice that "embeds the panels" would silently pick a branch. **Rubric: no slice may bury its own fork.**
- **Free-tier vs paid licensing surface (#141 commercial-license fork)** — the in-shell free/paid line (which capabilities light up free, which need the license). #1590 set the *high-level* posture (licensed local browser, JetBrains model) but **not** the per-capability gating line inside the shell. Still a fork.

### 2. No valid demoable incremental state until a heavy shell exists
The only non-fork bullet — "Chrome-level capabilities an extension can't reach: navigation interception, a 'not WE-compatible' screen, conformance-gated feature lighting" — presupposes a **working Chromium fork already running**. There is no `size ≤ 3` slice that leaves a demoable state *before* that scaffold lands, and standing up/maintaining a forked Chromium is itself heavy and ongoing (the Replay.io maintenance risk flagged in [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/)'s own risk synthesis, report:111). **Rubric: every slice must leave a valid demoable state / land `size ≤ 3`.** The first real slice violates both.

### 3. The epic's own sequencing predecessor is unbuilt
#1391 `## Sequencing`: advance this epic **only once** the extension/DevTools-panel MVP "proves the model (lights up on a conformant app) OR a capability demands chrome-level UI an extension can't reach." That leading build — a Chrome "lights-up-on-conformance" funnel MVP — **has not been filed** as a separate item. The nearest existing item, [#676](/backlog/676-vs-code-extension-publishable-shell-activate-localhost-http-/) (`kind: task`), is a generic VS Code extension shell, not the conformance-lit funnel MVP. So the gate predecessor named in the epic isn't satisfied, and #1590 did not waive it (it dropped *monetization-timing* deferral, not the build-order proving step).

**Net:** the "size" of #1391 is not volume — it is *unresolved decisions + an ungrounded heavy build with no incremental demoable path*. Slicing it now would manufacture slices that each bury a fork or can't demo.

---

## Unblocking actions (what makes a future split safe)

In dependency order:

1. **File the two buried forks as `type: decision` items** (per `feedback_decisions_are_workitems_not_plan_mode`, `feedback_collect_decision_residual_as_card`):
   - *Panel-embed boundary* (#141 Fork 4-A): package import vs iframe/web-component mount for plateau-app panels. Home `plateau-app`.
   - *In-shell free/paid line* (#141 commercial-license fork): which shell capabilities are free vs license-gated, under the #1590 licensed-local-browser ruling.
2. **File the Chrome-extension "lights-up-on-conformance" funnel MVP** as the leading build named in #1391 Sequencing (the proving step #1590 keeps). This is the first fundable build; #1391 advances after it proves the model or a capability provably needs chrome-level UI.
3. **Then #1391 slices cleanly** once 1–2 land — illustrative DAG (not yet authorizable):
   - `S1` Chromium shell scaffold + WE-conformance probe on load *(home `plateau:src/dev-browser/`; demoable: shell boots, detects conformant vs non-conformant app)*
   - `S2` "not WE-compatible" screen *(blockedBy S1)*
   - `S3` navigation interception *(blockedBy S1)*
   - `S4` conformance-gated feature lighting *(blockedBy S1)*
   - `S5` panel embed via the resolved 4-A boundary *(blockedBy S1 + fork-decision 1a)*
   - `S6` license-gating wiring *(blockedBy S1 + fork-decision 1b)*

   Each is then `size ≤ 3`, real-homed in `plateau:src/dev-browser/`, with a demoable state — but only *after* the forks resolve and the scaffold (S1) is itself scoped (S1 may still be `> 3` and need its own decomposition once the embedding boundary is known).

---

## Downstream note
[#1083](/backlog/1083-dev-browser-opt-in-surface-for-the-tier-2-vision-tier/) (`blockedBy: ["1391"]`) and the #140 matrix edge remain correctly blocked on this epic; nothing here changes those edges. No backlog mutation performed.
