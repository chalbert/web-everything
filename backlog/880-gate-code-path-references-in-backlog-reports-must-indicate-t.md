---
type: issue
workItem: story
size: 13
status: open
dateOpened: "2026-06-17"
tags: [conventions, docs, gate, check-standards, locus]
crossRef: { url: /backlog/841-decide-the-we-contract-custom-element-tag-naming-convention-/, label: "triggered by the #841 ambiguity" }
---

# Gate: code-path references in backlog & reports must indicate their repo locus

File-path references in backlog items and reports (e.g. `src/_data/blocks.json`) are ambiguous about which constellation repo they live in — the same relative path names different files in WE vs frontierui vs plateau-app, and a reader in chat/raw-md can't tell. Surfaced as real confusion in #841. Establish a convention: every code-path reference carries a `<repo>:` locus prefix (aliases `we:`/`fui:`/`plateau:`; in-repo links keep a relative target so they stay clickable — `[we:path](path)`), codified in docs/agent/conventions.md and enforced by a new check:standards gate that flags bare path-like tokens lacking a locus marker. Includes a one-time migration of existing backlog + reports references (finishes #841). Open knobs (body): alias-vs-full-name; rollout scope.

## Not batchable — resized 5→13 (2026-06-17, batch-2026-06-17 pre-flight)

Surfaced as Tier-A but pre-flight shows it is three things in one, each non-trivial: (1) **codify the convention** in conventions.md; (2) **a new check:standards gate** with a heuristic that distinguishes a code-path token from ordinary prose / version numbers / URLs *and* accepts the `<repo>:` form — a high-false-positive design problem across 866 backlog + 100+ report files; (3) a **one-time mass migration** of every existing path reference, which is a stop-the-world-class bulk rewrite that races concurrent `claim`/`resolve` splices (the same quiescence hazard as #487). Plus the body's own **open knobs** (alias-vs-full-name — soft-defaulted to aliases; rollout scope). Genuinely ≥13 and best split (convention/decision · gate-build · migration). Resized so it drops from the batch pool; needs a focused session. Finishes #841.

## Why

The constellation has three repos: **webeverything** (the standard), **frontierui**
(the impl), **plateau-app** (the product). A backlog item routinely cites files in all three. A bare relative
path like `src/_data/blocks.json` resolves *as a link* in the WE docs site (the backlog lives in WE), so a
reader on the rendered page is fine — but in chat, in raw markdown, and especially when the *same* relative
path exists in two repos (WE has `src/_data/blocks.json`; FUI has its own `blocks.json`), the locus is
genuinely ambiguous. #841 hit this: "when you say `src/_data/blocks.json` it's not clear which repo."

## The convention (the rule)

Every code-path reference in `backlog/*.md` and `reports/*.md` **must indicate its repo locus**. The locus is
written as a `<repo>:` prefix on the **visible reference text**:

- **In-repo (webeverything):** keep the relative link *target* (so it stays clickable on the docs site) and
  put the locus in the *link text*: `[we:src/_data/blocks.json](src/_data/blocks.json)`.
- **Cross-repo (frontierui / plateau-app):** the path can't resolve here, so it's plain text with the prefix:
  `fui:blocks/droplist/AutoComplete.ts:444`, `plateau:src/domains/…`.
- Line refs ride the path as today: `we:scripts/gen-cem.mjs:164-194`.

Locus tokens align with the constellation repo dirs; short aliases are the authored default for readability:

| Repo | Full | Alias (default in prose) |
|---|---|---|
| webeverything | `webeverything:` | `we:` |
| frontierui | `frontierui:` | `fui:` |
| plateau-app | `plateau-app:` | `plateau:` |

## The gate (enforcement)

A new `check:standards` check scans `backlog/*.md` + `reports/*.md` for **path-like tokens** — a regex on
`[\w./-]+\.(ts|tsx|js|mjs|cjs|json|md|njk|css|html|yml|yaml)(:\d+(-\d+)?)?` — and flags any that is **neither**
(a) inside a relative markdown link whose text carries a locus prefix, **nor** (b) immediately preceded by a
recognized `<repo>:`/alias token. Must avoid false positives on: fenced code blocks, npm package specifiers
(`@frontierui/blocks`), URLs, and the frontmatter `relatedReport`/`graduatedTo`/`crossRef` fields (which are
WE-relative by construction — exempt or auto-prefixed).

## Open knobs (bold-defaulted — ratify at build)

- **Alias vs full repo name.** → **Allow both; default authored form is the short alias** (`fui:`), full name
  accepted. Rationale: brevity in dense prose; the gate normalizes either.
- **Rollout scope.** → **Migrate the whole corpus in one pass, then gate hard.** A changed-only gate is more
  complex (needs diff awareness `check:standards` doesn't have) and leaves the corpus permanently mixed. The
  one-time migration is mechanical (regex + locus inference: a path that exists in WE's tree → `we:`, else
  resolve against the FUI/plateau trees). Risk: a path ambiguous across two repos needs human disambiguation —
  log those for manual pass rather than guess.

## Scope / done-when

- [ ] Convention clause added to [docs/agent/conventions.md](docs/agent/conventions.md) (the machine-checked
  naming authority #841 also targets).
- [ ] `check:standards` check implemented with the false-positive carve-outs above; green on a migrated corpus.
- [ ] One-time migration of existing `backlog/*.md` + `reports/*.md` (includes finishing #841, partially
  modelled already).
- [ ] Authoring note in the backlog-workflow doc so new items comply from creation.
