---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-07"
tags: [access-control, authorization, feature-flags, route-guard, declarative, candidate, harvest]
---

# Access control — declarative authorization / feature-flag gate

A candidate standard for **declarative access control**: gating UI and navigation on *authorization* (role/group), *feature flags*, and *process/validity* conditions. This is **app-level authorization**, distinct from [#009 `webpermissions`](/backlog/009-gap-13-webpermissions-project/), which is the browser **Permissions API** (notifications, camera, geolocation) — a different concern that should not be conflated.

The shape to consider — a declarative gate that wraps protected content/routes and resolves a set of *authorities*, each with a strategy for what happens on denial:

- **Authority kinds** — authorization (role/group), **feature flag**, **process** (a step only reachable once a prior action completed), **validity** (only proceed once a form is valid).
- **Denial strategies** — ignore / block / redirect / error / retry.
- **Trust boundary** — back-end is authoritative; the front-end gate is a UX mirror, never the enforcement point. Make that explicit so the standard isn't mistaken for security.

Sketch of the authored surface (to validate, not adopt):

```html
<access authorities="flag=my-flag, ignore; role=admin, block">…protected…</access>
```

## Scope to design (via [design-first.md](../docs/agent/design-first.md) / [new-standard](../.claude/skills/new-standard/SKILL.md))

- Is this an **intent**, a **block**, or its own **project**? It overlaps the Navigation Guard ([#129](/backlog/129-navigation-guard-intent/), exit guards) and Web Identity ([#012](/backlog/012-gap-5-webidentity-project/), authentication) — cross-reference, don't merge.
- **Feature flags** as a first-class sub-concept (flag source, evaluation, default-off) — capture here rather than as a separate stub.
- Browser-standard grounding: the Navigation API `navigate` event (intercept/redirect) for route guards; no native authorization primitive, so define the contract carefully.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo (`access-control.md` — its richest concept). **Plateau is not a model and must not be consulted or copied** — design fresh, and decide its home before any build.
