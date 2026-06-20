---
kind: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "backlog/1000-ratify-the-web-portals-protocol-resolve-the-4-spec-open-ques.md (+ #1001 build epic)"
tags: []
---

# Review the webportals spec and surface its design + build work

webportals has a 1322-line spec page (we:src/_includes/project-webportals.njk) but NO design item and NO implementation. Review the existing spec, decide whether it is still the intended direction, and surface the design/build work as proper backlog items (or retire the spec if superseded).

## Outcome (batch-2026-06-18)

Reviewed the full spec. **Verdict: still the intended direction — not superseded, not retired.** It
proposes a polyfillable portal protocol (`Node.logicalParent`/`logicalInjector`, logical event
propagation, a portal `CustomTemplateDirective`, an SSR contract) that integrates cleanly with the
constellation (Web Injectors as the logical-tree backbone, Web Contexts, Web Directives) and explicitly
distinguishes itself from WICG Portals (a different concept). Confirmed zero impl (`grep portal` over
`plugs/`/`blocks/` is empty) and zero owning backlog items.

Surfaced the work as two items:
- **#1000** (`type:decision`) — ratify the protocol shape by resolving the spec's 4 open questions
  (`logicalParent` writable-vs-method; `bubblesLogical` × shadow retargeting; focus-scope boundary;
  deferred-target behaviour). Design gate; un-prepared (run `/prepare`).
- **#1001** (build epic, `blockedBy: 1000`) — logical-tree polyfill + logical event propagation + portal
  directive + SSR conformance + demo. Slices to be carved on ratification.
