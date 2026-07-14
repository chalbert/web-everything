---
bornAs: x0xjkr7
kind: epic
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, console, backlog-ui]
---

# Plateau Loop — operable backlog console, built fresh in plateau

The constitution's "the operating console lives and renders in Plateau, built fresh" goal, made concrete: a developer browses and (later) operates a repo's backlog from inside the Plateau app.

Built fresh on Plateau's FUI stack — Web Everything's backlog setup is the **reference** for the model and vocabulary (the item shape, the status/kind/size/tags fields, the badge language), **not code to copy**. The console dogfoods FUI rather than importing any WE template.

This is distinct from the resolved [#2474](/backlog/2474-plateau-loop-operable-console-manage-and-operate-the-drain-d/) — that was the daemon-side dev-panel (drain-daemon lifecycle + merge-queue operation). This epic is the **backlog** console: browsing and operating a repo's work items.

The multi-repo end-state is tracked separately under [#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-an/) (the registry) plus [#2475](/backlog/2475-per-repo-backlog-files-each-constellation-repo-owns-its-own-/) (per-repo backlog). This epic is the **single-repo operable-console foundation** those grow into: get one repo's backlog browsable and operable first, then the registry generalizes it to many repos.

Per the constellation split, **Web Everything holds zero implementation** — the impl lives in plateau-app. This epic and its children are tracker items; WE is the reference model, not the code home.

Rolls under [#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/) (the Plateau Loop coordinator epic).
