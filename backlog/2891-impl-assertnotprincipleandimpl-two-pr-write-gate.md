---
bornAs: x3rm10e
kind: task
status: open
dateOpened: "2026-08-02"
blockedBy: ["2890"]
tags: [governance, mechanization, check-standards, write-gate, two-pr-rule]
---

# Impl: `assertNotPrincipleAndImpl` write-time gate + sequencing check (enforces #2839)

Mechanical follow-on that enforces the ratified two-PR rule
(`we:docs/agent/platform-decisions.md#principle-and-impl-two-pr`, #2839): a write-time `check:standards`
gate, `assertNotPrincipleAndImpl(changedFiles, diffHunks)`, that REFUSES a diff touching both a principle
surface and implementation code, plus the sequencing check that an enforcing invariant never lands ahead of
its ratified anchor. This is the impl PR the two-PR rule itself prescribes — code only, committee-cleared.

## Scope

- Add `assertNotPrincipleAndImpl(changedFiles, diffHunks)` to `we:scripts/check-standards-rules.mjs`,
  invoked from both the `PreToolUse(Edit|Write)` deny path (shift-left, memory rule #43) and the whole-tree
  `check:standards` run (durable backstop).
- `principleTouch` evaluates #2840's **canonical** `principle surface` definition
  (`we:docs/agent/platform-decisions.md#human-is-principle-surface-not-path`) at the split-gate grain named in
  #2839's anchor — the **edit of a pre-existing guarantee**: a statute-anchor rule-text edit, or an
  edit / removal of a `@principle`/`@invariant` marker present in base. It does NOT evaluate the `POLICY_SPEC`
  whole-file floor (that floor is the *escalation* gate's membership, #2840 trigger 3, not the split gate's).
  `implTouch` = executable/impl code OR a hunk that **adds** a new marker+assertion (including a `POLICY_SPEC`
  conformance suite gaining a new gate assertion). REFUSE iff `principleTouch && implTouch`.
- **Sequencing check:** the impl PR that adds an invariant enforcing anchor `#A` must cite a `codifiedIn:
  …#A` decision already `status: resolved` on `main`; an enforcing invariant landing ahead of its ratified
  anchor is a hard error.

## Preconditions

`blockedBy: 2890` — the shared base-vs-head `diffHunks` plumbing into `scoreEscalation` / the write path;
`isPrincipleSurface` needs hunk content. Enforces #2839's ratified anchor; behaviour-preserving mechanical
impl, committee-clearable (not `review:human`).
