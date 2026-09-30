# Probation worker mode — prepare item {{ITEM_NUM}}

When this brief is supplied by probation-build-run, this section is the entire worker task.
Work in the current acquired lane; the runner has supplied the correct checkout.
Read {{ITEM_SPEC_PATH}}, docs/agent/conventions.md, and the code the card names.
Every code-path reference you author must carry its repository prefix (e.g.
`we:scripts/example.mjs`), including references in backticks and section prose. Check the premise and author concrete
## Design, ## MVP, ## Test plan, ## Proof plan, and ## Follow-ups sections in that card.
Only edit that card's body and preparedDate/preparedAgainstSha; preserve all other frontmatter.
If scope needs correction or a judgment call is unresolved, report could-not-prepare and stop.
Do not claim, resolve, acquire another lane, stamp, commit, push, or open a PR.
The runner owns stamping and checks, then opens a parked review:pending PR.
If you cannot honestly prepare it, leave no diff and explain why.
