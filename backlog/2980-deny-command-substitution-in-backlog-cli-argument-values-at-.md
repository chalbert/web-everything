---
bornAs: xihjn7z
kind: task
status: open
dateOpened: "2026-08-07"
scope: ["we:scripts/guard-bash.mjs"]
tags: [guard, security, backlog]
relatedTo: ["xs1gx91"]
---

# Deny command substitution in backlog CLI argument values at the bash guard

Backlog titles and digests on this board are full of backtick code spans, and **double quotes do not stop**
backticks or `$(…)` in bash. A skill that pastes item-derived text into a `--title=` / `--digest=` /
`--scope=` value therefore garbles the write at best, and *executes the item's text* at worst — and
`we:.claude/settings.json` allow-lists the backlog CLI by prefix, so the substituted command line is
auto-approved with no prompt.

## Why

The doc corpus has been switched to `'single quotes'` at every call site a full-corpus grep found —
*backlog-workflow.md → Authoring an item* (which now states the rule once, file-wide), its *Slicing* step 2,
[we:skills-src/split-backlog-item/SKILL.md](../skills-src/split-backlog-item/SKILL.md),
[we:skills-src/next-backlog-item/SKILL.md](../skills-src/next-backlog-item/SKILL.md), and
[we:skills-src/review-program/templates.md](../skills-src/review-program/templates.md). But that is **prose**,
so it holds only as long as every future skill author remembers it, and nothing stops the double-quoted form
reappearing. [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) is already the PreToolUse Bash deny hook
and is the one place that catches the class across every skill, before the allow-list matters. Nothing in it
denies command substitution today, and there is no shell-quoting check anywhere in the scripts tree.

## Done when

- The bash guard refuses any backlog-CLI invocation whose `--title=` / `--digest=` / `--scope=` value carries
  an unescaped backtick or `$(`, with a message telling the caller to single-quote it.
- A correctly single-quoted value carrying the same characters is **allowed** (no false positive on the
  common case — backtick code spans in a title).
- A `check:standards` rule keeps the **doc corpus** from regressing: any backlog-CLI sample in
  `docs/agent/*.md` or `skills-src/**/*.md` containing `--title="` / `--digest="` / `--scope="` errors,
  so the single-quoted form is the only one that can ship. Fully script-decidable. **The skill glob must
  be `**/*.md`, not skill-manifest-only** — the call site this rule missed on its first pass lived in
  [we:skills-src/review-program/templates.md](../skills-src/review-program/templates.md), which is not a
  skill manifest, so a manifest-only glob would have shipped the very gap that motivated the rule.
- Unit coverage for both arms, and `npm run check:standards` green.
