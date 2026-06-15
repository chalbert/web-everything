---
type: decision
workItem: story
size: 3
parent: "666"
status: open
dateOpened: "2026-06-15"
tags: [self-driven-project, constellation, project, protocol, ownership, no-lock-in]
---

# Is the Self-Driven Project methodology a first-class constellation project (what owns its artefact Protocol)?

The #672 no-lock-in artefact Protocol can't register until this is decided: protocols.json hard-requires an ownedByProject that resolves in projects.json + a project partial carrying the anchor, and no self-driven-project/methodology project exists (the constellation is all web* platform-standard projects). #665 ratified the framing + named the Protocol but not an owner. Decide whether the methodology becomes its own first-class constellation project (own project + partial + npm scope + layer, per the #091 managed-offering pattern) and what owns the Protocol — or whether it is owned differently / is not a registered Protocol at all. Blocks #672.

## Why this is open (surfaced by #672, batch-2026-06-15)

Registering the artefact Protocol (`#672`) tripped the protocols.json invariant
(`check-standards-rules.mjs` §6b): every Protocol needs an `ownedByProject` that resolves in
`projects.json` **and** a `src/_includes/project-<owner>.njk` partial containing the protocol's `anchor`.
The whole constellation is `web*` **platform-standard** projects (webintents, webvalidation, webworkflows,
…); the Self-Driven Project methodology is a *process/governance* concern, not a browser-platform standard,
so it fits none of them and none can honestly own the Protocol. `#665` settled the methodology's framing
(autonomy taxonomy, tolerance envelope, gates) and graduated to "`#666` epic (+ no-lock-in artefact
Protocol)" — but deliberately did not assign project-hood. This is that deferred call.

## The fork

- **A — Mint a first-class constellation project that owns the Protocol** (e.g. `webprocess` /
  `webmethodology` — name TBD). Own project entry + `project-<id>.njk` partial (carrying the protocol
  anchor) + npm scope + a constellation layer, applying the #091 managed-offering layering (what's the
  standard vs the served tool vs the impl?). *For:* satisfies the protocols.json invariant the clean way;
  makes the methodology a peer artefact the control-plane / dev-browser consume; matches how every other
  Protocol is homed. *Against:* the constellation has been *web-platform standards only* — a
  process/governance project is a category expansion (does it dilute the "standardize the web platform"
  thesis? does it want its own npm package?).
- **B — Home the Protocol under an existing project.** *Against (likely fatal):* nothing fits — the
  methodology isn't validation/workflows/etc.; forcing it under an unrelated project is a false home that
  the next reader has to untangle. Listed for completeness; probably a non-starter.
- **C — It is NOT a registered Protocol.** The artefact contract ships as a **spec report + the
  tool-agnostic file schema** only (everything-as-code), not a protocols.json entry — so no owning project
  is needed. *For:* avoids the category expansion; the "Protocol" status in `#665`/`#672` may have been
  aspirational shorthand for "a portable, documented contract," which a report + JSON-schema already
  delivers. *Against:* loses the `/protocols/` surface + the conformance-gate machinery a real Protocol
  gets; weaker "this is a first-class interop contract" signal.

**Default lean (not ratified — needs the call): A**, *if* the methodology is genuinely a long-lived peer
in the constellation (the #663/#665/#666/#672 investment suggests it is); otherwise **C** as the
lighter-weight honest framing. The decider should weigh whether process-tooling belongs in the `web*`
constellation at all — that is the real question under the mechanical blocker. On resolution, `#672`
either gets its owning project (A) or is re-scoped to a report+schema deliverable (C).
