---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:docs/agent/backlog-workflow.md", "we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md", "we:scripts/__tests__/decision-prep-persisted-state.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "c3bc73e946a06f402ae5e45305ca56b6b3d0571e"
tags: []
---

# Prevention — Add a checklist line to the decision-card prep template for any proposal that persists agent state: sta… (from chalbert/web-everything#3241 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md`, **Park means preserved work AND context, followed by actual release** — Add a checklist line to the decision-card prep template for any proposal that persists agent state: state its redaction, access-control, integrity and untrusted-input handling. Also add a follow-up acceptance canary that plants a secret in the context and checks it is scrubbed from the retained handoff.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3241@04112b4ed16c3b85b8150bc1f4b2c7f8e2ffbd49

## Design

Add one conditional checklist entry to the canonical decision preparation guidance in `we:docs/agent/backlog-workflow.md`, under **The prepared-fork shape**: any proposal that persists agent state must state its redaction, access-control, integrity, and untrusted-input handling. Require concrete artifact/read/write boundaries and failure behavior, rather than a generic “security reviewed” assertion. A proposal without persisted state can explicitly mark the entry not applicable with a reason. This is a preparation requirement; it does not select a storage backend or resolve a permission-policy fork.

Add a future acceptance canary to **Follow-ups — only after an operator ruling** in `we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md`. The canary uses a synthetic secret in agent context, exercises the eventual checkpoint/handoff writer, and verifies that the secret is absent from the retained handoff and its resumed context while a benign marker survives. Clearly label it future implementation acceptance, gated on the operator ruling and a real handoff persistence implementation. Do not claim that current salvage scrubs agent context.

## MVP

1. Add the conditional four-part checklist to `we:docs/agent/backlog-workflow.md`; keep the shared guidance as the single home for the rule. The existing preparation skill and conveyor template already point to that method.
2. Add the synthetic-secret canary specification to `we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md`, preserving the open forks and distinguishing proposed acceptance from delivered behavior.
3. Add the planned documentation-contract test `we:scripts/__tests__/decision-prep-persisted-state.test.mjs`, covering both changed documents. No runtime persistence or permission code changes belong to this item.

## Test plan

The planned `we:scripts/__tests__/decision-prep-persisted-state.test.mjs` is the matching test for both scoped documents. Use Vitest and read the real documents relative to the test module. Limit assertions to the named preparation and follow-up sections; normalize whitespace so harmless reflow passes.

- Assert the preparation checklist is conditional on persisted agent state and names all four obligations: redaction, access-control, integrity, and untrusted-input handling.
- Assert the follow-up specifies a synthetic secret, an actual checkpoint/handoff write, inspection of retained and resumed context, absence of the secret, preservation of a benign control, and future implementation status.
- Prove the assertions reject in-memory variants missing each obligation or the canary, and accept a whitespace-reflowed version. Do not modify checkout documents for negative controls.
- Run the focused Vitest file at implementation time. This tests the documentation contract, not a redaction implementation; executing the canary is later work.

## Proof plan

At implementation time, run the new focused test against the pre-change document contents and capture failure for the absent checklist/canary; then run it against the edited documents and capture success. Run `npm run check:standards` after implementation. Review the rendered prose or source sections to confirm the canary is visibly future acceptance and #3993 remains an open decision with unchanged policy choices.

For the eventual live canary, use only a unique synthetic secret, verify injection into the input, invoke the real persistence/resume path, inspect the resulting retained handoff and resumed context, and require a benign marker to remain. Empty or missing output must fail, and evidence must not echo real credentials. This item specifies that follow-up; it does not certify the future runtime.

## Follow-ups

After #3993 is ratified and its handoff writer has a concrete implementation home, scope and execute the live acceptance canary in that implementation's matching test file. Include error-path refusal, unauthorized reads/writes, artifact tampering, and instruction-like untrusted context in the future security acceptance suite according to the chosen contract. Do not invent a current runtime test path or silently implement that policy in this documentation item.

## Done when

1. **Executable** — the planned `we:scripts/__tests__/decision-prep-persisted-state.test.mjs` fails against the old documents and passes against the updated documents, including negative and reflow controls.
2. The canonical preparation checklist covers all four persisted-state obligations, and #3993 names the secret-scrubbing follow-up canary without claiming it is implemented or ratified.
3. `npm run check:standards` passes for the implementation change.

## Progress

- **Original premise/scope:** the filing cited only `we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md:109`, as though that card were the preparation template. That line currently discusses parked PR handling, not a reusable preparation checklist.
- **Corrected premise/scope:** the card's **Park means preserved work AND context, followed by actual release** section proposes retained handoffs, and its **Follow-ups — only after an operator ruling** section lacks the synthetic-secret canary. The reusable checklist belongs in `we:docs/agent/backlog-workflow.md` under **The prepared-fork shape**. Scope therefore includes that guidance, the cited decision card, and planned matching test `we:scripts/__tests__/decision-prep-persisted-state.test.mjs` for both documents.
- **Source evidence:** `we:skills-src/conveyor/prepare-decision-agent-brief.md` explicitly delegates the preparation method rather than restating it; `we:skills-src/prepare-decision-item/SKILL.md` step 3 points to the shared prepared-fork shape. Inspection of that guidance and #3993 found no requested four-part checklist or secret-scrubbing canary. The original prevention goal remains outstanding; the unresolved permission forks in #3993 do not block documenting the checklist and a conditional follow-up.
- Preparation changes only this card's body and scope. Stamping and delivery checks remain runner-owned.
