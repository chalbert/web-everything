---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["456"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "intent:system-notification"
tags: []
---

# Author the system-notification intent (OS notification render surface)

Ratified in #009 Fork B: a system-notification intent for the OS-surface render (Notifications API) — renders outside the page, survives tab close, carries a permission gate. Sibling to feedback (in-page) and background-task (in-session), reusing the shared severity/title/body/action vocabulary. Publishes standalone in webintents; coordinated by the webnotifications domain (#456). Explicitly NOT a surface dimension on feedback (distinct surface + lifecycle).

## Resolved 2026-06-13 (batch-2026-06-13)

Authored the `system-notification` intent as a new entry in
[we:src/_data/intents.json](../src/_data/intents.json) (the /intents/ catalog auto-renders it — verified
live at `/intents/system-notification/`). Mirrors the sibling `feedback` / `background-task` /
`permission` entries:

- **Summary + framing** — OS-surface render via the Notifications API; renders out-of-page, survives
  tab close, permission-gated; the out-of-page sibling of Feedback (in-page) and Background Task
  (in-session); explicitly **not** a `surface:` dimension on Feedback (#009 Fork B — distinct render
  target + lifecycle).
- **Dimensions** — `severity` (the shared unified vocabulary, info/success/warning/error, not coined
  here), `interaction` (inert / actionable — borrows the Notifications API `actions` shape), and
  `persistence` (auto-dismiss / require-interaction — the platform `requireInteraction` flag;
  require-interaction defaults on when an action is present, paralleling Feedback's indefinite-on-action
  rule).
- **Composition** — gates on the `permission` intent (`feature: notifications`) rather than
  re-implementing permission state; cross-refs the sibling surfaces. Events: `show`/`click`/`close`/`error`.

No per-intent njk needed (the catalog renders the inline `description` HTML). Companion item #460
(notification-marker family) is the other half of the #009 webnotifications split.
