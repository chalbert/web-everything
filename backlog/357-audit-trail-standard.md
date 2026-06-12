---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webaudit
tags: [candidate-standard, exercise-app-discovery, audit-trail, governance, compliance]
crossRef: { url: /backlog/351-web-compliance-project/, label: "Related: Web Compliance evidence trail (#351)" }
---

> **Resolved 2026-06-12 — codified.** Graduated to the **Web Audit** project (`webaudit`,
> `projects.json`) owning the **Audit Trail** protocol (`audit-trail`, `protocols.json`, draft; body in
> `src/_includes/project-webaudit.njk` §`protocol-audit-trail`). The contract: a normalized `AuditEvent`
> ({ target, action, actor, at, before?, after?, correlationId? }) appended through a swappable
> `CustomAuditProvider` registry, append-only by guarantee; before/after **reuse the Web States
> `ChangeRecord` shape**, and the headline composition wires a Web Lifecycle provider's events straight
> into the log. The per-entity timeline UI is the `audit-timeline` intent. Kept distinct from Web
> Compliance #351 (the platform-enforcement twin, same schema) and webstates change-tracking (reactive
> substrate). The runtime block (loan app becomes conformant; lifecycle auto-feeds it) is the follow-up
> [#399].

# Candidate standard — Audit trail (immutable actor/time/change log)

Missing standard surfaced building the loan-origination app ([#317](/backlog/317-exercise-app-loan-origination/)).
Every consequential action — state transition, condition cleared, document accepted/rejected, decision
issued — is recorded with **actor, timestamp, and before/after**. This immutable event log is the backbone
of the permissions and proof-of-compliance stories and is universal in regulated LOB software (finance,
insurance, healthcare, government). WE has **no audit-trail standard** for how such events are *modelled*,
*appended*, and *rendered*.

## What a standard would cover

- A normalized **audit-event schema** (actor, action, target, before/after, timestamp, correlation id).
- Append-only semantics + a canonical **timeline rendering** and filtering.
- Composition with lifecycle ([#353]) and permissions (#009) — transitions and access decisions auto-log.

## Relations & open questions

- The app-level twin of **Web Compliance** ([#351])'s evidence trail — share one event model?
- Intent + schema, or a protocol (cross-vendor audit-log interchange)?
