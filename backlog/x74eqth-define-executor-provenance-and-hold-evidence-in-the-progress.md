---
kind: story
locus: webeverything
size: 2
parent: "4624"
status: open
blockedBy: ["x9jwbpi"]
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts"]
dateOpened: "2026-10-01"
tags: []
---

# Define executor provenance and hold evidence in the progress contract

Extend the WE progress contract with validated owner, supervisor, executor and requested-versus-reported model evidence, plus structured overlap and capacity hold observations. Preserve existing schema-2 and schema-1 snapshots so Plateau can adopt the populated contract before publishing new fields.

## Lineage and delivery boundary

This story carries its assigned part of the prepared Design, Test plan and Proof plan in we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md. Keep the all-configured-repos/all-authors goal, visible unmatched work, explicit unknowns, 120-second baseline and existing action/fork flows. No new dispatch policy, launcher registration, paid probe, or display-driven GitHub call. Parent grouping does not satisfy prerequisites: use the explicit blockedBy edges. Reconcile landed dependency revisions before building; the split itself claims no runtime proof.

## Design

Observed seam: we:contracts/plateau-progress-view.schema.json:185 defines run identity and linkage, but :327 explicitly excludes executor/model inference; :329 defines basic holds without typed capacity or overlap evidence. Unknown additional properties currently pass, which is not a validated contract for those fields. The existing declarative harness at we:contracts/plateau-progress-view.test.ts:10 and named examples at we:contracts/plateau-progress-view.examples.json are the reusable conformance demo.

Extend schema 2 additively: optional-but-validated owner, author, origin, supervisor and executor provenance; distinguish requested model from reported provider/model and evidence, with null for unattested values. Add structured overlap counterpart and safe repo-qualified file evidence, observed capacity usage/limit with timestamp/source, and hold source identity. Existing required run/hold fields and old examples remain valid. Describe missing new fields as unknown, never an inferred default. Keep source-local freshness, raw unknown states, parent/logical-work links and separate count units. No runtime computation belongs in WE; follow we:docs/agent/platform-decisions.md#surface-contract-not-computation and #constellation-placement, with per-repo lineage #4289.

## Done when

1. Populated examples validate for every producer family, standalone/cardless jobs, one parent and child, requested/served mismatch, explicit unknown attribution, overlap, preparation and capacity holds. Old schema-1 and schema-2 examples still validate.
2. Invalid provenance shapes, negative capacity, malformed observation times, negative counts, absent source freshness and unknown majors fail specific assertions. Document temporal/count joins as consumer responsibilities, not schema promises.
3. Run the focused contract suite and required WE gates; record commands/results on this story. No package, runtime or shared agent documentation changes are needed.

## Test plan

Write declarative positive/negative cases first in we:contracts/plateau-progress-view.test.ts. Today malformed additional provenance fields pass unvalidated, so the new negative assertions must fail before the schema change. Mutate requested evidence into reported-only shape and remove required evidence members from a populated object; the corresponding case must reject it. The named fixture corpus is the independently usable artifact for subsequent consumers.

## Scope budget and Follow-ups

Predicted implementation: 3 explicit paths; one contract area. Even allowing this WE backlog card as one bookkeeping path/area stays below 20 paths and 4 areas. No broad directory scope. If prerequisite drift changes the touch-set, re-probe and re-slice before exceeding the gate. Record testing lessons here, never in shared agent docs. Arbitrary custom-log registration/heartbeat remains a separate producer follow-up; keep discovery coverage partial until proven.
