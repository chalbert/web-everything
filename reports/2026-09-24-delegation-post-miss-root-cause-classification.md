# Tooling-caused vs vendor-caused delegation misses — prior art for #4029's prep

**Date**: 2026-09-24
**Point**: industry root-cause practice (Google flaky-test quarantine, SRE blameless postmortems, ISO 9001 /
SCAR corrective-action review) all reinstate on a *proven fix against the triggering case*, never on trial
volume alone, and all keep classification out of the hands of the party whose work is being classified —
directly grounding #4029's forks on the post-miss re-graduation bar.
**Plan file**: none (operator-directed prep, not a `plans/` inbox item)
**Research page**: `/research/delegation-post-miss-root-cause-classification/`

---

## Question

#4029 asks whether a delegation-trial miss traced to *tooling/instructions* (not the vendor's own judgment)
should re-graduate at the ordinary cold-start bar once the fix is proven, instead of always paying the
higher post-miss bar `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` rule 5 sets
today. That rule (built by #3889) currently applies the higher bar (`minCleanStreak + k`) to *every*
confirmed miss, with no distinction for what caused it. Three sub-questions this survey grounds:

1. Does *any* real-world corrective-action discipline reinstate on "the fix is proven" rather than on a raw
   clean-trial count?
2. Who is allowed to classify a defect's root cause, and is self-classification (by the party the finding is
   against) an accepted practice anywhere?
3. Does fixing a shared/systemic cause ever transfer credit across otherwise-independent units (tests,
   suppliers, agents), or does each unit re-earn its own record?

## Key findings

**1. Google's flaky-test quarantine reinstates on proof-against-the-trigger, not on volume alone.**
Google's testing org quarantines a flaky test out of the blocking lane, but exit requires an identified
root-cause fix, not just a quiet run — a test is returned to the blocking lane once the root cause is fixed
*and* it has held a run of consecutive passes; quarantine is explicitly a temporary mitigation with an SLA,
never a substitute for the fix (Google Testing Blog, "Flaky Tests at Google and How We Mitigate Them", 2016;
corroborated by current industry guides, e.g. minware's flaky-test-quarantine best-practice writeup, 2026).
This is the direct analog for #4029 Fork 3/4: reinstatement pairs a *named fix* with *fresh evidence*, and
the fix alone (with no subsequent evidence) is never sufficient, matching rule 5's existing "root-cause note
first, then a bar to clear" shape — the open question this card adds is only *which* bar.

**2. SRE blameless postmortems: classification targets systems, and is reviewed, not self-declared.**
Google's SRE book (`sre.google/sre-book/postmortem-culture/`) and the surrounding practice literature treat
"human error" as a red flag that stops the investigation too soon, not a valid terminal classification —
the discipline pushes root-cause analysis (e.g. "5 Whys") past the first plausible-looking answer to the
systemic condition that allowed it. Corrective actions are tracked separately by whether they change a
system/process or merely "retrain a person" — mirroring #4029's split (tooling/instruction fix vs "the
vendor itself"), and the postmortem is reviewed by people other than the party whose action is being
examined, not self-certified.

**3. ISO 9001-lineage Corrective and Preventive Action (CAPA) / Supplier Corrective Action Request (SCAR):
root cause is investigated, then reviewed by the requesting org, and "operator/vendor error" as a terminal
answer is explicitly pushed back on.** A SCAR requires the supplier to run a structured root-cause method
(5 Whys, 8D, fishbone) and submit it back to the *requesting* organization for review — practitioner guidance
is explicit that reviewers should push back on "operator error" as a terminal root cause and demand the
underlying process gap (Wikipedia, "Corrective and preventive action"; ComplianceQuest/MasterControl/Arena
SCAR glossaries, 2026). The classifying party is never only the party under review — directly grounding
#4029 Fork 2's requirement that `rootCauseClass` be a human-authored field, never inferred or self-declared
by the dispatch automation or the delegated vendor's own session.

**4. No surveyed discipline lets one unit's fix transfer credit to another unit's record without that unit
re-accumulating its own evidence.** Flaky-test quarantine, SCAR, and postmortem corrective-actions are all
scoped to the failing unit (the specific test, the specific supplier's line, the specific finding); a shared
root cause (e.g. a library used by ten suppliers) still requires each supplier's own corrective-action
record to close, even when the same root-cause finding is cited across all of them. This grounds #4029
Fork 5's default: a `rootCause` note may be **cited** across every affected triple's row (the diagnosis is
reusable text), but each triple accumulates its **own** post-fix trial evidence — matching rule 1's
already-ratified "trust never carries across triples."

## What this does not settle

None of the three disciplines surveyed map a *numeric* bar onto "proven" (none say "N clean trials" as the
exit criterion — they say "the fix, then fresh evidence of typical scope"), so this survey does not by
itself fix what #4029 Fork 4 calls the "shorter" door; it only supports that the ordinary cold-start bar,
not a fixed lower number, is the correct default, with any lower number deferred to a future ordinary
batched finding exactly as rule 3 already requires for `minCleanStreak`/`k` themselves. The call itself, the
forks, and the ratification are on `we:backlog/4029-a-tooling-caused-delegation-miss-re-graduates-on-the-normal.md`,
not here.

## Files created/modified

| File | Action |
| --- | --- |
| `we:reports/2026-09-24-delegation-post-miss-root-cause-classification.md` | created (this report) |
| `we:src/_data/researchTopics/delegation-post-miss-root-cause-classification.json` | created |
| `we:src/_includes/research-descriptions/delegation-post-miss-root-cause-classification.njk` | created |
| `we:backlog/4029-a-tooling-caused-delegation-miss-re-graduates-on-the-normal.md` | rewritten to the prepared-fork shape |
| `we:backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role.md` | `relatedTo` gains `4029` |
| `we:backlog/4029-a-tooling-caused-delegation-miss-re-graduates-on-the-normal.md` | also gains `blockedBy: ["3949"]` — trial logging must resume before computed demotion can be observed |
