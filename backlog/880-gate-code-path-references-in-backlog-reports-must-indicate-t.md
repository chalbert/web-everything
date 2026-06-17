---
type: issue
workItem: epic
status: open
dateOpened: "2026-06-17"
tags: [conventions, docs, gate, check-standards, locus]
relatedReport: reports/2026-06-17-backlog-split-analysis.md
crossRef: { url: /backlog/841-decide-the-we-contract-custom-element-tag-naming-convention-/, label: "triggered by the #841 ambiguity" }
---

# Gate: code-path references in backlog & reports must indicate their repo locus

Umbrella for establishing a repo-locus convention on code-path references in `backlog/*.md` and `reports/*.md` — every path carries a `<repo>:` prefix (`we:`/`fui:`/`plateau:`; in-repo links keep a clickable relative target, `[we:path](path)`) so a reader in chat/raw-md can tell which constellation repo it names. Surfaced as real confusion in #841, which this finishes. **Sliced (2026-06-17) into #883 (convention clause) → #884 (detection gate, warn-level) → #885 (mass migration + hard gate)** — see [reports/2026-06-17-backlog-split-analysis.md](reports/2026-06-17-backlog-split-analysis.md). The detail sections below are the seed reference for the slices.

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
