---
kind: task
status: resolved
dateOpened: "2026-07-08"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
tags: []
---

# Drain park comment fires for non-human parks only (review:human owned by #2324 body-block)

Follow-up to the #2313 review (PR #217). Today a review:human park gets BOTH #2324's escalation-reason body-block AND #2313's park comment carrying the same reasons — redundant (harmless, but duplicated on the PR). Refine we:scripts/merge-ai-prs.mjs's park path so the drain park comment fires only for NON-human (agent-reviewable) parks; the humanRequired case is surfaced by #2324's body-block alone. Small localized change — wrap the postDrainReasonComment('park', …) call in the else of if(gate.humanRequired) — plus a unit test asserting no park comment on a humanRequired park. The exact delta was drafted in the closed PR #221. relatedTo #2313, #2324.
