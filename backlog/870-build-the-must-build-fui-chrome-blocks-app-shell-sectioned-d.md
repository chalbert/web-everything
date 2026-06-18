---
type: idea
workItem: story
size: 5
parent: "658"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "@frontierui/blocks/app-shell/ + @frontierui/blocks/sectioned-nav/ + @frontierui/blocks/button/"
locus: frontierui
relatedProject: webdocs
tags: [dogfood, fui-blocks, chrome]
---

# Build the must-build FUI chrome blocks (app-shell, sectioned-disclosure nav, button) for the WE-docs dogfood

The #778 inventory mapped WE-docs chrome to FUI and flagged three FUI blocks the header/nav/footer/shell migration needs that FUI does not yet ship: app-shell/header layout primitive (C1), a sectioned-disclosure nav panel (C5 — nav-list is flat, not sectioned), and a button block (C6/C7 toggle + icon buttons). These are the must-build critical path: WE-docs chrome cannot mount what FUI doesn't ship. Build them as @frontierui/blocks families with mode-C mountInDocument exports so #865 can mount them. Locus FUI (impl→FUI per #765).

## Progress

- **Status:** resolved — all three chrome blocks built, registered, gated green in both repos.
- **Branch:** docs/standard-authoring-workflow (WE); main (frontierui).
- **Done:**
  - **`app-shell`** (C1) — `frontierui/blocks/app-shell/` (`fui:AppShell.ts` + `we:index.ts`): sticky header (brand lockup + header-controls region), optional `<nav>` landmark, focusable `<main>` with a leading skip link, optional `<footer>`. API: `createAppShell` / `mountAppShell` / `mountInDocument`.
  - **`sectioned-nav`** (C5) — `frontierui/blocks/sectioned-nav/` (`fui:SectionedNav.ts` + `we:index.ts`): collapsible APG-disclosure section heads (`aria-expanded`/`aria-controls`) over link lists; click toggles, Escape collapses the focused section, current link gets `aria-current`. The sectioned counterpart of the flat `nav-list`. API: `createSectionedNav` / `mountSectionedNav` / `mountInDocument`.
  - **`button`** (C6/C7) — `frontierui/blocks/button/` (`fui:Button.ts` + `we:index.ts`): icon buttons, icon links (`<a>` when `href` set), and `aria-pressed`/`aria-expanded` toggle buttons (the hamburger). API: `createButton` / `mountButton` / `setButtonPressed` / `mountInDocument`.
  - Each block satisfies the mode-C `EmbedMountModule` contract (`fui:embed/contract.ts`) — `mountInDocument(root)` for direct mount/demos, plus a config factory `mount*(root, config)` for #865 to pass WE-docs-specific brand/nav/buttons.
  - **No global tag registered on purpose** — the WE↔FUI custom-element tag-naming convention is the open decision #841; registering a tag now would pre-empt it. (No `customElements.define`/`attributes.define`, so the #783 registered-name drift gate stays clean with empty `registeredNames`.)
  - Registered: FUI `fui:src/_data/blocks.json` (3 entries) + `fui:blocks/package.json` exports + WE `fui:src/_data/blocks.json` (3 entries, `implementedBy: @frontierui/blocks/<fam>/`) + WE `src/_includes/block-descriptions/{app-shell,sectioned-nav,button}.njk`. Regenerated `we:AGENTS.md` inventory.
  - Tests: `frontierui/blocks/__tests__/unit/{app-shell,sectioned-nav,button}/*.test.ts` (23 new specs).
- **Gates:** FUI `vitest run` 1755 pass / 0 fail; `tsc -p fui:blocks/tsconfig.json` clean; FUI `check:standards` 0 err/0 warn; WE `check:standards` 0 err; WE 11ty dryrun clean; the three new `/blocks/{id}/` pages render 200 on the live dev server.
- **Notes:**
  - happy-dom quirk: `instanceof HTMLAnchorElement` returns true for a `<button>`, and the `.type`/`.href` property setters don't reflect — code branches on a computed `isLink` boolean and sets `type`/`href` via `setAttribute`.
  - Reuse: `sectioned-nav` implements the same APG disclosure pattern as `nav:section` but builds DOM imperatively (the established mode-C convention, not the registry-driven `CustomAttribute` path), since the in-document mount has no active behavior registry.
  - Unblocks #865 (chrome migration, `blockedBy: ["870"]`). Mode-C demo modules + the actual WE-docs mount are #865's scope. Remaining page-level must-build gaps (card/badge/meter/code-block/toc/filter-chip) are tracked under #866; demo hosting under #813.
