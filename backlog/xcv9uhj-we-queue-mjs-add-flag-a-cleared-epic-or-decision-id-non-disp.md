---
kind: story
size: 2
parent: "2612"
status: open
scope: ["we:scripts/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# we:queue.mjs add: flag a cleared epic or decision id (non-dispatchable) at add time

`add` in [we:scripts/conveyor/queue.mjs](scripts/conveyor/queue.mjs) accepts any id and gives no signal when that id can never be dispatched. This item adds a kind-aware warning at add time so the operator isn't surprised by a silent non-dispatch.

## Problem

`queue add` accepts any id, including a `kind:epic` (needs `/slice`) or a `kind:decision` (needs `/prepare` + `/decision`) that the dispatcher can never build. Such an item just sits `cleared-but-not-ready`, silently non-dispatchable — the operator adds it expecting delivery and nothing ever happens.

## Proposed behavior

Mirror the existing not-ready warning already in `add`: at add time, detect the item's `kind` and WARN when it is non-dispatchable —

- an **epic** needs slicing before the conveyor can act; and
- a **decision** needs preparing (and a ratify) before the conveyor can act.

The warning is advisory — it still lets the id be added — so the operator sees why it won't dispatch. The blocked-behavior only becomes real once sibling items x254bqo (slice) and xtkdu9s (decide) land, but the warning is useful immediately.
