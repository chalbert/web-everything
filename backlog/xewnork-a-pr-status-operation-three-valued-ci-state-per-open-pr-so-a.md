---
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# a pr-status operation: three-valued CI state per open PR, so a stall is visible

Declare the question every landing session asks by hand: for each open PR, what is its head sha, did a check RUN on that head, what did it conclude, is it mergeable, and does its review label agree with all of that. Three-valued like `verify` — `green` / `red` / `unchecked`, where unchecked means NO check run exists for the current head and is NOT a flavour of pending. Measured cost: #1510 and #1511 sat 12 hours showing green marks that belonged to superseded commits, while the `checking` label asserted a check that did not exist. Read-only: two compute steps, no sink, a GET-only surface like `suggest-next` and `gate-health`.

## Why an event subscription does not answer this

Worth stating up front, because subscribing looks like the obvious fix and is not. A webhook subscription
delivers events; the #1510/#1511 stall was the **absence** of events, and silence from a watcher is
indistinguishable from "still building". An event stream structurally cannot detect that nothing happened.
Subscription is the right tool for "a human commented"; only a poll that asserts presence catches a stall.
Both are worth having and they are not substitutes.

## The outcome vocabulary

| outcome | meaning |
| --- | --- |
| `green` / `red` | a check ran on **this** head and concluded |
| `pending` | a check is running on this head |
| `unchecked` | **no check run exists for this head** — not pending, not failing |

`unchecked` is `unrun` wearing a different hat, and it is the value the whole item exists for.

## Done when

1. **Executable** — a run against a PR whose current head has zero check runs reports `unchecked`, and the
   suite pins that `unchecked` never reduces to `pending` or satisfies a ready-to-merge gate.
2. **Executable** — the verdict flags a PR whose review label disagrees with its checks (the live case: a
   `checking` label beside zero check runs), because that pair is what made a 12-hour stall look normal.
3. **Observable** — every step is `compute` and the declaration reaches nothing that can act, so
   `http-adapter` derives a GET-only, record-free surface — asserted by the existing read-only import-graph
   test rather than promised here.

## Not this item

Rewiring the skills that poll by hand, and any daemon that calls this on a schedule. This declares the
question and answers it once; who asks it, and how often, is separate.
