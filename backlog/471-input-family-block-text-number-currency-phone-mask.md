---
type: idea
workItem: story
size: 3
parent: "468"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "block:input-family"
tags: []
---

# Input family block — text/number/currency/phone/mask

Native-first block over `<input>` for the text-ish family (text/number/currency/phone, masked input): formatting, masking, and typing affordances the bare element can't express. Sliced from #468.

## Resolved 2026-06-13 (batch-2026-06-13)

Authored the `input-family` block standard: [fui:blocks.json](../src/_data/blocks.json) entry (status
`draft`, type Component, `implementsIntent: input`) + required
[we:block-descriptions/input-family.njk](../src/_includes/block-descriptions/input-family.njk) (renders live
at `/blocks/input-family/`).

- **Native-first**: always a native `<input>` with the most specific platform `type`
  (`number`/`tel`/`email`/`url`/`text`) — the type carries the mobile keyboard, constraint validation,
  and submitted value; the block layers on top, never replaces the element.
- **Display vs. raw value** (same rule as the data-table formatter #368): currency/number formatting is
  presentational via `Intl.NumberFormat` while the submitted value stays the unformatted raw — a currency
  field is `type=text inputmode=decimal` with the Intl layer mirroring its raw value (`type=number` can't
  render grouped currency).
- **Masking** is the one affordance the platform lacks — a declarative mask over the raw digits, opt-in,
  distinct from native `pattern`/`maxlength` validation, degrading to a plain typed input with JS off.

No `sourcePath` — the native element carries the standard case; the format/mask behavior is a deferred
Frontier UI build.
