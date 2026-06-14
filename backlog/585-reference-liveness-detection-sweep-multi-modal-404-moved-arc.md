---
type: issue
workItem: story
parent: "583"
size: 5
status: open
blockedBy: ["583", "597"]
dateOpened: "2026-06-14"
relatedProject: webdocs
tags: [monitoring, references, liveness, link-rot, detection, sweep]
---

# Reference liveness detection sweep (multi-modal: 404 / moved / archived / content-drift / superseded)

Build the active sweep that fetches every external reference the project cites and classifies its health, rather than waiting to trip over a dead link (as #531 did with FAST). Classification is multi-modal, not binary: gone (404), moved (301/302), archived/frozen, content-drift (URL alive but no longer says what we cited — the silent killer), paywall, and superseded-by-newer-canonical (FAST→Fluent). Each class routes to a remediation that can spawn a backlog item; an axis-vacancy check flags when a retirement drops a corpus category below N live sources. Fetches what [#597](/backlog/597-reference-registry-substrate-index-the-structured-reference-/) (the reference-registry substrate) indexes — a blocking prerequisite, carved out so it's no longer buried scope.
