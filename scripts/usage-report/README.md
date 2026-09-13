# usage-report — standalone Anthropic + OpenAI usage/cost check (epic #3383)

A standalone CLI, `usage-report.mjs`, that answers "how much Anthropic/OpenAI usage and spend has this
operator's own org burned, and what's the runway before a limit bites." It is **not** wired into
`runner.mjs`, **not** a dispatch operation, **not** registered in `DISPATCH_PROVIDER_REGISTRY` or any
dispatch-related registry, and it is imported by **nothing** under `scripts/operations/` or
`skills-src/conveyor/`. Run it by hand, from your own interactive shell:

```
node scripts/usage-report/usage-report.mjs            # human-readable summary
node scripts/usage-report/usage-report.mjs --json      # machine-readable, for future automation
node scripts/usage-report/usage-report.mjs --since=72  # look back 72 hours instead of the 24h default
```

## Why this exists, and why it is this careful about where the key lives

Neither Anthropic nor OpenAI offers a scoped-down "usage-only" admin credential — whatever admin key
exists carries full org-admin power (manage members, keys, workspaces) alongside the usage/cost read this
tool needs. This repo's dispatch pipeline has five spawn sites (`deliver-item-wrapper.mjs`,
`fix-dispatch-wrapper.mjs`, `ci-heal-dispatch-wrapper.mjs`, `minimal-context-provider.mjs`,
`dispatch-lane-io.mjs`) that all spread `{...process.env, ...}` wholesale into every dispatched agent they
spawn — Claude **and** Codex. So this key must never exist in the environment of any process that ever
spawns a dispatched agent, and it must never sit at a path a dispatched agent's own process (or the lane
clone it works in) can read.

## Where the real secret lives — three tiers, tried in this order

1. **macOS Keychain** (tried first, macOS only) — see [Keychain setup](#macos-keychain-setup-recommended-on-macos)
   below. The strongest available guarantee for this specific threat, and why, is explained there.
2. **An external file, `~/.we-usage-report/.env`** — **outside the repo checkout entirely**, in your home
   directory, resolved via `os.homedir()` (`scripts/lib/usage-report-secret-paths.mjs`). Deliberately **not**
   `scripts/usage-report/.env`, even gitignored: a gitignored file still lives inside every *lane clone's*
   own working tree (a lane is a full `git clone` of this repo), so an in-tree path — gitignored or not —
   would exist on disk at a path any dispatched agent's own cwd already covers. Rooting it under your home
   directory means no lane clone or dispatch checkout can *ever* contain it, structurally, regardless of any
   deny-list. Copy [`.env.example`](./.env.example) there and fill it in:
   ```
   mkdir -p ~/.we-usage-report
   cp scripts/usage-report/.env.example ~/.we-usage-report/.env
   $EDITOR ~/.we-usage-report/.env
   ```
3. **An already-exported env var** (`ANTHROPIC_ADMIN_KEY` / `OPENAI_ADMIN_KEY`) for the one-shot shell
   invocation that runs this tool. Safe **only** because this is a standalone process a dispatched agent
   never spawns and is never spawned from — **never** put it in a shell profile (`.zshrc`/`.bashrc`) or any
   long-lived shell a dispatch-spawning process might inherit from.

### Getting each admin key

- **Anthropic**: requires an organization with the **admin** role (unavailable for individual accounts) —
  Console → Settings → Organization → Admin API keys. Starts with `sk-ant-admin...`.
- **OpenAI**: requires the **Owner** role on the organization — platform.openai.com → Settings →
  Organization → Admin keys. An ordinary project API key is **not** sufficient; only an Admin key can read
  usage/costs.

## `~/.we-usage-report/` is a real deny-list target, not just a convention

Both the external file's directory and the Keychain service name below are wired into the two REAL
enforcement points a dispatched agent's own process actually runs under, as defense in depth layered on top
of the structural protections above (never a substitute for them):

- **Codex** — `scripts/operations/codex-delivery-provider.mjs#defaultDeliveryDenyPaths` adds this directory
  to Codex's native `filesystem` deny map (`scripts/lib/isolation-provider.mjs#buildNativeDenyCodexArgs`),
  which is enforced by the OS sandbox (Seatbelt) itself, independent of the model's cooperation — verified,
  for the mechanism this reuses, via `codex sandbox -P locked` with no model in the loop (see that file's
  own header).
- **Claude** — dispatched delivery/fix/ci-heal/scope-authoring/decision-authoring agents run under
  `--restricted`, which confines the *file tools* (Read/Edit/Write/Glob/Grep) to the process's own working
  directory (the lane clone) — a directory this external path is never under, so those tools are already
  structurally unable to reach it. `--restricted` does, however, re-enable the **Bash** tool
  (`--tools=Bash,Edit,Write,Read,Glob,Grep`), and a raw shell command is *not* confined by that same cwd
  rule — so `scripts/guard-bash.mjs` (the real `PreToolUse(Bash)` hook every dispatched agent's Bash calls
  already run through) denies any Bash segment that names this directory or queries the Keychain service by
  name, scoped to a dispatched agent only (`WE_DISPATCH_KIND` set) so the operator's own interactive use of
  this tool is unaffected. **Honest limit**, stated the same way `guard-bash.mjs`'s other content checks
  state theirs: this is a text-pattern match over the command string, not a filesystem-level guarantee — it
  denies a direct reference, not every conceivable obfuscation (a base64'd path, a variable built up
  character by character). It is real, additional enforcement, never the *only* thing standing in the way.

## macOS Keychain setup (recommended on macOS)

```
security add-generic-password -s we-usage-report -a anthropic-admin-key -w '<your admin key>'
security add-generic-password -s we-usage-report -a openai-admin-key    -w '<your admin key>'
```

**Do not pass `-T <app>` at all** — this is the important, non-obvious part. Read on for why.

### What Keychain's per-app ACL does and does not add here (an honest assessment)

Keychain lets you name specific trusted applications (`-T /path/to/app`) that may read an item *without a
prompt*. It is tempting to reach for that and "trust" this script. **Don't** — for this specific threat
model, it adds nothing. Keychain's ACL identifies the calling process by its own code-signing identity
(effectively, which compiled binary is asking), not by "which orchestration logic invoked this." A
dispatched agent's Bash/shell command and this tool's own `security` CLI invocation both ultimately run
through the *same generic system binaries* (`node`, `/usr/bin/security`, `/bin/bash`) under the *same macOS
user account*, in the *same login session*, as the operator. There is no code-signing distinction between
"the operator's trusted script" and "a dispatched agent's arbitrary shell command" here — naming a trusted
app by path would trust *every* process that happens to run through that same binary, dispatched agents
included, which is no protection at all.

What genuinely helps: creating the item with **no trusted application at all**. Every access — including
this tool's own — then requires an interactive OS confirmation (Touch ID / password) each time, with no
"Always Allow" ever granted. This is a real, qualitatively different guarantee from a plain file: a
dispatched agent (Claude or Codex, run headless via `execFileSync`/`spawn`, with no attended GUI session)
has no way to satisfy an interactive confirmation prompt at all — it cannot click "Allow" or authenticate,
so the read simply cannot complete, structurally, independent of any deny-list bookkeeping. A plain file has
no equivalent: any process with a filesystem read syscall can complete a read with nobody watching.

**Caveat, stated plainly rather than glossed over**: this was *not* live-tested in this session — deliberately, to avoid
triggering an unannounced Keychain confirmation dialog on the operator's own screen mid-task. The
conclusion above rests on documented macOS Keychain ACL semantics, not an independent live verification (the
same honesty standard `scripts/lib/isolation-provider.mjs` holds itself to about what it has and hasn't
proven live for Codex's own sandbox). Exact prompt behavior (e.g. whether a particular macOS version
remembers a session-scoped grant) is version/configuration-dependent — if you rely on this for a genuinely
sensitive credential beyond this tool's own admin key, verify it yourself against your OS version before
trusting it as a hard guarantee. It is also macOS-only; the external-file fallback above is what makes this
tool work at all on Linux/CI.

**Simpler alternative considered and rejected**: a `keytar`-style npm wrapper. Not needed — `keytar` itself
just shells out to `security` on macOS under the hood, and this repo has no existing dependency on it and no
other user for one; a direct `security` CLI invocation (`readKeychainSecret` in `usage-report.mjs`) is
simpler, native-first (#75), and equally capable for the two calls this tool makes.

## Testing

`__tests__/usage-report.test.mjs` exercises every pure function (parsing, param-building, summation,
formatting, the CLI driver) against fixture data shaped exactly like the real response bodies documented
above — it makes **no** real network call, no real Keychain call, and no real file read. `npm run check:standards`
and `npx vitest run scripts/usage-report` are both green as of this writing.

## What Part 1's research found about renewal/reset windows (so this tool's own header doesn't have to repeat it)

Neither provider exposes a subscription/billing-cycle **renewal date** via API:

- Anthropic's `GET /v1/organizations/me` returns only `{id, name}` — no plan/renewal field exists anywhere
  in the Admin API. The Admin API itself requires an organization with the admin role and is unavailable to
  individual accounts.
- OpenAI's billing cycle renews on the calendar day you first subscribed; that anchor date is
  dashboard/invoice-only and is not returned by any API endpoint.

What **is** real and used by this tool instead:

- Anthropic's org-level monthly **spend cap** (a pay-as-you-go usage-tier ceiling — Start/Build/Scale,
  separate from any personal Claude subscription) resets on a fixed, computable boundary: 00:00 UTC on the
  1st of the next calendar month. That boundary is stated reactively in the 429 body once you're already
  capped, never proactively queryable — but it needs no API call to compute (`daysUntilNextUtcMonth` in
  `usage-report.mjs`, pure, no network).
- Both providers' per-minute rate-limit `*-reset` headers (`anthropic-ratelimit-*-reset`, RFC 3339;
  `x-ratelimit-reset-*`, a duration string like `"6m0s"`) describe a short, continuously-replenished
  token-bucket window, **not** a billing cycle — and they are attached to actual inference calls
  (`POST /v1/messages`, `POST /v1/chat/completions`), not to the metadata GETs this tool makes. This tool
  therefore does not assume those specific headers will appear on its own responses; it reads whatever
  rate-limit-shaped headers a response actually carries (`extractRateLimitHeaders`), generically, and says
  so plainly when none are present (the expected case for these two endpoints).
- The daily cost-report buckets ARE something this tool sums itself (`sumAnthropicCost`/`sumOpenAICost`), so
  "spend so far" next to "days left in the UTC calendar month" is the best available runway proxy — real
  numbers assembled locally, not a renewal field that does not exist.
