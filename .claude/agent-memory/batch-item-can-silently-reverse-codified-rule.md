---
name: batch-item-can-silently-reverse-codified-rule
description: "a batch story can contradict a ratified decision codified only in code — reclassify to decision, don't implement; grep the rule the change touches"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2df4ce80-89ce-461f-99dd-e700d69e4021
---

A batchable `story`/`task` can be an **unflagged decision**: it prescribes an edit that *reverses a ratified decision codified only in code* (a comment/const in the impl file), not in the item body — so the pre-flight body-skim can't catch it and the selector treats it as agent-ready.

**Why:** #2149 asked to add `we:package.json` + `we:.eleventy.js` to `RESERVED_MERGE_RISK` in `scripts/readiness/lane-partition.mjs` — which directly reverses ratified #1952 (build config *deliberately removed* from that blacklist, rationale codified in the file's own header comment). The item cited nothing, so nothing surfaced until I read the code being edited.

**How to apply:** during a batch, before implementing an item that edits a rule/registry/config, **grep the codified rule the change would touch** (the file header, the const's rationale, `platform-decisions.md`), not just the item body. If the change reverses a ratified/codified call, it is a decision: **reclassify `kind: decision`, state the fork with a bold default, add `relatedTo` the reversed item, release the claim — never silently implement it** (a merit fork, not a mechanical edit). Extends [[merit-forks-not-prioritization]] and [[verify-ratified-citation-against-live-status]] to the case where the item doesn't cite the decision at all. See rule 25 (Platform Decisions = Statute Layer) and 39 (Never Take An Unprepared Decision).
