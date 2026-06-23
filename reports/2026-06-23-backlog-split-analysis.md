# Backlog split analysis — #718, #232 (2026-06-23)

Focused sweep triggered by #1623's two open residuals ("split the bundled #718 card; make #232's
`priority: low` real"). Rubric: size is volume not an unresolved decision · ≥2 nameable slices each
with a real home · each slice lands `size` ≤ 3 / `task` (deferred/parked slices exempt — they are not
batched) · clean DAG · every slice leaves a valid demoable state.

## #232 — Deferred `<component>` compiler strategy opt-ins — **NO ACTION (already sliced)**

The #1623 residual ("retype #232 to buildable, or split the 3-opt-in pool") is **stale**. A concurrent
session already converted #232 to a storied epic on 2026-06-23 with three `priority: low` children:

- **#1628** — `.component` dedicated-file surface (size 3, source-surface axis)
- **#1629** — per-bundler-native integration incl. Rust/WASM SWC plugin (size 5, toolchain-depth axis)
- **#1630** — `ts-patch`/`ttypescript` custom-transformer for `tsc`-only (size 3, `tsc`-support axis)

Nothing to split. The `priority: low` demote is now real (it sits on buildable child stories, not on the
inert epic). #232 needs no further action from #1623.

## #718 — SWC-native trait transform + Babel pre-step — **CAN SPLIT** (after decision→epic retype)

#718 is mis-typed `kind: decision` but carries **no merit fork**: it mirrors the #232 verdict (retyped
decision→epic same day). #127-class precedent settled toolchain reach as configurable strategy axes with
native-first defaults; the trait baseline (#717 Rollup/webpack/esbuild/Parcel, #722 conformance) shipped.
The two deferred mechanisms below each join a **different** axis, are additive, and break nothing —
*support-all, build-on-trigger*. "Which / when" is pure prioritisation, and a fork is never a
prioritisation tool. So #718 is an **epic of two deferred slices**, each with a **different hold-state**
— which is itself why one card can't hold both.

Note: no double-count with #232's #1629. #1629 is the `<component>` compiler's SWC plugin; #718 is the
**trait Enforcer's** SWC transform (against the #716 manifest contract) — a parallel, distinct subsystem
(#715 body is explicit: traits split a different artifact than `<component>`).

### Proposed slices (parent #718, which becomes a storied epic under #715)

| Slice | Disposition | Axis | Rationale |
|-------|-------------|------|-----------|
| **A — Babel transform pre-step for the trait Enforcer** | `size: 3`, `priority: low` | toolchain-reach | Specifiable now; documented-pre-step template already exists (#234 / #744 Parcel). Buildable whenever there's slack; just not worth doing now. |
| **B — SWC-native trait transform (Turbopack/rspack), Rust/WASM SWC plugin** | `size: 5`, `parkedReason: maturityGated`, `maturityTrigger: "adoptionSignal: a real SWC/Turbopack trait consumer"` | toolchain-depth | Building now produces a worse artifact — you'd tune the plugin against no real SWC/Turbopack integration to validate against. Flips ready on a named adoption signal. |

**DAG:** both children `blockedBy: []` — independent, additive on #715's resolved baseline (#717/#722).
No cross-edges. Each leaves a valid demoable state (the baseline four-bundler enforcer keeps working;
each slice only *adds* reach).

**Safety:** Slice A is agent-ready (`size 3`, buildable). Slice B is `size 5` but `maturityGated` —
parked, never auto-batched, so the ≤3 agent-ready bar doesn't apply (same as sibling #1629 size 5).
≥2 nameable slices ✓ · real home (#718/#715) ✓ · clean DAG ✓ · valid demoable state ✓.

## Could-not-split

None for #718. #232 was a no-op (already sliced upstream).

## Follow-up

On approval: retype #718 decision→epic, scaffold slices A/B, then #1623's last residual clears and
#1623 resolves.

---

# Split analysis — #1656 conformance-lit extension funnel MVP

**Target:** [#1656](/backlog/1656-conformance-lit-extension-funnel-mvp-chrome-devtools-panel-t/) — `kind: epic`, `status: open`, no children (unsliced epic). The leading build per [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) Sequencing; the funnel-data unblocker filed as action #2 of `we:reports/2026-06-22-1391-split-analysis.md`. #1391 is `blockedBy: ["1654","1655","1656"]`, so slicing #1656 is on the shell's critical path.
**Verdict:** ⚠️ **Partial split** — two fork-free slices stand up the extension chassis now; the epic's *namesake* behavior (lights-up-on-conformance) buries one genuine fork (how WE-conformance is detected) and is held behind a decision card, not sliced.

## Substrate found (grounded in the real tree)

- **No Chrome/DevTools-panel extension exists.** `plateau:src/dev-browser/` holds the VS Code extension (`plateau:src/dev-browser/ide-bridge/vscode-extension/`), `plateau:src/dev-browser/credential-source/`, `plateau:src/dev-browser/forge/`, `plateau:src/dev-browser/pr-body/` — no extension manifest / DevTools-panel page / content-script / service-worker. The only Chrome-extension code in the workspace is an *educational template* in the abandoned `plateau` repo, unwired.
- **The IDE-bridge protocol is transport-agnostic and built** (#577/#676, resolved). `plateau:src/dev-browser/ide-bridge/vscode-extension/protocol.ts:51` — `BridgeRequest`/`BridgeResponse` unions carried today over a localhost HTTP/WS server; the browser-side provider is transport-decoupled, so a Chrome extension can carry the same frames over `chrome.runtime.sendMessage`. Built substrate to *reuse*, not new design.
- **No live-page WE-conformance probe exists.** `we:conformance-vectors/` + `we:wrapper-conformance/runner.ts` test *components in isolation*; `we:capability-manifest/` is a *static app-declared* schema; `plateau:src/conformance-engine/` runs Plateau's own exercise apps. None answers "is this arbitrary running page WE-conformant?" — the exact signal #1656's funnel turns on.
- **The 22 inspector items (#1631–#1652) are almost all paper / gated on #142.** Only #1652 (jump-to-source) is "go" with no new substrate; the rest block on #142. The MVP can't lean on a fleet of ready inspectors.

## Could NOT split — the buried fork

**Conformance detection is an unresolved fork, not volume.** "Lights up *only* on WE-conformant apps" needs a mechanism that doesn't exist, with three materially different, mutually-exclusive end-states (each a legitimate branch ⇒ passes the fork-existence test):

- **(a) Declared** — app ships a `CapabilityManifest` (existing `we:capability-manifest/` schema) via a known global/meta/well-known; extension reads it. *"Conformant" = declares it.* Cheapest; trusts the declaration.
- **(b) Probed** — extension inspects the live runtime for WE signals (custom-element registry, the `webexpressions` binding layer, context providers). *"Conformant" = exhibits WE runtime structure.* No app cooperation; works on any deployed WE app; harder.
- **(c) Verified** — run conformance vectors/the engine against the live page. *"Conformant" = passes the spec.* Heaviest; engine isn't built for arbitrary pages.

This choice defines what the funnel's first impression *means* and what "lit" signals. A slice that "builds the conformance probe" silently picks a branch — **rubric: no slice may bury its own fork.** Same failure mode #1391 hit (core mechanism undecided), same remedy: file the fork as a `type: decision` first. **Held behind it** (cannot slice yet): the conformance probe, the "not WE-compatible" screen, and the lit-up/gating logic — the epic's namesake behavior.

> **Surface sub-question (resolved here, not a separate card):** content-script/popup vs DevTools panel — treated as settled **DevTools panel** by the item title ("…/DevTools-panel…") and the #141 DevTools framing in [#1654](/backlog/1654-dev-browser-panel-embed-boundary-package-import-vs-iframe-we/) ("dev tooling is privileged chrome docked beside it"). An inspector's conventional home is the DevTools panel; the old template used the same. So S1 below makes a *conscious*, not silent, surface choice.

## Could split — two fork-free slices (the chassis)

Both reuse decided substrate; neither touches the detection fork.

| Slice | Title | Home | size | Demoable state | Edge |
|---|---|---|---|---|---|
| **S1** | Chrome DevTools-panel extension scaffold — Manifest V3 + a DevTools-panel registration page + background service-worker | `plateau:src/dev-browser/chrome-extension/` (new) | 3 | Extension loads unpacked; a "Web Everything" panel appears in DevTools on any page | — (root) |
| **S2** | IDE-bridge transport adapter over `chrome.runtime` — carry the existing `BridgeRequest`/`BridgeResponse` frames (#577/#676) panel→service-worker→host; jump-only, reuses the built protocol | `plateau:src/dev-browser/chrome-extension/` + reuses `plateau:src/dev-browser/ide-bridge/` | 3 | From the panel, a `jump(location)` opens the file in VS Code via the existing host server | `blockedBy: S1` |

**DAG:** `S1 → S2` (incremental delivery). Clean, acyclic; each `size ≤ 3`, each leaves a valid demoable state. S2 is **transport plumbing only** (the existing `jump(location)` call) — *not* #1652's element-resolver, so no scope collision.

**Delivers / does not:** stands up the extension *vehicle* (panel exists, reaches the IDE — real proof the architecture works in Chrome). Does **not** deliver the headline lights-up-on-conformance behavior — that waits on the detection decision. The split de-risks and builds the chassis while the one real fork is decided in parallel.

## Unblocking action

**File a `type: decision` card: "Conformance-lit MVP — how does the extension detect WE-conformance of a live page?"** Forks (a) declared / (b) probed / (c) verified. Home `plateau-app`; relate under #1656. The held slices slice cleanly once it resolves (parallels #1654/#1655 off the #1391 analysis). Illustrative future slices: `S3` probe via resolved branch *(blockedBy S1 + decision)* → `S4` "not WE-compatible" screen → `S5` lit-up gating.

## Proposed mutation (gated on one "go")

1. Leave #1656 as the storied epic (already `kind: epic`).
2. `scaffold` **S1** and **S2** under `--parent=1656` (`--blocked-by=<S1>` on S2), locus `plateau-app`.
3. File the **conformance-detection decision** card (`--kind=decision`, `--parent=1656`).
4. Gate on `npm run check:standards`. No backlog mutation performed yet.
