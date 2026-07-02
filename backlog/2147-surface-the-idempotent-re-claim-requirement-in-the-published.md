---
kind: task
status: open
dateOpened: "2026-07-02"
tags: []
---

# Surface the idempotent-re-claim requirement in the published webdirectives hydration expectations

Rule 5 as amended by #1989 makes idempotent-under-re-claim a normative conformance requirement on directive application (hydration re-claims the applied region's markers; rows keyed via data-key). The published webdirectives spec's Client Hydration Expectations section (we:src/_includes/project-webdirectives.njk#ssr-hydration-expectations) does not state it — add the normative clause there so external renderers/clients see the requirement, not just the agent statute.
