---
type: decision
workItem: story
size: 3
status: parked
dateOpened: "2026-06-18"
parent: "746"
relatedProject: webadapters
tags: [maas, polyglot, protocol, deferred-review]
---

# MaaS wrapper-serve protocol — deferred experience review (collect cases, revisit framework axis)

Deferred review (much later, NOT now): the MaaS wrapper-serve contract was ratified provisionally under #974 (A1 —
framework rides the catalog-gated `form` param, no new neutral contract surface). That ruling was deliberately
under-committed: we start now and collect real experience before freezing the shape. This item is the standing home for
that experience — log concrete cases, friction, and lossiness encountered while building #912/#753/#507 against
`servePathIR`/`maas-versioning`, plus any signal that a first-class neutral `framework` param (A2) is warranted. Revisit
only once enough cases have accumulated; parked until then. Promotion to a neutral param would be a deliberate versioned
`servePathIR` bump.

## How to use this item (standing instruction)

**While building anything against the MaaS serve path** (#912 live-test sandbox, #753 consume-mode tabs, #507
generation-adapter, or any new MaaS origin), **append a dated bullet to the Cases log below** whenever you hit one of:

- a request/response shape the existing `servePathIR` grammar (`form`/`target`/`strategy`, pin ladder, header set,
  400/404/500) could **not** express cleanly, or expressed awkwardly;
- a place the catalog-gated `form` value-set (`react-wrapper`/`vue-wrapper`/…) felt strained — e.g. wanting to vary
  framework and wrapper-strategy independently (the `form × framework` matrix the A1 ruling pushed into FUI's catalog);
- a forward-adapter (#507) routing case where an opaque `form` catalog value was insufficient and a **named neutral
  `framework` param** would have helped (this is the specific A2-revival signal to watch for);
- lossiness / diagnostics worth remembering, or a header/cache/identity rule that needed bending.

Keep each entry one line: `YYYY-MM-DD — #NNN — what happened / what the contract couldn't do`. **Do not redesign here** —
just collect. The review fires (unpark → run the #974 fork again with evidence) once the log shows a real pattern, not
on a schedule. Cross-refs: provisional ruling lives in [#974], the FUI catalog registration in [#977], the
serve-path **preset** idea (named param bundle) in [#979].

## Cases log

_(empty — append dated bullets as experience accrues)_
