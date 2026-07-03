---
kind: task
status: open
dateOpened: "2026-07-03"
relatedTo: ["075"]
tags: [11ty, build, backlog, redirects, footgun, ci]
---

# Fix `backlogRedirects` data source — missing file breaks the 11ty build

`we:src/backlog-redirects.njk` paginates over a `backlogRedirects` data source, but no
`we:src/_data/backlogRedirects.js` (or global-data equivalent) exists — the only backlog data files are
`we:src/_data/backlog.js`, `we:src/_data/backlogAliases.js`, `we:src/_data/backlogGraph.js`, and
`we:src/_data/backlogMeta.js`. So the WE docs build fails with an 11ty `Could not find pagination data …
went looking for: backlogRedirects` error, reddening the non-required `visual` check on every PR (seen on
PR #35).

Introduced by the "recover orphaned primary-tree improvements from the 2026-07-03 stash" commit
(`18312d65`, PR #73): the njk was switched from a `backlog` pagination source to a `backlogRedirects` one
but the new data file was never landed. It's a half-applied stash recovery, not a lane regression.

**Fix.** Either add the missing `we:src/_data/backlogRedirects.js` the njk expects (deriving the
`{num, id, slug}` redirect rows it needs), or revert the njk back to the `backlog` pagination source if the
redirect data was meant to stay inline. The required `test` gate doesn't build 11ty so it stayed green,
which is why this slipped in — consider adding a fast build-smoke so a broken template can't land silently.
