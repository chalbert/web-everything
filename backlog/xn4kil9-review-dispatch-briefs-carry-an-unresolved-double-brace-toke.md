---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:skills-src/review/review-agent-brief.md", "we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# review-dispatch briefs carry an unresolved double-brace token in the template header

FOUND 2026-09-20. Every run of node we:scripts/operations/review-dispatch.mjs prints: note: unrecognized brief tokens (reported, not fatal): with the double-brace token PLACEHOLDERS. Confirmed cause: the review brief template, we:skills-src/review/review-agent-brief.md, writes the literal double-brace word PLACEHOLDERS in its own header prose (line 4: "filling the ... PLACEHOLDERS below with the PR"). The filler, fillReviewBrief in we:scripts/operations/review-dispatch.mjs, substitutes only the five known names (PR, REPO, SESSION_SLUG, JUDGE_PROVIDER, LANE_REPO), reports any other token as unknown, and returns the whole text, header included, as the prompt of the dispatched reviewer session. So the reviewer does see the literal double-brace PLACEHOLDERS text: it is documentation prose in a template header, not an instruction and not an unfilled value, but it is exactly the kind of literal token that earlier fooled a dispatched reviewer into self-aborting (resolved backlog 3606), so it should not be left in. The existing tests hide it: we:scripts/operations/__tests__/review-dispatch.test.mjs fills a synthetic stub (REAL_TEMPLATE_STUB) whose only unknown token is a different one (LIKE_THIS), never the real template, so no test asserts what the real template's tokens are. The same header pattern exists in we:skills-src/conveyor/investigation-agent-brief.md and in the delivery brief that we:scripts/operations/dispatch-lane.mjs fills (its header names the same two leftover tokens), which are out of scope here but should be checked. DESIGN TO SETTLE: reword the header prose so it carries no double-brace token (for example say "the placeholders in the table below"), or strip the header block before dispatch; whether to keep the unknown-token note at all once the template is clean, and whether an unknown token should then become a refusal for the real template (it is safe to refuse only after the template is clean). ACCEPTANCE: running review-dispatch prints no unrecognized-token note; a test reads the REAL template file and asserts every double-brace token in it is one of the five known names and that the unknown-token list is empty; the same test fails if a token is added to the template without being filled.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
