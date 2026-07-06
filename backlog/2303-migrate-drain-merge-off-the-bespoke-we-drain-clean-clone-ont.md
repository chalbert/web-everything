---
kind: story
size: 3
parent: "2275"
status: open
blockedBy: ["2302"]
dateOpened: "2026-07-06"
tags: []
---

# Migrate /drain + /merge off the bespoke we-drain-clean clone onto the leased allocator

Final slice of #2275 (scope 3+4), blockedBy the sibling-clone provisioner #2302. Rewrite the /drain + /merge skill preconditions (we:skills-src/drain/SKILL.md:22-52 + the .claude/skills/drain mirror) and we:scripts/merge-ai-prs.mjs to acquire a lease (acquire → reset → work → release) instead of hand-rolling git clone --local <primary> ../we-drain-clean; delete the hand-rolled recipe and the we-drain-clean special-casing. Make the checkout root allocator config so no skill embeds ../we-drain-clean or the .lanes root literally (the in-scope half of scope 4; managed-root/remote-executor stay out-of-scope follow-ons). Consumes the lease primitive #2301 (landed) and the sibling clones #2302.
