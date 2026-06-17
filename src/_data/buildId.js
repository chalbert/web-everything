// #850: a freshness signal for the dev docs server. Computed once per 11ty build
// (re-run on every --serve rebuild), it stamps the build identity into both
// /build-id.json and a <meta name="build-id"> tag in the base layout. A client
// poller (assets/js/staleness-detector.js) compares the two and raises a STALE
// banner when they drift (a newer build exists) or the fetch fails (server down);
// the same JSON is the agent-usable HTTP probe (scripts/dev/check-fresh.mjs).
const { execSync } = require("node:child_process");

function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "nogit";
  }
}

module.exports = () => {
  const sha = gitSha();
  const time = new Date().toISOString();
  // id is the drift key: changes whenever a new build runs (timestamp) or HEAD
  // moves (sha). The client compares this opaque string; never parse it.
  return { id: `${sha}-${time}`, sha, time };
};
