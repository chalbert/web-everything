---
kind: story
size: 5
parent: "1836"
locus: frontierui
status: open
dateOpened: "2026-06-28"
tags: [plugs, unplugged, workbench, dev-experience]
---

# Functional standard-plug register-set (unplugged bootstrap) for the block workbench ?plug=off path

## Digest

Build the unplugged-mode equivalent of `fui:plugs/bootstrap.ts` — a functional helper that registers the
standard plug set through `fui:plugs/unplugged.ts` `register()` + `upgrade(document)` with **no global DOM
patches** (no `window.WebEverything`/`window.attributes`/`window.injectors`, no `Document.createElement`
interception). `fui:plugs/bootstrap.ts` today does two things: applies realm-global patches *and* calls 13
`register*()` transient-element fns; the unplugged path needs the registration half driven through the
functional API instead of the patched globals. No demo or helper drives unplugged today (verified
batch-2026-06-27: zero non-test importers of `fui:plugs/unplugged.ts`), so #1900 (the workbench
`?plug=on|off` toggle) cannot honestly render its `?plug=off` branch without it. Locus FUI.

## Why this exists (surfaced batch-2026-06-27 pre-flight of #1900)

#1900's ratified mechanism (#1845 Fork-1 (c)) is a reload-scoped `?plug=on|off` that selects bootstrap-vs-
unplugged at load. The **plugged** half is trivial — the `bootstrapPatches()` vite plugin
(`fui:vite.config.mts:20-30`) already auto-injects the `fui:plugs/bootstrap.ts` script into every demo HTML,
so `?plug=on` is the status quo. The **unplugged** half is novel: there is no functional register-set, so
"drive the unplugged register/upgrade path" (the whole point of the parity story — show unplugged does *most*
of what plugged does, sans global patches) has nothing to call. Building that register-set is its own
deliverable (overlaps the unplugged-ergonomics line, e.g. resolved #1858), so it is carved out here and #1900
`blockedBy`'d on it.

## Scope (build-ready sketch — confirm at claim)

1. A `registerStandardPlugs()` / `bootstrapUnplugged(root = document)` helper in `frontierui` that mirrors
   `fui:plugs/bootstrap.ts`'s registration set via the `fui:plugs/unplugged.ts` `register()` API (the plug
   registries + the 13 transient `register*()` fns) and ends with `upgrade(document)` — patching **no** realm
   globals.
2. An unplugged smoke test (mirrors the plugged interaction tests) proving a behavior activates functionally
   with `window.attributes`/`window.injectors` **absent**.
3. Decide which plug surfaces are genuinely plugged-only residue (per #1839 parity manifests) and therefore
   *expected* to differ — this is the visible-gap #1900 surfaces, so the set must be explicit.

Once landed, #1900 wires `?plug=off → bootstrapUnplugged()` (skipping the vite bootstrap auto-inject for the
workbench page) and renders the gap.
