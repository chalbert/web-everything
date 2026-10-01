/** Load the initial immutable data snapshot. Live decisions receive validated data from the reader. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROUTING_POLICY_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dispatch-routing-policy.json');
const tryParse = text => { try { return JSON.parse(text); } catch { return null; } };
/**
 * A running daemon sends its last-good snapshot to children, so a syntactically broken on-disk policy cannot crash a
 * runner it launched. The env var has no provenance, though, so a snapshot may never LOOSEN the critical-work gate: one
 * whose gated kinds are narrower than the on-disk file's is ignored (the gate is critical work the file guards).
 */
export function trustedSnapshot(raw, diskText = readDisk()) {
  const snapshot = raw ? tryParse(raw) : null;
  if (!snapshot) return null;
  const disk = tryParse(diskText);
  const gated = disk?.criticalWorkGate?.kinds;
  if (Array.isArray(gated) && !gated.every(kind => snapshot.criticalWorkGate?.kinds?.includes(kind))) return null;
  return snapshot;
}
function readDisk() { try { return readFileSync(ROUTING_POLICY_PATH, 'utf8'); } catch { return ''; } }
export const initialRoutingPolicy = trustedSnapshot(process.env.WE_DISPATCH_ROUTING_SNAPSHOT) ?? JSON.parse(readFileSync(ROUTING_POLICY_PATH, 'utf8'));
