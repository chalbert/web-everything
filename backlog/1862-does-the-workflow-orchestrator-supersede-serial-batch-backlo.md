---
kind: decision
parent: "1855"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Does the Workflow orchestrator supersede serial batch-backlog-items?

A /workflow skill already exists for running backlog items in parallel disjoint lanes, yet batch-backlog-items still runs serially. Decide the relationship: keep both (serial for tightly-coupled clusters, Workflow for provably-disjoint lanes), fold batching into Workflow, or keep serial as the default and treat Workflow as opt-in. Downstream note: adopting agent({schema}) structured output for readiness ranking and decision-fork parsing rides on whichever orchestration path wins. Front-B currency call for the model-usage watch (#1855).
