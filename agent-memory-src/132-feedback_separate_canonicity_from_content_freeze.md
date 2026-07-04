---
name: feedback_separate_canonicity_from_content_freeze
description: "a \"ratify near release\" hold may conflate a structural/canonicity call (ratify now, it unblocks) with a content-maturity call (truly held); split and ratify the safe part;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: da60bbf8-9a1c-4b1e-b035-86042b666361
---

A decision parked **"ratify near release / don't freeze a maturing model"** often conflates two
*separable* questions. Split them before accepting the blanket hold:

- **The structural / canonicity question** — which artifact is the *source of truth*, which shape routes
  downstream work. This is usually **safe to ratify now**, and is frequently the exact thing that
  **unblocks** the next step (slicing, decomposition, naming).
- **The content-maturity question** — *what* fills that artifact. This is the part the "don't freeze"
  caution legitimately governs; leave it open.

**Why:** the maturing-practice caution is about not freezing *content* prematurely; it does not require
holding the *structural* call hostage. Ratifying the shape now ≠ freezing the methodology.

**How to apply:** when a card says "held open, ratify near release," ask "is there a structural sub-call
here that's already at DoR and is blocking downstream work?" If yes, ratify *that* now and scope the
ratification explicitly to canonicity-not-content, keeping the content open under the parent. Don't let a
timing caution on one sub-question park a settled, unblocking one.

Surfaced on #569 (methodology artifact shape): default was "held open"; the user ratified the reframe
that the source-shape ruling was safe to make now (it unblocks `/slice 563`) while the kit's *contents*
stay open under #563. Relates to [[feedback_rule_residual_now_if_default_is_worse]] (rule the part you
can now) and [[feedback_collect_decision_residual_as_card]] (home the genuinely-held residual).
