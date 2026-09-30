---
bornAs: xx604u2
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/lib/citation-check.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/citation-check.test.mjs", "we:docs/agent/backlog-workflow.md", "we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "81e0381e1786203cbba3b37a554b28586fe4e868"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2854's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md:38` — Add a check:standards rule that resolves relative markdown links and `we:` refs in backlog/*.md against the tree.
2. `we:backlog/4360-verify-daemon-runs-checks-in-parallel-up-to-the-heavy-admiss.md:112` — Doc note: when correcting a card in place, either drop the 'kept for the record' claim or keep the original text under the header.
3. `we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md:36` — A standard markdown link checker running in `check:standards` or CI that validates internal repository links.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2854@b96869b3cf05537b15a8d4612d49f0811f01aa56

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/citation-check.test.mjs` fails before this item lands
   (no `findDanglingMarkdownLinks` export) and passes after; and `node we:scripts/check-standards.mjs --local
   --files=we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md` emits no
   dangling-markdown-link warning for that card after its link is fixed (it emits one with the detector wired
   but the link not yet fixed; on the pre-detector tree it emits none — see Proof plan). The builder
   re-measures the link baseline (numbers in the premise check are a planning snapshot) for the PR body.
2. **Docs** — `we:docs/agent/backlog-workflow.md` carries the "correcting a card in place" note (item 2 below).

## Premise check (2026-09-30, against `origin/main` 81e0381e1)

Still true; nothing already done. Findings:

- `we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md:38` (the card's cited `:36` is stale; the link text sits on line 38 on current main) still reads
  a bare same-directory link to the platform-decisions anchor `#local-gate-never-full-suite-by-default` — it
  resolves to a nonexistent file next to the card, which does not exist (the real file is `we:docs/agent/platform-decisions.md`).
  Live, un-flagged breakage.
- `we:backlog/4360-verify-daemon-runs-checks-in-parallel-up-to-the-heavy-admiss.md:158` still carries the
  `## Superseded original plan (kept for the record — do not implement as written)` header over a body that
  says it is "left here only so the correction's own diff is legible" — the record-claim ambiguity item 2 names.
- No relative-markdown-link resolver exists. `findDanglingSymbolAnchors`
  (`we:scripts/lib/citation-check.mjs#findDanglingSymbolAnchors`) only handles `<repo>:<path>#<symbol>`;
  `findBadBodyLinks` in `we:scripts/check-standards-rules.mjs` (~805-840) inspects `](…)` targets but only
  flags localhost, `/Users/`, `file://` and links to another backlog item's `.md` — nothing verifies that a
  relative target exists. Backlog→backlog `.md` links are therefore already WARNed there; the new detector must
  skip targets that resolve inside the backlog dir's own `.md` files it would double-report only if missing —
  builder decides: either skip that shape or accept the overlap deliberately and note it. Guards 1 and 3 are the same guard
  (a markdown link checker in `check:standards`), so one build covers both.
- Baseline measured on `backlog/*.md` (fenced/inline code stripped, site-absolute `/…` and URL links
  excluded): 3,853 relative links, **1,681 do not resolve** (many old `../src/_data/…` cites). So the rule
  cannot land as an error — it must follow the existing citation family's WARN level.

Scope corrected: the frontmatter listed the two *cited* cards; the real touch-set is the detector, its
wiring, its test, the workflow doc, and the one broken link in card 4294.

## Design

1. **Pure detector** `findDanglingMarkdownLinks(text, { fromDir, exists })` in
   `we:scripts/lib/citation-check.mjs`, sibling of `findDanglingSymbolAnchors` (line ~1091). Strip fenced
   blocks and inline code, match `](<target>)` / `](<target>#frag)`, skip URLs (`https?:`, `mailto:`), site
   absolute (`/…`), pure fragments (`#…`) and `<repo>:` refs (already gate 5's job); resolve the rest with
   `path.posix.join(fromDir, target)` (reject escapes above repo root as "missing"); the `exists(repoRelPath)`
   callback keeps the fs out of the pure core (same shape as `readRepoFile`). Returns
   `{ link, resolved, reason: 'missing-file' }`. Fragment checking is out (see MVP).
2. **Wiring** in `we:scripts/check-standards.mjs` inside `scanAnchors` (line ~1685): after
   `findDanglingSymbolAnchors`, also run the new detector on the same file, emitting through `emit2`
   (WARN while `CITATION_GATES_ENFORCED` is false) with descriptor kind `citation-markdown-link`. It reuses
   `scopedReaddir`, so `--local --files=` judges only the lane's own changed files (#4168), and it covers the
   same four dirs (`we:backlog/`, `we:docs/agent/`, `we:agent-memory-src/`, `we:reports/`).
3. **Fix the live instance:** repoint the 4294 link to the `../../`-free correct relative form: up one level from the backlog dir, then into `we:docs/agent/platform-decisions.md` with the same `#local-gate-never-full-suite-by-default` fragment.
4. **Doc note** (guard 2) in `we:docs/agent/backlog-workflow.md` → *Authoring an item*: when correcting a
   card in place, either drop any "kept for the record" claim or keep the original text verbatim under that
   header — never label rewritten text as the record.

## MVP

Musts only:
- `findDanglingMarkdownLinks` pure detector + unit tests.
- Wired at WARN level into the existing reference-resolution scan (same dirs, same `--files` scoping).
- The 4294 link fixed; the workflow-doc note added.

Deliberately OUT (see Follow-ups): enforcing at error level, cleaning the 1,681-link backlog, `#fragment`
heading checks, scanning outside the four dirs.

## Test plan

In `we:scripts/__tests__/citation-check.test.mjs` (each fails RED because the export does not exist):
- **flags a relative link to a missing file** — a same-directory link to a nonexistent `.md` target from the `backlog` dir with an `exists`
  that returns false → one `missing-file` finding naming the resolved `backlog/…` path.
- **passes a resolving link, incl. `../` traversal** — a link going up one level then into the docs dir, with
  `exists` true for `we:docs/agent/platform-decisions.md` → no findings.
- **ignores non-relative targets** — `https://…`, `mailto:`, `/site/path/`, `#frag`, `we:x/y.md` → none.
- **ignores code** — a link inside a fenced block or inline backticks → none.
- **root boundary** — one `..` segment from the `backlog` dir resolves to the repo root (NOT an escape; a
  missing file there is an ordinary `missing-file`), while two or more `..` segments escape → finding, and `exists` never called with
  an escaping path.
- **dedupes** — the same link twice in a file → one finding.
- Source-level pin (style of `we:scripts/__tests__/check-standards-reference-scope.test.mjs`): `we:scripts/check-standards.mjs` imports the
  detector and calls it inside `scanAnchors` via `emit2` — RED until wired.

## Proof plan

- **Before:** `node we:scripts/check-standards.mjs --local --files=we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md`
  on the pre-fix tree — no warning about the broken link (record output).
- **After (detector wired, link not yet fixed):** same command warns
  `citation-markdown-link` naming the unresolved same-directory target. After fixing the link, same command is clean.
  Record all three outputs in the PR body.
- Full `npm run check:standards` on the lane: no new errors (warn-only), warning count delta recorded.

## Follow-ups

Each a future backlog item (the eventual builder files them):
- Ratchet: promote `citation-markdown-link` to ERROR for files changed in a diff (new debt blocked, old
  tolerated), then enforce fully once cleaned.
- Bulk-repair the 1,681 existing dangling relative links (mechanical: many are stale `../src/_data/…` cites).
- Optional `#fragment` check against the target file's headings/`{#id}` anchors.
- Extend the scan to `docs/` and `skills-src/` beyond the four dirs.
