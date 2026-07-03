// Rendered-DOM tile-integrity gate for every hand-rolled catalog grid — the guard #2168/#2169 exist because
// this whole defect class is INVISIBLE to curl / view-source / innerText / console and to the element-count
// smoke floor (tests/smoke/rendered-site-smoke.spec.ts asserts >15 nodes, which every one of these pages
// clears even while silently dropping half its tiles). Tile integrity can only be asserted against the
// PARSED BROWSER DOM.
//
// Two failure classes this catches:
//
//   1. TILE-SWALLOW (#2168 / #2169 /plugs/) — a tile body containing a LIVE tag that reparents or terminates
//      the surrounding markup (`<template>` parses its contents into an inert fragment; a stray `<title>` in
//      body flips the parser into "in head" mode) makes the browser drop that tile AND every sibling after it.
//      The served HTML has all N tiles; the browser parses far fewer. Root cause is an un-escaped code example
//      in a `| safe` summary — the fix escapes it in the source data (e.g. `&lt;title&gt;`).
//
//   2. NESTED ANCHOR (`lane/home-card-nested-anchor-fix`) — a grid that wraps `<a class="project-card">`
//      around a `<we-card>` whose summary can hold authored inline links produces `<a><a>…</a></a>`, which is
//      invalid; the browser closes the outer anchor early and clones EMPTY ghost `.project-card` tiles. The
//      fix is the overlay pattern: a `<div class="project-card">` holding a zero-content
//      `<a class="project-card-link">` sibling to `<we-card>` (see src/adapters.njk).
//
// Reuses the running dev server (:8080, the real WE-docs origin) like the a11y / smoke sweeps.

import { test, expect } from '@playwright/test';

// Same origin pin as the a11y/content/smoke specs — :8080 is the real docs home (Vite :3000 serves the demo shell).
test.use({ baseURL: 'http://localhost:8080' });

// Every hand-rolled njk catalog grid that renders `.project-card` tiles wrapping a `<we-card>`. (/ and
// /intents/ are SSR grids covered separately; these are the njk surfaces #2169 hardened.) One `<we-card>`
// opening tag is emitted per tile in the served HTML across ALL of these grid shapes (the wrapping-anchor
// `.project-card` and the presets `<article>`/overlay variants alike), so it is the robust served-side
// tile count to compare the browser-parsed `.project-card` count against.
const CATALOG_ROUTES = ['/plugs/', '/states/', '/blocks/', '/protocols/', '/presets/', '/adapters/'];

for (const path of CATALOG_ROUTES) {
  test(`catalog tile integrity · ${path}`, async ({ page }) => {
    // Served-HTML tile count: one <we-card> per tile, before any browser parsing can swallow siblings.
    const resp = await page.request.get(path);
    expect(resp.status(), `HTTP status for ${path}`).toBeLessThan(400);
    const html = await resp.text();
    const servedTiles = (html.match(/<we-card[\s>]/g) ?? []).length;
    expect(servedTiles, `served <we-card> tiles for ${path}`).toBeGreaterThan(0);

    await page.goto(path, { waitUntil: 'networkidle' });

    const dom = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.project-card'));
      return {
        cardCount: cards.length,
        // A wrapping <a> that swallowed its inline links leaves behind empty ghost `.project-card`s with no
        // rendered card body.
        emptyCards: cards.filter((c) => !c.querySelector('we-card')).length,
        // Invalid `<a>` inside `<a>` — the nested-anchor footgun the overlay pattern removes.
        nestedAnchors: document.querySelectorAll('a a').length,
      };
    });

    // (a) No nested anchors — the wrapping-anchor footgun is gone on every grid.
    expect(dom.nestedAnchors, `nested <a> inside <a> on ${path}`).toBe(0);
    // (b) No empty ghost tiles — every `.project-card` rendered its `<we-card>` body.
    expect(dom.emptyCards, `empty .project-card tiles on ${path}`).toBe(0);
    // (c) THE SWALLOW GUARD — the browser must parse exactly as many tiles as the server sent. A live tag in
    //     a tile body (the #2168/#2169 class) drops the tile and its siblings, so browser << served.
    expect(dom.cardCount, `browser .project-card count vs served tiles on ${path}`).toBe(servedTiles);
  });
}
