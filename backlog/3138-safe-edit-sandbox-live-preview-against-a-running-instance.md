---
bornAs: x1l80ae
kind: story
size: 5
parent: "1650"
status: open
locus: plateau-app
dateOpened: "2026-08-15"
tags: [dev-browser, safe-edit, sandbox, epic-1650, live-preview, unprepared]
---

# Safe-edit sandbox: live preview against a running instance

Epic #1650 promised the developer can "see the effect immediately" — apply a proposed edit to an isolated, running instance before choosing discard/emit. None of the epic's 3 build slices (#3139 buffer, #3140 verify-gate, #3141 emit) ever applies buffer content to a live instance: the buffer is fs/DOM-free, the gate only checks conformance, and emit only writes the file post-gate. Tracked here rather than left implicit (flagged during #1355's review) so the epic isn't marked fully satisfied while live-preview is unshipped.

Needs its own prep pass — the mechanism is unscoped (likely a postMessage/HMR channel from the buffer to a running sandboxed instance) — before it is build-ready; the size above is a rough placeholder, not a prepared estimate.

## What this prep pass settled — and the one fork it did not

**Settled:** the seam, the module boundary, the interfaces, and how generation identity plus content identity
together keep a late-arriving preview from reading as applied (below). **Still open, deliberately:** *which
transport*
carries a preview to the running instance — a `postMessage` channel into a sandboxed iframe, or a Vite HMR
custom-event channel into the dev server. That is a real fork with different failure modes and different
hosting assumptions, and it is why the `unprepared` tag stays on this card. The design below is written so the
fork is confined to **one injected port** and does not gate the rest of the build: the session, the message
shape, and the staleness rule are testable without ever choosing.

## Design

**What already exists** (checked, not assumed): [#3139](/backlog/3139-safe-edit-sandbox-live-edit-propose-apply-revert-buffer/)
is `resolved` and shipped `plateau-app:packages/dev-browser/src/safe-edit/buffer.ts` — an fs-free, in-memory
`SafeEditBuffer` with `propose` / `read` / `write` / `revert` / `get` / `all` plus the round-7 identity trio
`token(key)` / `snapshot(key)` / `isCurrent(key, token)`. #3140 (verify-gate) and #3141 (emit) are still
`open`. Nothing in the package writes to disk or opens a network connection today; this card is the first
piece that talks to anything outside the tab.

**Do not change the frozen buffer API.** `SafeEditBuffer` has no change-notification hook and adding one would
re-open #3139's settled surface. Instead the panel UI drives preview explicitly, reading through the buffer's
existing synchronous accessors:

```ts
// plateau-app:packages/dev-browser/src/safe-edit/preview/types.ts

/** The wire message a running instance receives. Plain JSON — no DOM, no functions. */
export interface PreviewMessage {
  readonly kind: 'safe-edit/preview';
  readonly key: string;      // EditTarget.key — `${absPath}:${line}:${col ?? 0}`
  readonly token: number;    // the buffer generation this content came from
  readonly after: string;    // the proposed declared-form content
  readonly sentAt: number;   // caller-supplied epoch ms — the module stays Date-free
}

/** THE FORK, isolated: postMessage-into-iframe or HMR-custom-event. Injected, never imported. */
export type PreviewTransport = {
  send(msg: PreviewMessage): void;
  /** Acks from the instance, so a push can be reported applied/failed rather than assumed. */
  onAck(cb: (ack: { key: string; token: number; ok: boolean; reason?: string }) => void): () => void;
};

// plateau-app:packages/dev-browser/src/safe-edit/preview/session.ts
export class PreviewSession {
  constructor(buffer: SafeEditBuffer, transport: PreviewTransport);
  /** Read `key`'s current { after, token } and send it. No-op (returns false) if nothing is pending. */
  push(key: string, sentAt: number): boolean;
  /** Latest applied state per key, for the panel to render. */
  statusOf(key: string): { readonly token: number; readonly applied: boolean; readonly reason?: string } | undefined;
}
```

**The staleness rule is the whole point, and it reuses #3139's round-7 token verbatim.** A preview push crosses
an async boundary (the instance re-renders, then acks), and in that window the developer may `revert()` or
re-`propose()`. So:

- `push` takes `{ after, token }` from ONE `buffer.snapshot(key)` call, never two separately-timed reads.
- An ack is honoured only when `buffer.isCurrent(key, ack.token)` — an ack for a superseded generation is
  **dropped**, not rendered as "applied". This is exactly the failure #3139's round-7 fix exists to make
  detectable, and it is why the token rides on the wire.
- A `revert()` mid-flight makes `isCurrent` false for every outstanding token, so the panel falls back to
  "nothing pending" rather than showing a preview of content the developer discarded.

**The token alone is NOT sufficient — `write()` is the hole.** #3139 deliberately specified that
`SafeEditBuffer.write(key, content)` does **not** bump the generation (its own suite pins *"`write()` leaves
`token()` unchanged"*), because `write` is Slice 2's gate bookkeeping rather than a new user proposal. That is
correct for #3140 and wrong for preview: a verify-gate `write` changes the content under a preview whose token
still matches, so `isCurrent(key, token)` answers `true` about content the instance never received, and
`statusOf(key)` would keep reporting `applied: true` with nothing surfaced. So the session tracks **content
identity as well as generation identity**:

- `push` records the `{ after, token }` it actually sent.
- `statusOf(key)` reports `applied` only when the token is still current **and** the recorded `after` still
  equals `buffer.read(key)`; otherwise it reports `stale` with the reason (`'reverted' | 'superseded' |
  'rewritten'`), so a `write`-induced divergence surfaces instead of going silent.
- Do **not** "fix" this by making `write()` bump the token — that would re-open #3139's settled API and break
  #3140's read/verify separation. The preview side absorbs it.

**Still fs-free on this side.** The session sends declared-form strings; nothing here writes a file. Emitting
remains #3141's job, and the verify-gate remains #3140's — this card does not gate, does not write, and does
not open a PR.

**Epic bookkeeping — and a THIRD missing piece, named so it is not silently assumed.** #1650's "see the effect
immediately" promise needs this session, *a transport*, **and a dev-browser panel host to drive it from**.
`we:backlog/1650-safe-edit-sandbox-emitting-a-pr.md` explicitly puts that panel out of scope for all three of
its slices and calls it "separate, unfiled work" — so it is still unfiled, and the epic cannot read as fully
delivered until it exists. File it when this card is picked up, rather than discovering it at demo time.

## Done when

1. **Executable** — `npm test` in `plateau-app:` is green with new cases in
   `plateau-app:packages/dev-browser/src/safe-edit/preview/session.test.ts` asserting `push(key, sentAt)`
   sends exactly one `PreviewMessage` whose `key`/`token`/`after` match a single `buffer.snapshot(key)`, and
   returns `false` sending nothing when no edit is pending. Fails before — the module does not exist.
2. **Executable** — the staleness case, which is the reason this design exists: `push`, then `revert(key)` (or
   re-`propose`), then deliver the ack for the ORIGINAL token — `statusOf(key)` must NOT report applied, and
   the dropped ack must be observable as dropped rather than silently ignored.
3. **Executable** — a fake-transport case proves the port boundary holds: the session imports no transport
   implementation, and swapping the fake for a second fake changes no session behaviour. One test constructs
   `PreviewSession` with two different fakes and asserts identical message sequences.
4. **Observable** — the `preview/` module opens no network connection and touches no filesystem: one `grep`
   over `plateau-app:packages/dev-browser/src/safe-edit/preview/` for `fetch`/`WebSocket`/`fs` returns nothing
   (all I/O lives behind the injected `PreviewTransport`).
5. **Executable** — the `write()` case, which the token alone cannot catch: `push(key)`, then
   `buffer.write(key, other)` (which by design leaves `token(key)` unchanged), then deliver the ack —
   `statusOf(key)` must report **stale** with reason `'rewritten'`, not `applied`. This is the criterion that
   proves the session tracks content identity and not just the generation token.
6. **Assertable** — with a transport implemented, a developer proposing an edit sees the running instance
   reflect it without discard/emit. Look at: a dev-browser panel host against a running sandboxed instance,
   proposing a declared-rule value change and observing the rendered result update. **No such panel exists**:
   `we:backlog/1650-safe-edit-sandbox-emitting-a-pr.md` puts it out of scope for all three of its slices and
   calls it "separate, unfiled work". So this criterion is **not satisfiable inside this card** — it is the
   acceptance test for the panel host whenever that is filed, recorded here so the epic is not read as
   delivering "see the effect immediately" on the strength of criteria 1-5 alone. *Criteria 1-5 are what this
   card can actually prove.*

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — All of the card's factual claims re-verified against the live repo — plateau-app:packages/dev-browser/src/safe-edit/buffer.ts's propose/read/write/revert/get/all plus token/snapshot/isCurrent trio exist exactly as described; we:backlog/3139-safe-edit-sandbox-live-edit-propose-apply-revert-buffer.md is resolved and we:backlog/3140-safe-edit-sandbox-verify-gate-wiring-over-declared-rules.md / we:backlog/3141-safe-edit-sandbox-discard-or-emit-pr-orchestration.md are open as claimed; the '#1355' citation is a PR round-7 reference, not a mismatched backlog-item citation (confirmed by matching wording in plateau-app:packages/dev-browser/src/safe-edit/buffer.ts and plateau-app:packages/dev-browser/src/safe-edit/buffer.test.ts, both citing 'PR #1355 round 7').
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Done-when #5 names 'the dev-browser panel' as the consumer to observe, but we:backlog/1650-safe-edit-sandbox-emitting-a-pr.md's own umbrella note states no dev-browser panel/UI exists and building one is 'separate, unfiled work' for all three build slices — 3138 doesn't file or flag that dependency either.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The transport-facing seam (PreviewSession/PreviewTransport) gets a real round-trip test in Done-when #3, but the buffer-write() seam is not reconciled: plateau-app:packages/dev-browser/src/safe-edit/buffer.ts's write() is documented and tested (plateau-app:packages/dev-browser/src/safe-edit/buffer.test.ts:116, 'write() leaves token() unchanged') to NOT bump the generation token, yet the card's staleness section only enumerates propose/revert as identity-changing operations.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — For the case the card does cover (revert/re-propose racing an in-flight ack), Done-when #2 requires a named, observable failure of the dropped ack, not just an internal boolean — that's a real guard, not decorative, for that specific case.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card explicitly disclaims the size-5 estimate as 'a rough placeholder, not a prepared estimate,' consistent with the deliberately-unresolved transport fork.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — A preview left stale by a future write() (see interface note above) would have statusOf(key) silently keep reporting applied:true with no surfaced signal — the design's own dropped-ack legibility guarantee (Done-when #2) only covers the propose/revert path, not the write() path.

**Corrections recommended:**

- none — the preparation held up as written.

The design is well-grounded in the live repo (buffer API, statuses of #3139/#3140/#3141, key format, and the #1355 PR citation all check out exactly as claimed), and it correctly confines the deliberately-unresolved transport fork to one injected port — but it has two unflagged gaps: the staleness rule never accounts for buffer.write()'s deliberate no-token-bump behavior, and Done-when #5 depends on a dev-browser panel that the epic explicitly left unfiled.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** All three findings are correct and are now fixed in the body. The
`interface`/`legibility` pair is the sharp one: #3139's `write()` deliberately does NOT bump the generation
token (its own suite pins "`write()` leaves `token()` unchanged"), so a Slice-2 verify-gate write would change
content under a preview whose token still matches — `isCurrent` would answer `true` and `statusOf` would keep
reporting `applied` with nothing surfaced. The staleness rule now tracks content identity alongside generation
identity, `statusOf` reports a reason (`reverted`/`superseded`/`rewritten`), and a new `## Done when` item 5
pins exactly that case; the note explicitly rejects the tempting fix of bumping the token in `write()`, which
would re-open #3139's settled API. The `consumer` finding is also right: no dev-browser panel host exists and
we:backlog/1650-safe-edit-sandbox-emitting-a-pr.md calls it "separate, unfiled work", so the tier-3 criterion
is now marked as not satisfiable inside this card and the missing panel is named in Epic bookkeeping. No
finding was judged wrong.

