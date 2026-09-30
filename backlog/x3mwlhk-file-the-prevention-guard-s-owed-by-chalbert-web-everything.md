---
kind: story
size: 3
status: open
scope: ["we:docs/agent/plateau-progress-view.md", "we:backlog/xj5krcc-add-github-budget-and-overnight-evidence-to-plateau-health.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3125's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3125's review (reviewed head `9a78a68162be23ef66f475ad6f3033b3f4df9baa`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:docs/agent/plateau-progress-view.md:103` — Put `format: uri` plus a `pattern` restricting to https on known GitHub hosts in `we:contracts/plateau-progress-view.schema.json`. Add negative examples (hostile title, `javascript:` URL) to the examples file, so a schema/examples conformance gate rejects them. Add a rule to the story template that any story ingesting third-party text needs a hostile-input fixture.
2. `we:docs/agent/plateau-progress-view.md:132` — Add a schema/contract rule that collection validation is per-item with an error row, and add a fixture 'one invalid item among N valid' to the conformance examples so the relay contract test enforces it.
3. `we:backlog/xj5krcc-add-github-budget-and-overnight-evidence-to-plateau-health.md:29` — Add a deterministic publish-boundary scrubber and a canary test in `we:wip-relay-contract.test.ts`: any snapshot field matching absolute-path or token patterns fails the publish. File this as a standards rule requiring a canary fixture for any story that publishes host-state text.
4. `we:docs/agent/plateau-progress-view.md:140` — A standard LLM review or lint check that cross-references all operator additions and feature requests in a design document against the proposed data contract schemas to ensure completeness.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
