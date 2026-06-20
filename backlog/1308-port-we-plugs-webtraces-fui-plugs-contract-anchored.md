---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webtraces/sessionReplayEnvelope.ts"
tags: []
---

# Port we:plugs/webtraces → fui:plugs/ (contract-anchored)

Port the webtraces domain (we:plugs/webtraces/sessionReplayEnvelope.ts) to FUI, contract-anchored against the session-replay-envelope conformance vectors.

## Progress

Ported the webtraces domain into FUI (FUI had no webtraces plug):

- `fui:plugs/webtraces/sessionReplayEnvelope.ts` — byte-replicated from
  `we:plugs/webtraces/sessionReplayEnvelope.ts` (self-contained type-only contract + dependency-free
  `assertSessionReplayEnvelope` validator + `SessionReplayEnvelopeError`; zero imports). Added a #1308/#606
  port-provenance header note (mirrors the webguards/webinjectors pattern).
- `fui:plugs/webtraces/__tests__/sessionReplayEnvelope.test.ts` — ported; contract-anchored test now
  imports the WE-owned suite via `@webeverything/conformance-vectors/schema` +
  `@webeverything/conformance-vectors/session-replay-envelope` (the #804-2a path-mapping).
- `fui:plugs/webtraces/__tests__/unit/webtraces.unplugged.test.ts` — ported (repo-relative import,
  unchanged); the #606 mandatory unplugged-surface proof.
- `fui:vitest.config.ts` — added the `@webeverything/conformance-vectors/session-replay-envelope` alias.
- `fui:src/_data/plugs.json` — registered the `webtraces` plug entry (type `Traces`), clearing the
  catalog-completeness gate for the new dir.

FUI webtraces tests green (11). FUI `check:standards` red only on the 2 PRE-EXISTING catalog errors
(`fui:blocks/notification/`, `fui:blocks/signature-pad/`) — unrelated to this changeset, stepped over.
The WE-side `we:plugs/webtraces` copy stays for now (its #449 retirement is out of this port's scope).
