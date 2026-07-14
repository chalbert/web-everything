---
bornAs: xg8fwbk
kind: decision
parent: "2505"
status: open
preparedDate: "2026-07-14"
dateOpened: "2026-07-14"
tags: [plateau-loop, console, backlog-ui]
---

# Plateau Loop: how the backlog console reads a repo's backlog/*.md

The backlog console (built fresh in Plateau) must read a repository's `backlog/*.md` at the surface and render it. **How** the file data reaches the live view is the crux the constitution explicitly parks — "how live data reaches the screen." This card readies that fork for ratification with a bold default.

The loader that reads the files homes in Plateau/FUI regardless of which path wins — **Web Everything holds zero implementation**. This decision only fixes the data path; it does not move ownership.

## Fork — data path

How does the console get a repo's parsed `backlog/*.md` to the rendered view?

- **(a) Served endpoint.** A Plateau dev/app endpoint (like the app's existing `/api/*` mock server) parses the `backlog/*.md` files and serves them to the live view over HTTP. The view fetches current state at runtime.
- **(b) Build-time filesystem snapshot.** Read the files at build and bundle a static snapshot into the app (the Vite `?raw` / data-module pattern). The view renders whatever was captured at build.
- **(c) Remote / git fetch.** Read the files from the repo's host or git at runtime (e.g. the git provider's API), no local endpoint.

**Bold default: (a) served endpoint.** The console is a **live**, eventually **multi-repo**, **operable** tool. A build-time snapshot (b) can't reflect current state — or many repos — without a rebuild, so it fails the "live" and "multi-repo" requirements the epic exists to meet. A remote/git fetch (c) is heavier than needed for local dev tooling and adds an auth/host dependency the local case doesn't want. A served endpoint is the pattern the app already runs for its mock data, extends cleanly to the operable (write) actions later, and is the seam the multi-repo registry ([#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-an/) / [#2475](/backlog/2475-per-repo-backlog-files-each-constellation-repo-owns-its-own-/)) grows on.

This ties into the broader static-vs-served question for Plateau surfaces and sets the seam the read story ([the v1 read foundation](/backlog/2507-backlog-view-v1-read-only-backlog-view-in-plateau/)) builds against — hence that story's `blockedBy` on this card.

Do not set `codifiedIn` here — that is stamped on resolve.
