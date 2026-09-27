#!/usr/bin/env node
/**
 * Soak fixture for breaks/queue-split-across-checkouts.mjs — ONE queue operation, in its OWN process, through the
 * DEFAULT paths of the copy of `queue-store.mjs` that lives in the checkout named by argv[2] (so the module's
 * script-location root is THAT checkout, exactly as it is for a real process started there).
 *   node queue-op.mjs <checkoutRoot> add <num>   # read-modify-write through the defaults
 *   node queue-op.mjs <checkoutRoot> read        # prints the cleared ids as JSON
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , checkoutRoot, op, num] = process.argv;
const store = await import(pathToFileURL(join(checkoutRoot, 'scripts/conveyor/queue-store.mjs')).href);
if (op === 'add') {
  store.writeQueueFile(store.addToQueue(store.readQueueFile(), num, 'T'));
  process.stdout.write(`${store.resolveQueuePath()}\n`);
} else {
  process.stdout.write(`${JSON.stringify(store.readQueueFile().map((e) => e.num))}\n`);
}
