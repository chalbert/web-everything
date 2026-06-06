---
name: next-backlog-item
description: Review the backlog and pick the next item to work on, prioritizing items an agent can implement now (dev-ready) over open design decisions. Use when the user asks "what's next?", "what should I work on?", "pick/select the next backlog item", or "review the backlog and choose".
---

# Select — and work — the next backlog item

Trigger + pointer — the rubrics live in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md) (**"Selecting the next
item to work on"**, **"Working an item"**, **"Closing out a completed item"**), so every agent
(Claude, Copilot, Cursor) uses the same method and there is nothing to keep in sync here. This skill
covers the whole arc: pick it → claim it → keep its progress in sync → delete it when done.

When invoked:

1. **Read [docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md)** — follow
   **"Selecting the next item to work on"**: gather (drop `active`/`resolved`/`parked`) → score each
   candidate for dev-readiness → tier **A** (agent-ready) / **B** (one nod away) / **C** (needs
   design) → order within Tier A → run the dependency check.
2. **Bias to Tier A — agent-ready first.** Prefer `issue`/`idea` items with a concrete, bounded
   build against proven infra and no open design fork. De-prioritize `decision`/`review` items;
   surface them for discussion rather than picking them.
3. **Present, don't start.** Output a short ranked shortlist (top 3–5, grouped by tier, one-line
   rationale each), then the single recommended item with its reasoning, then ask whether to start
   it. Planning-as-discussion style, not rapid-fire multiple-choice. **Every offered item carries
   two links** (see `backlog-workflow.md` → *Output*): its **live page**
   `http://localhost:3000/backlog/<NNN-slug>/` (Vite `:3000` proxies `/backlog/` to 11ty `:8080`;
   `NNN` is the item's `#`-id) and its **source file** `backlog/<NNN-slug>.md`.

**Once the user says go — track it in the item, not just in your head** (per `backlog-workflow.md`
→ **"Working an item"**). The backlog file is the durable, resumable record; recovering a prior chat
session is not reliable, so the item body *is* the contract:

4. **Claim it on start.** Flip the item's `status: open` → **`active`** and save *before* coding, so a
   fresh session won't re-pick it.
5. **Keep it in sync as you go.** Maintain the `## Progress` block (Status / Branch / Done / Next /
   Notes) and update it *as work happens*, not at the end — if the session is lost, that block is all
   the next one has. Flip back to `open` if you abandon it unfinished.
6. **Resume, don't re-pick, an `active` item.** Asked to continue one (or finding a stranded claim):
   read its `## Progress`, check out its branch, continue from **Next**.
7. **Close it out when done — delete it.** Once fully done, run the gate in `backlog-workflow.md` →
   **"Closing out a completed item"**: confirm it's done (tests + `check:standards` green), take a
   **careful last look for leftovers** and capture each as its **own new backlog item**, mind the
   **pointer guard** (don't orphan a report — that breaks the build), then **delete `backlog/<id>.md`**
   and re-run `check:standards`.

Do not duplicate the rubric here — if the selection, working, or close-out method changes, edit `backlog-workflow.md`.
