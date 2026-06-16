# Skill Authoring — keep `.claude/skills/*/SKILL.md` thin

> Tier-2 reference. Read before adding or editing a skill. The rule that prevents skill rot:
> **a skill is a *trigger + pointer + quick path*, never a copy of the rubric.** Rules live in
> `docs/agent/*.md`; the skill points at them and gives the command sequence.

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
