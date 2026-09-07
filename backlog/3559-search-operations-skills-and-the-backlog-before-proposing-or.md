---
bornAs: xwr3jt9
kind: story
size: 3
status: open
dateOpened: "2026-09-07"
tags: [reuse, discovery, operations, backlog, agent-habit]
relatedTo: ["3001", "3029", "3277", "3383", "3554"]
scope:
  - we:scripts/capability-search.mjs
  - we:scripts/__tests__/capability-search.test.mjs
  - we:skills-src/capability-search/SKILL.md
---

# Search operations, skills, and the backlog before proposing or building a new capability

No standing habit or tool makes searching for an existing operation/skill **and** an existing filed backlog
item a routine first step before proposing or building something new — it only happens when a person thinks
to ask "do we already have that?" Two real misses from the same night (2026-09-06) show the pattern, not a
one-off:

- **A tool was rebuilt from scratch that already had a near-match.** `we:scripts/conveyor/reconcile-finding.mjs`
  was built fresh on 2026-09-05 (PR #1945) for a capability the operator asked for. The operations↔skills
  audit run later the same night, [#3554](/backlog/3554-finish-and-manual-rebase-work-have-no-pointer-to-the-reconci/),
  found it maps almost exactly to the motivating use case `we:skills-src/finish/SKILL.md` *itself* already
  describes ("a rebase agent" discovering a sequencing conflict against a sibling decision on `main`) — and
  nothing had checked whether an equivalent already existed, or was already named as a need, before building
  it. `#3554` is now resolved (the pointer was added after the fact), but the build itself happened with no
  search step first.
- **An idea was proposed as brand-new when it was already filed two weeks earlier.** A "decision docket /
  Artifact for reviewing a prepared decision" idea was raised as a fresh proposal the same night. A backlog
  search — run only because the operator explicitly asked "check if we have that" — found it was already
  filed as [#3277](/backlog/3277-declare-an-operation-that-publishes-and-refreshes-a-decision/) ("Declare an
  operation that publishes and refreshes a decision or architecture artifact," filed 2026-08-25, still
  `status: open`), sitting unbuilt the whole time. The check was not a routine step; it happened because a
  person happened to think of it.

**The gap, precisely.** Nothing makes "search the codebase for an existing operation/skill AND search the
backlog for an existing filed item" a routine first step before proposing or building something new. It is
cheap to do and it keeps not happening, because doing it depends entirely on a session happening to remember.

## Proposal: a `capability-search` skill over two existing surfaces, read-only

Per the ratified [#3001](/backlog/3001-should-agents-call-named-operations-instead-of-writing-shell/) split
(reads/inspection stay free, broad, and agent-run; only mutations go through the typed operation engine), this
is a **read-only search**, not a mutating operation — it needs no `op()` declaration on
`we:scripts/operations/registry.mjs` (the engine [#3029](/backlog/3029-operation-engine-declare-a-delivery-operation-once-generate-/)
is building), just a plain script any session can run directly, the same shape as
`we:scripts/gap-sweep-status.mjs` or `we:scripts/check-readiness.mjs`.

**`we:scripts/capability-search.mjs <concept text>`** searches two existing surfaces for anything that already
matches the concept being considered, and reports one of three verdicts — never silently "nothing here,
proceed":

1. **The operation/skill surface** — `we:scripts/operations/registry.mjs` (declared operations),
   `we:scripts/operations/*.mjs` (the ~65 raw-CLI scripts the [#3001](/backlog/3001-should-agents-call-named-operations-instead-of-writing-shell/)
   sizing report already counted), `we:skills-src/*/SKILL.md` (title + frontmatter `description`, the source
   of truth a skill deploys from — not the generated `we:.claude/skills/` copy), and
   `we:scripts/conveyor/*.mjs` (file header `@description` blocks, the same doc-comment shape
   `we:scripts/conveyor/reconcile-finding.mjs` itself carries).
2. **The backlog surface** — `we:backlog/*.md` titles, digests, and tags (the same corpus
   `we:src/_data/backlog.js` already loads), so a filed-but-unbuilt idea like `#3277` surfaces before it's
   proposed a second time.
3. **The verdict** — printed compact, `--json` for machine use: **exact match** (name the file/operation/skill/
   backlog item and why), **partial/related match** (name the closest hits, let the session judge relevance),
   or **genuinely nothing found** (safe to propose/build). Matching itself is deterministic (grep/keyword,
   scored by term overlap) — the *relevance judgment* on a partial match stays with the session, per the same
   deterministic-core/thin-judgment split [#3001](/backlog/3001-should-agents-call-named-operations-instead-of-writing-shell/)
   already draws and [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](/docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
   codifies: the script cannot reliably *decide* "this is the same thing," it can only surface candidates
   cheaply and let the agent read the top few.

A thin `we:skills-src/capability-search/SKILL.md` wraps it per
[we:docs/agent/skill-authoring.md](/docs/agent/skill-authoring.md) (trigger + pointer + the one command),
invocable as `/capability-search <concept>` or `/exists <concept>` before proposing or building anything new.

## Open question, not resolved here — skill-only vs. a referenced gating step

**Fork not silently picked; both sides genuinely arguable.**

- **(a) Skill only, invoked at a session's own discretion.** Cheap, ships now, adds nothing to maintain in
  other docs. Risk: this is close to the status quo that produced both misses above — the tool existed in
  spirit (a person could always have grepped `backlog/` or `scripts/operations/`) and the habit still didn't
  form. A skill nobody remembers to invoke doesn't close the gap it's named for.
- **(b) Also wired as a referenced step other build-dispatch briefs are expected to follow** — the same shape
  `we:skills-src/pr/SKILL.md` already uses for "never hand-roll `gh pr create`," or how
  `we:skills-src/mechanical-delivery-doctrine/SKILL.md`'s rule 2 makes "never a bespoke prompt" a standing,
  cited rule rather than a habit. Concretely this would mean a line in
  `we:skills-src/conveyor/delivery-agent-brief.md` and/or the mechanical-delivery-doctrine rule list: before a
  dispatched agent scaffolds a new operation/skill/script, run `capability-search` first. Cost: another doc
  site to keep current, and it only reaches *dispatched* agents — neither miss above happened inside a
  dispatched build (the reconcile-finding build was an ad hoc operator ask; the decision-docket idea surfaced
  in live conversation), so a gate wired only into the dispatch brief would not have caught either real
  instance cited on this card.

**My read:** build the skill now (build-ready, below) — it is unambiguously useful and low-cost regardless of
how the gate question resolves. Whether to *also* promote it to a referenced/expected step is better decided
once the skill has real invocations to point at (does it actually get used unprompted, or does the gap
persist?) — deciding that now would be picking a gate's shape before there's evidence it's needed, the same
over-fitting risk a rule like [#3405](/backlog/3405-ratify-the-agents-never-run-commands-only-the-mechanical-lay/)
avoided by starting narrow and letting concrete cases force expansion. If a fresh miss surfaces after this
skill exists and *would* have been invoked-but-wasn't, that is the evidence to file the gate as its own
follow-up story.

## Done when

1. **Executable** — `node we:scripts/capability-search.mjs "publish and refresh a decision or architecture
   artifact" --json` surfaces `#3277` in its backlog-surface results, pinning tonight's second miss as a
   regression fixture.
2. **Executable** — `node we:scripts/capability-search.mjs "post a blocking sequencing finding on a PR from a
   rebase agent" --json` surfaces `we:scripts/conveyor/reconcile-finding.mjs` (or its owning skill) in its
   operation/skill-surface results, pinning tonight's first miss as a regression fixture.
3. **Observable** — `we:skills-src/capability-search/SKILL.md` exists, conforms to
   [we:docs/agent/skill-authoring.md](/docs/agent/skill-authoring.md)'s canonical shape, and is under ~120
   lines.
