/**
 * @file scripts/lib/usage-report-secret-paths.mjs
 * @description The ONE place `scripts/usage-report/usage-report.mjs`'s external admin-key location (and its
 * optional Keychain service name) is NAMED — shared with the two enforcement points that must never drift
 * from it: `we:scripts/guard-bash.mjs`'s Bash-tool read deny (closes the gap for a Claude-side dispatched
 * agent, which keeps Bash re-enabled under `--restricted`) and
 * `we:scripts/operations/codex-delivery-provider.mjs#defaultDeliveryDenyPaths` (Codex's OS-enforced native
 * filesystem deny, `we:scripts/lib/isolation-provider.mjs#buildNativeDenyCodexArgs`). A path typed three times
 * is a path that silently drifts the moment one of the three call sites is edited; this module holds ONLY the
 * path/name constants — no key material, no fs I/O of the secret itself — so importing it into the two deny
 * surfaces (both of which already sit on the dispatch/guard critical path) carries none of the risk that
 * importing the actual key-LOADING code would.
 *
 * WHY THE REAL SECRET LIVES OUTSIDE THE REPO CHECKOUT ENTIRELY, NOT UNDER `scripts/usage-report/.env` (even
 * gitignored). A gitignored file still lives inside every LANE CLONE's own working tree — a lane is a full
 * `git clone` of this repo (#3627/#3580), and `.env`/`.gitignore` rules say nothing about what a lane's own
 * disk copy contains, only what git tracks. So an in-tree gitignored path would exist, on disk, at a path any
 * dispatched agent's own cwd already covers — a deny-list would be the ONLY thing standing between it and a
 * direct read. Rooting it under the OPERATOR's home directory instead — outside any repo/lane path — means no
 * lane clone or dispatch checkout can EVER contain it, structurally: there is no path traversal from a lane's
 * own tree that reaches it, deny-list enforcement or not. The deny-list entries below are real, additional
 * enforcement layered on TOP of that structural fact, not a substitute for it.
 *
 * See `we:scripts/usage-report/README.md` for the full threat-model writeup (why a plain file is not the
 * strongest available guarantee, and why this tool tries a macOS Keychain item FIRST when one exists).
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The external secret directory. A FUNCTION, not a frozen constant — `homedir()` reads `process.env.HOME` (or
 * `USERPROFILE`) at call time, the same reasoning `codex-delivery-provider.mjs#defaultDeliveryDenyPaths` gives
 * for taking `repoRoot` as a parameter rather than baking it in: baking in a value read once at import time
 * would silently go stale under a test harness or a differently-configured host.
 */
export function usageReportSecretDir(env = process.env) {
  return join(homedir_(env), '.we-usage-report');
}

/** The `.env` fallback file itself, under the directory above. This is the FILE-BASED mode — see the README
 *  for why the Keychain mode (below) is tried first when available and this is the cross-platform fallback. */
export function usageReportSecretEnvPath(env = process.env) {
  return join(usageReportSecretDir(env), '.env');
}

// `os.homedir()` does not take an env override, which makes it untestable without mutating the real process
// env. This thin wrapper reads the same variables `os.homedir()` itself documents falling back to, so a test
// can inject a fake `env` instead — mirrors the pattern host-independent constants elsewhere in this repo use.
function homedir_(env) {
  return (env && (env.HOME || env.USERPROFILE)) || homedir();
}

/**
 * The macOS Keychain "service" name this tool's optional Keychain-backed mode reads/writes under (`security
 * add-generic-password -s <service> …`). Two accounts share it, one per provider — see the README for the
 * exact `security` commands. Named here too, for the same no-drift reason as the paths above: the guard-bash
 * arm denies a dispatched agent's Bash attempt to query this service BY NAME, exactly as it denies a read of
 * the file above.
 */
export const USAGE_REPORT_KEYCHAIN_SERVICE = 'we-usage-report';

/** The two Keychain "account" values used under the shared service name above — one per provider, so a single
 *  `security` item lookup names exactly which admin key it is retrieving. */
export const USAGE_REPORT_KEYCHAIN_ACCOUNTS = Object.freeze({
  anthropic: 'anthropic-admin-key',
  openai: 'openai-admin-key',
});
