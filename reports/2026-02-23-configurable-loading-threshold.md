# Research Report — Configurable Loading Threshold via Intents

**Plan file**: `plans/configurable-debounced.md`
**Research page**: `/research/configurable-loading-threshold/`
**Date**: 2026-02-23

---

## Question

The 400ms debounce loading threshold is currently a convention. How should it be configurable through the Intent system, and what does UX research say about the right value?

## Recommendation

Adopt a **two-parameter model** (`delay` + `minimum`) following Angular's `@defer` pattern, exposed as **named profiles** through the injector hierarchy.

## Key Findings

### Perception Research

300–400ms is not arbitrary. It's the range where human perception transitions from "that was fast" to "something is happening":

| Threshold | Perception | Source |
|-----------|-----------|--------|
| 100ms | Instantaneous — no feedback needed | Nielsen Norman Group |
| 300–400ms | Noticeable delay — spinner causes more anxiety than it relieves | Convergent (see below) |
| 1,000ms | Flow disruption — loading indicator necessary | Nielsen Norman Group |
| 10,000ms | Attention lost — determinate progress bar required | Nielsen Norman Group |

### Convergent Evidence

Multiple independent sources converge on the 300–400ms range:
- **React**: 300ms internal `FALLBACK_THROTTLE_MS` (not user-configurable)
- **spin-delay**: 500ms delay / 200ms minimum display
- **Vaadin**: 300ms default `firstDelay`
- **Productboard**: 300ms empirically tuned threshold
- **Skeleton screen research**: Below 300ms skeleton screens provide no benefit

### Angular @defer — The Gold Standard

Angular is the only major framework with explicit `after`/`minimum` parameters for loading indicators. This two-parameter model is essential: `delay` prevents premature indicators; `minimum` prevents flickering.

### Framework Comparison

| Framework | Configurable Delay? | Configurable Minimum? |
|-----------|--------------------|-----------------------|
| React Suspense | No (300ms internal) | No |
| Angular @defer | Yes (`after`) | Yes (`minimum`) |
| Svelte {#await} | No | No |
| Remix | No | No |
| Vaadin | Yes | No |

### Design System Timing

No major design system (Material Design 3, Carbon, Spectrum, Fluent 2, Apple HIG, GOV.UK) specifies a debounce delay. Web Everything's approach of making it configurable via Intents fills a genuine gap.

## Proposed Configuration

### Two Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `delay` | 400ms | How long before showing the loading indicator |
| `minimum` | 500ms | Minimum display duration once shown (prevents flicker) |

### Three Named Profiles

| Profile | Delay | Minimum | Use Case |
|---------|-------|---------|----------|
| `immediate` | 0ms | 0ms | First page load (no prior content) |
| `debounced` | 400ms | 500ms | Default for navigation and data fetching |
| `patient` | 800ms | 1000ms | Known-slow operations (report generation) |

Configuration flows through the injector hierarchy: app-level default → per-route override → per-component override → user preference (`prefers-reduced-motion` → `immediate`).

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `configurable-loading-threshold` entry |
| `src/_includes/research-descriptions/configurable-loading-threshold.njk` | New file (~430 lines) |
