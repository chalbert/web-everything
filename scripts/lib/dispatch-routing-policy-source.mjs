/** Load the initial immutable data snapshot. Live decisions receive validated data from the reader. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROUTING_POLICY_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dispatch-routing-policy.json');
// A running daemon sends its last-good snapshot to children. Read it BEFORE the edited file, so even
// a syntactically broken on-disk policy cannot crash a runner launched by that daemon.
export const initialRoutingPolicy = JSON.parse(process.env.WE_DISPATCH_ROUTING_SNAPSHOT ?? readFileSync(ROUTING_POLICY_PATH, 'utf8'));
