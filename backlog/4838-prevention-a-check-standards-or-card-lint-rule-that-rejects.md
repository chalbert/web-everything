---
bornAs: xjgrrd6
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4716-trial-decision-models-jev-later-openai-decisions-api-in-shad.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — A check:standards or card-lint rule that rejects a card with status open and a literal 'TODO:' in its D… (from chalbert/web-everything#3773 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4716-trial-decision-models-jev-later-openai-decisions-api-in-shad.md:18` — A check:standards or card-lint rule that rejects a card with status open and a literal 'TODO:' in its Done-when section once it is marked ready for delivery. The rule could also require a Must line whenever the body says 'never gating' or 'must never'.
2. `we:backlog/4716-trial-decision-models-jev-later-openai-decisions-api-in-shad.md:16` — Add a lint on backlog cards that rejects a literal 'TODO:' in Done-when once status moves past open. Also require a Must line for any card whose body says 'never gate' or 'injection'.
3. `we:backlog/4716-trial-decision-models-jev-later-openai-decisions-api-in-shad.md:14` — Add a card-template checklist item for 'sends data to an external service', requiring a redaction and allowlist Must line. A deterministic version is a lint that flags cards mentioning external API names without a 'Must' on egress.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3773@25464f613f2542a2ae5e76a8f460f525bda83159

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
