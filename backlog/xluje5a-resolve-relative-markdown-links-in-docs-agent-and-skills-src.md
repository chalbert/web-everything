---
kind: story
size: 3
status: open
dateOpened: "2026-08-07"
tags: [gate, docs, skills]
---

# Resolve relative markdown links in docs/agent and skills-src at the gate

Nothing in `check:standards` resolves a relative markdown link against the filesystem — the only link lint
is a backlog-body regex that never touches disk. A scan of `we:docs/agent/` + `we:skills-src/` finds 50 of
129 relative links dangling from the tracked path, across 22 files. 46 of those are one systematic pattern:
a skill linking three levels up to `we:docs/agent/`, which is correct through the `we:.claude/skills`
symlink but one level too deep from `we:skills-src/`. So the first job is not a sweep, it is a ruling on
which view is canonical; the gate then enforces whichever it is.

## Why this is not just "fix 50 links"

`we:.claude/skills` is a symlink to `we:skills-src`, so every skill file has two valid depths to the repo
root. An agent loads a skill through the symlinked path (3 levels deep), where a three-dot link resolves
correctly. A human, GitHub, or any editor reads the tracked path (2 levels deep), where the same link points
above the repo root and 404s.

Both readerships are real, so "the links are broken" is only true from one of them. The 46 are not rot —
they are the tracked spelling of a link that works where agents actually read it. Pick the canonical view
before writing any gate, or the gate will mass-rewrite links that were never wrong at runtime.

## Scope

- **Rule the fork first.** Either (a) the tracked path is canonical → rewrite the 46 to two-dot form and
  require the tracked spelling, or (b) the symlinked runtime view is canonical → the gate resolves skill
  links through the symlink and the tracked view stays "wrong" by design. (a) is the bold default: it makes
  the tracked file self-consistent and needs no symlink present to validate.
- **The gate.** Resolve every relative markdown target under `we:docs/agent/` and `we:skills-src/` from the
  file's real on-disk path; error on a non-existent target. Fold into the existing `check:standards` walk.
- **Exempt site routes.** A link ending in a slash is an 11ty rendered route, not a file. 4 exist today;
  they must not be flagged.
- **Fix the 4 genuinely stale targets** the scan finds beyond the symlink class — e.g.
  `we:docs/agent/backlog-workflow.md` points at a test file that no longer exists.

## Non-goals

- **Not the section-anchor half.** The review that surfaced this also proposed resolving cited skill section
  ids to real headings. Those are prose labels, not markdown anchors, and matching them needs a heading
  convention that does not exist. File separately if wanted.
- Not a link check over `we:backlog/` bodies — `findBadBodyLinks` already owns that corpus.
- Not a cross-repo (`fui:` / `plateau:`) resolver.

## Reproduce

Walk `we:docs/agent/` + `we:skills-src/` for markdown links whose target is relative, resolve each against
the containing file's real directory, and bucket the misses into: ends with a slash (site route, ignore),
resolves after dropping one leading level (the symlink-view class), and everything else (stale). Current
counts: 129 links, 75 resolve, 4 site routes, 46 symlink-view, 4 stale.

## Provenance

Surfaced by the converge review of #1068, where three independent jurors each proposed a relative-link gate.
It is the ONLY one of 86 proposed preventions from that review that survived a red-team pass — the rest were
already-covered, already-open, PR-local fixes, or gates that would have been red on day one against the
existing corpus.
