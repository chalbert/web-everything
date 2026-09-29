---
bornAs: xre8es1
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4380-review-pr-judgeadvisory-crashes-silently-when-codex-is-quota.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2879's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4380-review-pr-judgeadvisory-crashes-silently-when-codex-is-quota.md:46` — Add a `check:standards` rule for backlog cards that fails on duplicate `## Done when` headings, and on a `TODO` placeholder left in a `Done when` item, at file time.
2. `we:backlog/4380-review-pr-judgeadvisory-crashes-silently-when-codex-is-quota.md:46` — A markdown lint rule (like markdownlint's MD024) enforcing unique headings in the document, or a write-gate rejecting unfilled 'TODO' template markers in backlog cards.
3. `we:backlog/4380-review-pr-judgeadvisory-crashes-silently-when-codex-is-quota.md:46` — A `check:standards` lint rule that fails if a backlog card contains unresolved `TODO:` markers or duplicated section headings.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2879@e007c9dc7a53d4fa84aaf6b1493391d1c4cd1b2f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
