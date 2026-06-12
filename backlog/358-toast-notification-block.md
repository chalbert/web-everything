---
type: idea
workItem: story
size: 3
parent: "315"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: block:notification
tags: [gap-analysis, block, toast, notification, live-region]
---

# Toast / notification block

Toast / notification block — transient, non-blocking notifications with queueing, timeout, stacking, an optional action, and aria-live announcement. Gap from the competitive coverage analysis (#347, /research/benchmark-coverage/): intent:feedback + intent:message + intent:live-region-status cover the UX and announcement axes, but no block implements the toast/snackbar surface. Distinct from background-task-surface (#135), which is for long-running task status. Native anchor: role=status / aria-live. Ranked top of the un-tracked gaps. Candidate from the gap sweep — groom before building.

## Outcome (2026-06-12)

**Generalized from "toast" → `notification` block** (per the design discussion): a toast is one
*presentation* of a notification, so the standard captures the general, presentation-agnostic contract
and leaves toast/snackbar/banner styling to the implementation (Frontier UI).

Authored the `notification` block standard (status `draft`, type Component):
- **`blocks.json`** — `notification` entry: `implementsIntent: feedback` (it realizes the existing Feedback
  Intent, which had `implementedBy: null`), `composesIntents: [message, live-region-status, surface, motion]`,
  events `notification-shown`/`notification-dismissed`, and 7 design decisions (presentation-agnostic naming ·
  distinct from the OS Web Notifications API · Component-region + injectable controller · native-first
  Popover-API top layer · severity-mapped announcement · the queue/timeout/dismissal transient contract ·
  separation from background-task-surface #135 and inline Message).
- **`block-descriptions/notification.njk`** — overview, Web Standards Alignment + Framework Research tables,
  the `NotificationController`/`NotificationMessage` contract (signatures only, no impl), observable events,
  behaviour, composition. Renders at `/blocks/notification/`.
- **`semantics.json`** — terms *Notification*, *Notification Region*.

Key reframing: this was a **missing-implementation** gap, not a missing-UX gap — the Feedback Intent already
specified the UX (placement/severity/duration/stackLimit/action); no block realized it. Concrete impl
(timing, animation, toast presentation) is Frontier UI's. `check:standards` green; block page verified.
