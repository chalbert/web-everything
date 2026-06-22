---
kind: story
size: 3
parent: "1552"
status: open
blockedBy: ["1582", "1583"]
dateOpened: "2026-06-22"
tags: []
---

# Trained-vs-frozen judge eval — prove the trained judge beats the frozen one on held-out feedback

The epic's success metric (#1552): demonstrate a trained judge beats the frozen NullJudgeModel/descriptive baseline on the #1582 held-out regression benchmark. Wire the eval harness that scores both judges' OUTPUTS against ground truth (precision, severity accuracy, recall via missed-issue labels, and false-positive rate as a first-class metric), reports the delta, and gates the #1583 learning mechanism's escalation from k-NN to logistic probe. Because it scores outputs not embeddings, the same harness re-validates any judge agent after an encoder/VLM swap — the portable counterpart to the portable corpus. Per we:docs/agent/platform-decisions.md#trainable-judge.
