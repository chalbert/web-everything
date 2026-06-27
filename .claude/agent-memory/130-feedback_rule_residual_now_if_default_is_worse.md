---
name: feedback_rule_residual_now_if_default_is_worse
description: "in a decision, rule a deferrable residual now if the realizing build's path-of-least-resistance default is the WRONG one (deferring = silently picking the bad default)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ba1182f0-5e5c-4329-b4ca-15e16e082f27
---

When a decision leaves a sub-question ("residual") to the post-ratification realizing build, don't
reflexively defer it as "a build detail, not a blocker." First check the build's **path of least
resistance** — the default a builder reaches for with no ruling to cite. If that default is the
*worse* answer, deferring is not neutral: it **silently decides the residual the wrong way**.

**Why:** a residual that looks "deferred for later judgment" actually resolves itself the moment the
build runs, by whoever is least equipped to weigh it, toward whatever is mechanically easiest.

**How to apply:** for each residual ask "if I say nothing, what does the build do by default, and is
that right?" If wrong → rule it *in the decision* (one extra sentence). If genuinely open/cheap-either-way
→ defer, but file it as its **own** small decision item, never leave it as prose in the build card.

Worked example — #1427 (cross-intent tone): the "which values enter the shared `--tone-*` palette"
residual looked like a webtheme detail. But a "define the palette" build's default is to dump the
**union** of every intent's values, which re-flattens the palette (`progress`/`categorical` sneak in) —
exactly the [[project_platform_decisions_statute_layer]] separation #1318 forbids. So I ruled the roster
*now* (severity-family only) instead of deferring. Relates to [[feedback_misflagged_batchable_fix_real_state]]
(fix the real state, don't punt) and the "silent default" anti-pattern.
