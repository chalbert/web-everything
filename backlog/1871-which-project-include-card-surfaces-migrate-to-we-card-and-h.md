---
kind: decision
parent: "1601"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Which project-* include card surfaces migrate to we-card, and how to keep section anchor/heading semantics

Blocks #1608. Pre-flight (batch-2026-06-27-1842-1720) found #1608's premise is stale: the we:src/_includes/project-*.njk includes have NO catalog tiles with status pills / dimension chips (the #1820 Fork 1a badge+tag mapping #1607 applied) — a grep finds zero .project-card there. What they actually have is two CONTENT-card surfaces: (1) .section-card (~225) — <section id=...> content-section wrappers with deep-link :target anchors (we:src/css/style.css .section-card:target) and h3/h4 children; (2) .standard-card (~29) — <div class=standard-card flex flex-col><h4 id=...>+<p> content cards. Neither carries badge/tag vocabulary, so #1608's uniform-badge+tag framing does not execute. Decide: (Fork 1) scope — which surfaces convert (standard-card only, the genuine card; section-card too; or neither), since converting 225 section content-wrappers restructures every project page; (Fork 2) semantics — a we-card erases to <article class=fui-card>, dropping the <section> + the id used by #anchor TOC links and .section-card:target highlighting, and its title attr generates its own h3 fui-card__title (vs the existing h4 id= heading) — so preserve the id/anchor + heading level/anchorability, or accept the loss. Once decided, #1608 becomes a clean frame swap (no badge/tag). Default lean: Fork 1 = standard-card only (section-card stays a semantic <section>); Fork 2 = keep the heading id on the card so anchors survive.
