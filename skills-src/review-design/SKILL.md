---
name: review-design
description: Screenshot a rendered page on the running dev server and return a structured design critique scored against the ratified #1034 design-critique rubric. Use when the user wants to "review the design" of a page, "critique this page", "score the UI", or check visual quality (hierarchy/spacing/contrast/typography/consistency) of a real rendered page — not its code. Zero lock-in: no API key, SDK, or vision provider needed; Claude reads the screenshot natively in-session.
---

# review-design — critique a rendered page against the #1034 rubric

Trigger + pointer — the rubric (the 8 closed axes, their tier-tags + WE grounding, and the
closed-scored-axes + open-findings output shape) lives in
[docs/agent/vision-tiers.md → Design-critique rubric (ratified #1034)](../../../docs/agent/vision-tiers.md#design-critique-rubric-ratified-1034).
**Don't restate the rubric here**; if it changes, edit that doc (it's the Plateau vision service's output
contract, #1034/#1033). This skill is the **interactive Tier-C path**: a screenshot + Claude's native
vision, no headless/at-volume machinery (that — `DESIGN_REFS_VISION_PROVIDER`, the #1082 in-browser VLM —
is for #489/#490 corpus labeling, not this devtool).

## The loop

1. **Resolve the page URL on the *running* dev server.** Detect the live instance — don't start one
   (*[~/.claude/CLAUDE.md → Dev servers](../../../AGENTS.md)*; webeverything renders pages on **:8080**
   Eleventy, demos on :3000 Vite — scrape the dev log / probe the port). Take the path from the user
   (e.g. `/blocks/`, a demo route) → the full `http://localhost:<port><path>`.
2. **Screenshot it with Playwright** (full page, a desktop viewport unless the user names one):
   ```bash
   npx playwright screenshot --full-page --viewport-size=1280,800 "http://localhost:8080<path>" /tmp/review-design.png
   ```
   For a responsive review, repeat at a mobile width (`390,844`) and review both.
3. **Read the PNG natively** — `Read /tmp/review-design.png`. Claude is vision-capable in-session; there
   is **no** provider seam, API key, or SDK to wire (the zero-lock-in devtool, #1035).
4. **Score against the rubric.** Per the doc's output shape (#1034 Fork 3): the **8 closed axes** each
   scored **1–5** with a one-line justification, **plus** an open list of localized findings
   `{ dimension, elementRef, problem, severity 0–4 }` (Nielsen 0=cosmetic … 4=catastrophe). Tag each axis
   with its tier (A/B/C) so the reader sees what's deterministic vs perceptual.
5. **Defer the Tier-A axes to the gates, don't re-derive them** (rubric compute-split, #1034 Fork 2):
   contrast/targets ride the **#763/#770 a11y gate**, token use rides **token-lint**. Run/cite those for
   axes 1/4/5 rather than eyeballing contrast off pixels (lower fidelity + drift). This skill **owns the
   Tier-C** judgment (hierarchy, polish) + the synthesis.
6. **Emit the structured result** — the closed-axis table + the open findings + a one-line overall read.
   Ground each axis best-effort in the page's *declared* WE standard where one exists (read
   [intents.json](../../../src/_data/intents.json) / design tokens as **input** — not leakage, #475), a
   generic perceptual read where none does.

## Notes

- **Output is advisory, not a gate.** A low score is a finding to discuss, never a build failure; the
  persisted-label / correction loop is **#1036**, not this skill.
- **No screenshot? Stop and say so.** If no dev server is live (and the user hasn't asked you to start
  one), report that and offer to start it — never critique from the source HTML (curl sees server output,
  not what the client renders/hides; *[~/.claude memory → Test before asserting](../../../AGENTS.md)*).
- **Raw zero-shot critique is ~13% valid (UICrit, UIST'24)** — the rubric grounding is what makes this
  usable, so always score *through* the axes, never freehand.
