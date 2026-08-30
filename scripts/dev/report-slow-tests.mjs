#!/usr/bin/env node
/**
 * @file scripts/dev/report-slow-tests.mjs
 * @description Reads a Vitest JSON reporter output file (`vitest run --reporter=json --outputFile=...`)
 * and prints the slowest individual tests and the slowest files by total test duration. Ad hoc — point it
 * at any run's JSON report, local or downloaded from a CI artifact.
 *
 * Usage: node scripts/dev/report-slow-tests.mjs <path-to-vitest-json> [--top=30]
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const [jsonPath, ...rest] = process.argv.slice(2);
if (!jsonPath) {
  console.error('usage: node scripts/dev/report-slow-tests.mjs <path-to-vitest-json> [--top=30]');
  process.exit(1);
}
const topFlag = rest.find((a) => a.startsWith('--top='));
const top = topFlag ? Number(topFlag.slice('--top='.length)) : 30;

const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
const cwd = process.cwd();

const tests = [];
const fileTotals = new Map();
for (const file of report.testResults ?? []) {
  const relPath = relative(cwd, file.name);
  let fileTotal = 0;
  for (const a of file.assertionResults ?? []) {
    const duration = a.duration ?? 0;
    fileTotal += duration;
    tests.push({ file: relPath, title: a.fullName || a.title, duration });
  }
  fileTotals.set(relPath, (fileTotals.get(relPath) ?? 0) + fileTotal);
}

tests.sort((a, b) => b.duration - a.duration);
const files = [...fileTotals.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\n=== Slowest ${Math.min(top, tests.length)} individual tests ===`);
for (const t of tests.slice(0, top)) {
  console.log(`${String(t.duration).padStart(7)}ms  ${t.file}  ›  ${t.title}`);
}

console.log(`\n=== Slowest ${Math.min(top, files.length)} files (sum of test durations) ===`);
for (const [file, total] of files.slice(0, top)) {
  console.log(`${String(total).padStart(8)}ms  ${file}`);
}

console.log(`\n${report.numTotalTests} tests total, ${tests.length} timed.`);
