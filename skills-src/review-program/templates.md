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
  vs the prior run — what went stale / what stayed green>. Goal-set coverage <M/N elements live; residuals
  filed or "complete against goal-set">. Front B <swept via <method>: the external delta that matters>.
  <Decisions ratified / steers folded this run, if any.> Filed <N> children — <#NNN one-line each>.
  **Next run:** <the 1–3 concrete next actions — re-measure X, re-sweep Y (idempotent), build/decide #NNN>.
```

## 2. Living-report run section (append to `reports/<first-run-date>-program-<slug>.md`)

```md
---

## Run <N> — <YYYY-MM-DD> (<lens / focus>)

<One line: what this run focused on and why.>

### Front A — conformance (re-measured)

- **<metric>** — <value + delta vs prior run; cite `check:<gate>`>.
- <…>

### Front A — goal-set coverage (the completeness pass — **required every run**)

Enumerate the program's finite goal-set, map each element to a live child **and** to code (see §4).

| Goal-set element | Child | In code? | Verdict |
|---|---|---|---|
| <target 1> | #NNN (<status>) | ✓ / stub / — | covered / **residual** / reopened-gap |
| <…> | | | |

**Coverage: <M/N> live.** Residuals filed this run: <#NNN one-line each — or "none; program complete against its goal-set">.

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

---

## 4. Deriving the goal-set (the front-A completeness pass — the hard, judgment part)

The completeness check is only as good as the goal-set you diff against. **A program is externally dry far
more often than it is internally complete**, so this pass is where most living programs owe work. How to
get the set, in order of preference:

1. **Listed in the body.** Many programs already enumerate their targets — a table of design systems
   (#1226), an axis catalogue (#1399), a captured-gaps list (#1522). Use it verbatim as the goal-set.
2. **Reconstruct from the goal statement** when the body never listed one. The north star names a *kind*
   ("an adapter for every target", "a WE-standard equivalent for every framework feature #1258 tracks",
   "find every issue on any app") — enumerate the members of that kind from the authoritative source the
   program already cites (the adapter-target registry; the framework-feature list; the issue-class
   taxonomy). **An unlisted goal-set is itself a finding** — the program has been running on whatever got
   filed, never against its full scope; note it and consider filing a card to *record* the goal-set in the
   body so future runs diff against a stable list.
3. **Map each element two ways — child AND code.** A goal-set element is only *covered* when a resolved
   child exists **and** the capability is in code. Element with no child → **residual** (file it). Child
   but stubbed/absent code → **reopened-gap** (a resolved-but-not-in-code child, per loop step 1).
4. **File the residual regardless of the front-B delta.** Completeness is owed even on a run where nothing
   external moved. Fill the §2 coverage matrix every run — a run that legitimately files 0 residuals still
   records the matrix showing the program *is* complete against its goal-set (the honest 0, not a skipped
   check).

Goal-set kinds seen so far (extend as new archetypes appear): **reproduction targets** (#1226 design
systems), **adapter target-kinds** (#1451), **framework features → standard equivalents** (#1258),
**discovery axes** (#1399), **capability/issue classes** (#1522 explorer). Each is a finite list you can
enumerate and diff.
