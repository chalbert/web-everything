// Old-slug redirects (the back-compat half of the stable-route work — backlog #110).
//
// #075 shipped the number-only stable URL (/backlog/<NNN>/ → canonical /backlog/<NNN>-<slug>/).
// This covers the OTHER rename-proofing case: a previously-published link to an *old slug*
// (/backlog/075-old-wording/ or a pre-NNN /backlog/old-wording/) must not 404 after a reword.
//
// A renamed item lists each prior URL segment in a `formerSlugs:` frontmatter array (the FULL old
// filename stem — e.g. `base-select-first-class-adapter`, not just the slug-minus-number). This
// loader flattens those into `{ from, to, title }` rows; src/backlog-slug-redirects.njk paginates
// them into one tiny redirect page per former slug → the item's canonical /backlog/<id>/.
//
// Single source: re-uses the same backlog loader the rest of the site reads, so a former slug can
// never drift from the item it points at. Validation (no collision with a real id, differs from the
// current slug, no duplicate alias) lives in scripts/check-standards.mjs.
const loadBacklog = require('./backlog.js');

module.exports = function backlogAliases() {
  return loadBacklog()
    .filter((item) => Array.isArray(item.formerSlugs) && item.formerSlugs.length)
    .flatMap((item) =>
      item.formerSlugs.map((from) => ({ from, to: item.id, title: item.title })));
};
