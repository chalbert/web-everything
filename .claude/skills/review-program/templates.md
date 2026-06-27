# Review-program output templates (#1880)

Fill-in-the-blank scaffolds for the per-run outputs of a program watch, so each
[/review-program](SKILL.md) run is low-effort and consistent. Copy the relevant block, replace every
`<…>` placeholder, delete the guidance comments. The judgment (what the delta *means*, which candidates
to file) stays human — these only remove the formatting toil.

For the **front-A measurement** of the model-usage watch (#1855), get the numbers in one shot:
`node scripts/check-memory.mjs --json` (index size / headroom / line + file counts / orphan list /
corpus skew) — paste them into the metrics lines below instead of re-grepping.

---

## 1. Review-log entry (append to the program item's `## Review log`)

```md
- **<YYYY-MM-DD> — <run label, e.g. "second run (memory lens)">.** Front A <measured: key metric deltas
  vs the prior run — what went stale / what stayed green>. Front B <swept via <method>: the external
  delta that matters>. <Decisions ratified / steers folded this run, if any.> Filed <N> children — <#NNN
  one-line each>. **Next run:** <the 1–3 concrete next actions — re-measure X, re-sweep Y (idempotent),
  build/decide #NNN>.
```

## 2. Living-report run section (append to `reports/<first-run-date>-program-<slug>.md`)

```md
---

## Run <N> — <YYYY-MM-DD> (<lens / focus>)

<One line: what this run focused on and why.>

### Front A — conformance (re-measured)

- **<metric>** — <value + delta vs prior run; cite `check:<gate>`>.
- <…>

### Front B — currency (<sweep method>)

<What the discovery surfaced — new / moved / obsoleted in the external landscape. Cite sources.>

### Outcome

- <Strategy/decision codified, if any — name the permanent doc + anchor.>
- <N> children filed — **#NNN** <hook> · …

**Next run:** <concrete next actions>.
```

## 3. Candidate-card skeletons (scaffold only the newly-appeared items)

Run: `node scripts/backlog.mjs scaffold --kind=<kind> --size=<n> --parent=<program-NNN>
--title="<title>" --digest="<lead prose, no **Label:** lead>"`, then fill the body.

### 3a. Story (a buildable slice the watch surfaced)

```md
# <Title>

<Lead: what this builds and the front-A/front-B gap it closes. Link the program [#NNN](/backlog/<slug>/).>

## Scope
- <bullet>

## Boundaries
- <what's explicitly out of scope / deferred to a sibling>

## Lineage
Surfaced <YYYY-MM-DD> in the <ordinal> [#<program>](/backlog/<slug>/) watch run (<front + signal>).
Report: [we:reports/<living-report>.md](../reports/<living-report>.md).
```

### 3b. Decision (a fork the watch surfaced — discuss, don't auto-build)

```md
# <Title>

<Lead: the tension + what is genuinely open. Link the program.>

## Fork 1 — <axis>
*Fork-existence:* <why both branches are legit end-states>.
- **(default) <branch A>** — <why>. *Confidence: <…>.*
- **(b) <branch B>** — <why weaker / when it'd win>.

## Boundaries / lineage
<Scope; un-prepared note (run /prepare before ratifying); surfaced under [#<program>](/backlog/<slug>/).>
```
