/**
 * @file scripts/lib/__tests__/fixtures/daemon-job-throws.mjs
 * @description #4125 test job kind that always throws — drives the "up to 3 attempts, then fail visibly" test.
 */
import { appendFileSync } from 'node:fs';

export async function run({ input = {}, attempt }) {
  if (input.traceFile) appendFileSync(input.traceFile, `${JSON.stringify({ event: 'start', attempt })}\n`);
  throw new Error(`deliberate failure on attempt ${attempt}`);
}
