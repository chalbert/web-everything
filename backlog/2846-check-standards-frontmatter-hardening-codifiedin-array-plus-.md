---
bornAs: xc85kg0
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [statute-lint, check-standards, prevention, frontmatter]
---

# check:standards frontmatter hardening: codifiedIn array plus an unknown-key allowlist

Two small frontmatter-validation gaps found on PR #982. First, `codifiedIn` is single-valued, so a decision codifying several anchors gets resolution and substance coverage under `check:statute` for only the lead anchor. Second, novel unread frontmatter keys (such as the removed `dateRatified`) pass unnoticed. Let `codifiedIn` accept an array so every codified anchor is covered, and add a front-matter key allowlist in `we:scripts/check-standards.mjs` that flags unknown keys.

## Gap

Two independent but trivially-related frontmatter holes:

1. **`codifiedIn` is scalar.** A decision that codifies several anchors (PR #982 adds four) can only name one in `codifiedIn`, so `check:statute` resolution + substance coverage runs against the lead anchor alone — the other three are uncovered.
2. **No key allowlist.** A novel, misspelled, or stale frontmatter key (the review found a removed `dateRatified`) is silently ignored by `we:scripts/check-standards.mjs` rather than flagged, so a typo'd or dead key never surfaces.

## Why it matters

Both let real metadata slip past the gate unread — coverage that stops at one anchor, and keys nobody validates. Closing them is cheap and makes the frontmatter contract total.

## Mechanical fix

1. Let `codifiedIn` **accept an array**, and run `check:statute` resolution + substance coverage over **every** listed anchor, not just the lead.
2. Add a **front-matter key allowlist** in `we:scripts/check-standards.mjs` that **errors** (or loudly flags) on any key outside the known set — catching novel/stale/typo'd keys such as `dateRatified`.

## Provenance

Captures two outstanding **minor** preventions (the codifiedIn-array minor and the front-matter-key-allowlist minor) from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), grouped as one item per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
