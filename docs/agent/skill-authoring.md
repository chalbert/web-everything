# Skill Authoring — keep `skills-src/<name>/SKILL.md` thin

> Tier-2 reference. Read before adding or editing a skill. The rule that prevents skill rot:
> **a skill is a *trigger + pointer + quick path*, never a copy of the rubric.** Rules live in
> `docs/agent/*.md`; the skill points at them and gives the command sequence.

## Where a skill actually lives — edit the source, never a deployed copy

A skill is **git-tracked project content, exactly like code** — same lane-clone + PR discipline, no
carve-out. The one and only place to author or edit one is **`skills-src/<name>/SKILL.md`** in this repo.
Two other paths *look* like a skill but are not where you edit:

- **`.claude/skills/`** (this repo's project-scoped skill dir) is a **real symlink to `../skills-src`**
  (verified: `ls -la .claude/skills` → `.claude/skills -> ../skills-src`). Bytes written through that path
  physically land in `skills-src/`, so nothing is silently lost — but don't edit through it anyway: outside
  a lane, `scripts/guard-lane.mjs` denies the write. The guard resolves the target's **realpath** before
  deciding, so `.claude/skills/<name>/SKILL.md` and `skills-src/<name>/SKILL.md` resolve to the same
  tracked file under the primary checkout and are both denied — there's no skills-specific carve-out, it
  falls under the same primary-checkout rule as any other tracked file (the same reasoning `guard-lane.mjs`
  already applies to `agent-memory-src/`). *backlog-workflow.md → Working an item* has the full rule.
- **`~/.claude/skills/<name>/`** (the user-global deploy tree, outside this repo entirely) is a **plain
  copy**, not a symlink, produced by `scripts/sync-skills-deploy.mjs` (`npm run skills:sync`). It is
  outside any repo, so nothing machine-enforces this — but hand-editing a file there **diverges silently
  from source**: the next sync overwrites every tracked file the source still has (clobbering your local
  edit with no warning) while an untracked stray file is only *reported* as drift (`--check`), never
  auto-removed (`--prune` is opt-in). Either way, an edit made there is not the record — `skills-src/` is.

**The deploy mechanism, so a merge actually takes effect:** `.githooks/post-merge` runs
`sync-skills-deploy.mjs` automatically whenever a merge touches `skills-src/`, but **only re-syncs skills
already present** at `~/.claude/skills/` — by design, so a WE-specific orchestration skill (`drain`,
`batch-backlog-items`, `conveyor`, …) never leaks into an unrelated project's global skill tree. A
**brand-new** skill's first deploy there needs an explicit `npm run skills:sync -- --only=<name>` (or
`--all`, used when bootstrapping an ephemeral VM — see `docs/agent/vm-sessions.md`). The project-scoped
copy needs no such step: once your checkout's `main` has the merge, `.claude/skills/<name>/SKILL.md`
exists immediately via the symlink.

**Creating a new skill:** in a lane clone, add `skills-src/<name>/SKILL.md` with the frontmatter +
canonical shape below, land it via the normal `/pr` pipeline. That's the only "registration" required for
this repo to pick it up. A `.claude/commands/<name>.md` shortcut alias (see the existing `backlog`,
`batch`, … entries) is optional convenience, not required for discovery.

## The one discipline (the 80% fix)

**When a method changes, edit the doc — not the skill.** A skill update adds a *pointer* to the
already-edited `docs/agent/*.md` section, never a fresh prose restatement of the rule. The failure this
kills: every fix re-states a rule "to be safe," and over months the skill re-grows a full copy of the
rubric (the 2026-06-16 pass cut ~840 → ~590 lines doing nothing but removing those copies). If you catch
yourself explaining *why* a rule holds inside a skill, that paragraph belongs in the doc.

## The canonical shape

Every `SKILL.md` is, in order:

1. **Frontmatter** — `name` + a `description` that says what it does and when to trigger it. Don't touch
   it for a method change.
2. **H1 title** — short.
3. **Trigger + pointer** — one paragraph: *"the method lives in `*<doc>.md → Section*`… Don't restate
   the rubric here; if the method changes, edit that doc."* State it **once** (top). Don't repeat it as a
   bottom footer — the top+bottom "don't duplicate" dup was a recurring waste.
4. **Quick path / The loop** — the numbered command sequence (the happy path). **One** list, not a
   "Quick path" *and* a "When invoked" list covering the same arc.
5. **Trailing edge-case rules** — only what's genuinely skill-specific (a stop rule, a drop classifier)
   and not owned by a doc.

## Style rules (what "good shape" means, checkably)

- **Pointer form is `*<doc>.md → Section*`** — italic, arrow, no bold, no quotes, no repeated full
  markdown link. One canonical full link up top is fine; everything after is the short form.
- **Bold one key term or the CLI verb per step** — not whole clauses or sentences. When most of a
  paragraph is bold, none of it reads as emphasis.
- **No internal duplication** — a rule stated once. If three sections each re-explain "claim first,"
  state it once and point the other two at it.
- **No rubric restatement** — if `backlog-workflow.md` / `design-first.md` owns a rubric (the
  split-safety conditions, the prepared-fork shape, the stop rule's full text), the skill gives the
  one-line instruction + the pointer, never the full rubric.
- **Keep it under ~120 lines.** A skill creeping past that is the tell that rubric prose has leaked back
  in — move it to the doc.

## When you touch a skill

1. Make the *method* change in `docs/agent/*.md`.
2. In the skill, add/adjust the **pointer + the command**, nothing more.
3. Re-read the skill end-to-end: did you add prose a pointer could carry? Cut it.

A periodic uniformity sweep (re-run the 2026-06-16 pass) is the backstop, not the plan — the discipline
above is what keeps the sweep from being needed.
