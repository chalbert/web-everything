---
kind: story
size: 3
parent: "777"
status: open
blockedBy: ["867"]
dateOpened: "2026-07-09"
tags: []
---

# Promote measured-green a11y routes + add the self-announcing drain trigger

Per #867 Fork 1 (decoupled): append every scope-C route that measures green to ENFORCED_ROUTES (we:tests/a11y/sitemap-routes.ts) via explicit set edit after a fresh measurement run — ~26 were green at 2026-07-02 prep. Carries the #867 ratify rider: also add the self-announcing drain meta-check that flags 'drain complete — execute the #867 flip' when ENFORCED_ROUTES equals the derived set, so the Fork-2 milestone can't rot unnoticed (a red enforced lane already went unnoticed for a week).
