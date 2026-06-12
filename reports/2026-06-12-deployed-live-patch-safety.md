# Deployed-app live-patch — safety-design prior-art survey

_Date: 2026-06-12 · feeds backlog [#410](../backlog/410-dev-browser-deployed-app-live-patch-gated-capability-safety-.md)
(carved from [#141](../backlog/141-dev-browser-vision.md) Fork 2) ·
research topic: `deployed-live-patch-safety` · builds on the
[dev-surface market landscape](2026-06-07-dev-surface-feature-market-landscape.md)_

## Why this survey

[#141](../backlog/141-dev-browser-vision.md) settled the dev-browser fix-loop for v1 — report-only →
propose → **local-session** live-verify → open-PR — but explicitly **carved out live-patching a _deployed_
app** (a model mutating running production state) as the single riskiest capability, to be designed
separately. #141 named the four safety concerns this item must answer: **(1) the sandbox/isolation model,
(2) who may authorize, (3) session-only revertibility, (4) an audit trail.** This survey grounds each
against established practice before authoring the forks.

## The central finding — "patch the deployed _view_, not the deployed _app_"

The scariest reading of "live-patch a deployed app" is mutating the running production artifact
(kernel-style hot-patch / Erlang hot-code-load). But the dev browser already controls the **rendering
surface** via CDP, and the web platform has an exact, battle-tested precedent for a **session-scoped,
server-untouched** patch:

> **Chrome DevTools "Local Overrides"** serve a locally-modified copy of a site's files **only within your
> own browser session** — the server's files are never changed, and the overrides are **active only while
> the session (DevTools) is running**, persisting across reloads until it closes.

This reframes the capability: the AI can apply a patch to the **live, rendered deployed app in the
authorized viewer's session**, prove the fix works (the demo value #141 wants — "the user sees the fix
working before anyone commits"), and the deployed artifact is **never mutated**. Blast radius = one
session; revert = end the session. The PR remains the _only_ path to a real change. Most of the risk #141
flagged is **designed out**, not merely guarded.

## What the prior art says, per safety concern

### 1. Isolation / sandbox model

| Model | Mechanism | Blast radius | Revertibility |
|---|---|---|---|
| **Client-side session overlay** (recommended) | DevTools Local Overrides / CDP runtime override | One session | Auto on session end |
| Server-side canary / shadow | Patch an isolated instance / shadow traffic, never the fleet | Canary ring | Drop the canary |
| Live-fleet hot-patch | kpatch / Ksplice / Erlang hot-code-load — replace running routines | Whole fleet | **Hard** — kpatch _can't revert without reboot_; only Ksplice can |

Kernel-patching practice is unanimous on the heavy end: **canary rings first, then wide rollout, with
documented escape hatches and _tested_ rollback procedures**. The reversibility gap (kpatch can't undo a
live patch without a reboot; Ksplice can) is the cautionary tale — reversibility must be designed in, not
assumed. The client-side overlay gets reversibility for free.

### 2. Authorization — break-glass + just-in-time

The established pattern for a rare, high-risk production action is **break-glass + JIT privileged access**:
a dedicated emergency path that bypasses the normal flow **but triggers immediate alerts, requires an
incident-commander/lead authorization, and a post-implementation review**. JIT access records _who
requested, who granted, the justification, and an expiration_ — because **standing access is itself an
audit finding**. High-risk requests increasingly require **multi-factor / two-party approval**. The
authorization bar should **scale with the isolation model**: a client-side overlay is a lighter elevation
than server-side mutation.

### 3. Revertibility & lifetime

Local Overrides is the model: **persists across reloads within the live session, evaporates when the
session closes.** Add a **feature-flag-style kill switch** for instant in-session revert and a **hard
TTL** so a forgotten session can't keep a patch live indefinitely. A patch that _outlives_ the session is
indistinguishable from a deploy — and that is what the PR is for.

### 4. Audit trail

SOC2 audit-logging requires, at minimum, **user · action · timestamp · affected resource**, plus
justification, with break-glass events needing **detailed logs + retroactive approval/justification**.
The native-first move: emit the audit record into the app's **own introspectable trace substrate** (the
dev browser already reads it), carrying the patch diff + before/after evidence (trace/test) + revert — and
attach it to the PR when one is opened.

## Architectural classification

This is a **product capability** of the dev browser (the constellation's product layer — #141 Fork 4 puts
the browser as a shell embedding plateau-app's panels), **not a Web Everything standard** (no
intent/block/plug/adapter). The one standard surface it _reuses_ is the app's trace self-description as the
audit sink (Fork 4) — native-first, no new protocol. Crucially, the usual **most-permissive-default bias is
inverted here**: this is a safety guardrail, so the default is the **most-restrictive safe** option
(client-side overlay · ephemeral · break-glass authorized), and _more_ capability (server-side mutation) is
the explicit, separately-gated opt-in — kept apart from this item per bias-toward-separation.

## Implications carried into #410's forks

1. **Isolation** → default to a **client-side session overlay** (Local Overrides model); server-side
   canary is the deferred alternative, live-fleet hot-patch is rejected.
2. **Authorization** → **break-glass JIT elevation**, per-app policy caps who may authorize, per-patch
   confirmation, expiring grant; two-party approval exposed as a policy dial.
3. **Lifetime** → **session-scoped, persists across reloads, hard TTL + kill switch**; never sticky past
   the session.
4. **Audit** → **emit to the app's trace substrate** (who/action/when/resource + diff + evidence + revert)
   and attach to the PR; standalone log only as fallback.

## Sources

- [Override web content locally — Chrome DevTools (Local Overrides)](https://developer.chrome.com/docs/devtools/overrides) ·
  [Local Overrides persist while DevTools open](https://www.pbrumby.com/2024/12/27/using-chrome-local-overrides-to-maintain-changes-after-refreshing-the-browser/)
- [What is Linux kernel live patching? (Red Hat)](https://www.redhat.com/en/topics/linux/what-is-linux-kernel-live-patching) ·
  [kpatch vs Ksplice — revert differences (TuxCare)](https://tuxcare.com/blog/from-comparison-to-choice-kpatch-vs-ksplice-and-the-advantages-of-switching-to-kernelcare/) ·
  [Choosing a live kernel patching extension (TechTarget)](https://searchdatacenter.techtarget.com/tip/How-to-choose-a-live-kernel-patching-extension)
- [Just-In-Time access management guide (Apono)](https://www.apono.io/blog/just-in-time-jit-access-management-the-essential-guide/) ·
  [SOC2 audit log requirements (Bytebase)](https://www.bytebase.com/blog/soc2-audit-logging/) ·
  [Change management for SOC2 (Unleash)](https://www.getunleash.io/blog/streamlining-change-management-for-soc-2-compliance)
