#!/usr/bin/env node
// #850: agent-usable freshness probe for the dev docs server. GETs /build-id.json
// from the running Eleventy server and reports whether it is up and serving the
// current HEAD — so verification doesn't depend on a human noticing the stale banner.
//
//   node scripts/dev/check-fresh.mjs [--url=http://localhost:8080] [--json]
//
// Exit 0 = fresh (server up, served sha === git HEAD short sha).
// Exit 1 = stale (server up but serving an older build — a rebuild is pending/failed).
// Exit 2 = down  (server unreachable / no parseable build-id.json).
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith("--url="));
const asJson = args.includes("--json");
const base = (urlArg ? urlArg.slice("--url=".length) : "http://localhost:8080").replace(/\/$/, "");

function headSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function report(state, detail, code) {
  if (asJson) {
    process.stdout.write(JSON.stringify({ state, ...detail }) + "\n");
  } else {
    const label = { fresh: "✓ FRESH", stale: "⚠ STALE", down: "✗ DOWN" }[state];
    process.stdout.write(`${label} — ${detail.message}\n`);
  }
  process.exit(code);
}

let served;
try {
  const res = await fetch(`${base}/build-id.json`, { cache: "no-store" });
  if (!res.ok) report("down", { message: `${base}/build-id.json → HTTP ${res.status}` }, 2);
  served = await res.json();
} catch (err) {
  report("down", { message: `${base} unreachable (${err.code || err.message})` }, 2);
}

if (!served || !served.id) {
  report("down", { message: "build-id.json had no id field" }, 2);
}

const head = headSha();
if (head && served.sha && served.sha !== head) {
  report(
    "stale",
    { message: `server serving ${served.sha} but HEAD is ${head} — rebuild pending or failed`, served, head },
    1,
  );
}

report("fresh", { message: `server up, serving ${served.sha} @ ${served.time}`, served, head }, 0);
