import { isAbsolute, relative, normalize } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

export const MAX_TIMEOUT_LOG_BYTES = 2 * 1024 * 1024;

/** A complete default-reporter inventory is required; a timeout substring is never enough. */
export function timeoutRetryFiles({ stdout = '', stderr = '', failureDetails, changedFiles, cwd }) {
  if (!failureDetails || failureDetails.truncated || !Array.isArray(failureDetails.tests) || !Array.isArray(changedFiles)
      || Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > MAX_TIMEOUT_LOG_BYTES) return [];
  const localPath = (file) => {
    const path = normalize(isAbsolute(file) ? relative(cwd, file) : file);
    return path === '..' || path.startsWith('../') || isAbsolute(path) ? null : path;
  };
  const edited = new Set(changedFiles.map(localPath));
  const failures = [];
  let current = [], summaries = 0, failedCount = 0, fileSummaries = 0, failedFiles = 0, duration = false;
  // Vitest prints failure blocks to stderr and totals to stdout. Keep each stream's own ordering.
  for (const raw of `${stderr}\n${stdout}`.split('\n')) {
    if (raw.length > 4096) return [];
    const line = stripVTControlCharacters(raw).trim();
    if (/Failed Suites|Unhandled Errors|Unhandled Rejection|Uncaught Exception|^Errors\s+\d+ errors/i.test(line)) return [];
    const summary = /^Tests\s+(\d+) failed\b/.exec(line);
    if (summary) { summaries++; failedCount = Number(summary[1]); current = []; }
    const files = /^Test Files\s+(\d+) failed\b/.exec(line);
    if (files) { fileSummaries++; failedFiles = Number(files[1]); current = []; }
    if (/^Duration\s+[\d.]+/.test(line)) duration = true;
    if (/^[⎯─]+\[\d+\/\d+\]/.test(line)) current = [];
    if (/^FAIL\s/.test(line)) {
      const match = /^FAIL\s+(?:\[[^\]]+\]\s+)?(.+?\.(?:[cm]?[jt]sx?))\s+>\s+(.+)$/.exec(line);
      if (!match) return [];
      const file = localPath(match[1]);
      if (!file || edited.has(file)) return [];
      // Vitest groups consecutive FAIL headers sharing one error body.
      if (current.some(f => f.timeout)) current = [];
      const failure = { file, name: match[2], timeout: false };
      current.push(failure);
      failures.push(failure);
    } else if (current.length && /^(?:\w*Error|Caused by):/.test(line)) {
      if (!/^Error: Test timed out in \d+ms\./.test(line)) return [];
      for (const failure of current) failure.timeout = true;
    }
  }
  const files = [...new Set(failures.map(f => f.file))];
  if (summaries !== 1 || fileSummaries !== 1 || !duration || !failures.length
      || failures.length !== failedCount || files.length !== failedFiles
      || failures.some(f => !f.timeout)
      || failureDetails.tests.length !== failures.length
      || failures.some(f => !failureDetails.tests.some(t => localPath(t.file) === f.file && t.name === f.name))) return [];
  return files;
}

export function describeTimeoutRetry(files) {
  return files?.length ? ` Retried once serially after timeout-only failures in untouched files: ${files.join(', ')}.` : '';
}
