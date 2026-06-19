---
type: idea
workItem: story
size: 3
parent: "1073"
status: open
blockedBy: ["1080"]
dateOpened: "2026-06-19"
tags: []
---

# Review / tag / train UI for the Tier-2 vision model

Slice E of #1073: a human-in-the-loop, PER-SCREENSHOT UI — you review one captured screenshot at a time, REVIEW the Tier-2 model's rich output on it, TAG ground truth directly on that screenshot (draw/label element-regions, correct the description/tags), and feed TRAINING — the labeling surface that produces the tagging/element-detection corpus slice B (#1081) evals against and the VLM trains on. The Tier-2 analogue of the critique review surface #1036 (same comment/correct/persist-as-labeled-pair pattern); a plateau-app product surface, vision stays a Plateau no-leakage service (#475). Blocked by #1080 (tags against the rich-output contract). Not a decision — a build.
