// Global `links` data for cross-project navigation. `frontierUrl` points to the
// local FrontierUI dev server when Eleventy is serving/watching (`npm run dev`),
// and to production for builds.
// ELEVENTY_RUN_MODE is set automatically by Eleventy: "serve" | "watch" | "build".
const local = process.env.ELEVENTY_RUN_MODE !== "build";

module.exports = {
  frontierUrl: local ? "http://localhost:3001" : "https://frontierui.dev",
};
