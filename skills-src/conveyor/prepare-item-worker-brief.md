# Probation worker mode — prepare item {{ITEM_NUM}}

When this brief is supplied by probation-build-run, this section is the entire worker task.
Work in the current acquired lane; the runner has supplied the correct checkout.
Read {{ITEM_SPEC_PATH}}, we:docs/agent/conventions.md, and the code the card names.
Every code-path reference you author must carry its repository prefix (e.g.
`we:scripts/example.mjs`), including references in backticks and section prose. Check the premise and author concrete
## Design, ## MVP, ## Test plan, ## Proof plan, and ## Follow-ups sections in that card.
Only edit that card's body, scope:, and preparedDate/preparedAgainstSha; preserve all other frontmatter.
Correct factual drift in the card itself: moved code, stale file:line citations, missing test paths,
and narrower or wider scope supported by the current code. Keep the original goal; a factual
scope correction is preparation, not a reason to stop. Record the old premise/scope, corrected
premise/scope, and source evidence in ## Progress, then finish the five sections.
If the goal is already delivered, report already-done with the delivering commit and stop without
editing or stamping. If a genuine unresolved judgment call / design fork remains after research,
report could-not-prepare with the specific choice and stop; do not invent a goal or choose policy.
Do not claim, resolve, acquire another lane, stamp, commit, push, or open a PR.
The runner owns stamping and checks, then opens a parked review:pending PR.
If you cannot honestly prepare it, leave no diff and explain why.
