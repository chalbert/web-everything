---
name: Materialization Pattern Codified in Design-First
description: Validation standard materialization approach is now in docs/agent/design-first.md as official pattern
type: feedback
originSessionId: d9c6c475-34ad-45cb-a7f0-b0457fe1aaa1
---
The materialization strategy (plan → discrete homes → refine in place) has been formally documented in `docs/agent/design-first.md` as a standard approach for authoring large standards.

**What was added:**
- New "Materialization strategy" section after step 4, before "Before implementing"
- 4-step validated pattern: identify deliverables → extract to real files → refine in place → track decisions
- Guidance on when to materialize (500+ line plans, 5+ new terms, major discoveries)
- Concrete example: validation standard → reports + intent + semantics + research topic
- Emphasis that website files (.json + .njk) are source of truth, not the plan

**Why:** The validation standard work proved this approach effective for managing large, complex specifications. Codifying it ensures future standards follow the same discipline instead of keeping bloated plans in context.

**Future application:** Any new standard with UX catalog + multiple axes + cross-cutting composition should use this pattern.
