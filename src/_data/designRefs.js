const fs = require("fs");
const path = require("path");

// Design-reference corpus (#382). Loads the per-item meta.json sidecars from design-refs/items/.
// Read fresh from disk each build (fs, not require) so newly-captured shots hot-reload on the watch
// server — same rationale as the adapters.json read in .eleventy.js. The .eleventy.js watch target
// on "design-refs" triggers the rebuild.
module.exports = function () {
  const dir = path.join(__dirname, "..", "..", "design-refs", "items");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((id) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, id, "meta.json"), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((m) => ({
      ...m,
      // served via the .eleventy.js passthrough: design-refs/items → research/design-references/shots
      shotUrl: `/research/design-references/shots/${m.id}/screenshot.webp`,
      dateShort: (m.dateCollected || "").slice(0, 10),
      reviewLabel: m.reviewState || "ungated",
    }))
    .sort((a, b) => (a.dateCollected < b.dateCollected ? 1 : -1));
};
