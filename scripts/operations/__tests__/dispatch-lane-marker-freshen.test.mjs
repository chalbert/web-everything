/**
 * @file dispatch-lane-marker-freshen.test.mjs — mechanical-dispatcher #3383 Part 2 follow-up: the
 * `deliveryAgent:` marker-ordering bug found on the first live Codex trial, and its fix.
 *
 * ── THE BUG, CONFIRMED BY READING THE REAL CODE (not assumed) ───────────────────────────────────────────────
 *
 * `readItemDeliveryAgentMarker` (`../delivery-agent-marker.mjs`) reads a plain `readFileSync` off `REPO_ROOT` —
 * ONE fixed, persistent checkout `../dispatch-lane-io.mjs#assertNotALaneCheckout` already guarantees can never
 * be a `lane-<N>` pool clone. `build.mjs`/`fix.mjs`/`ci-heal.mjs` (the dispatch-providers) all read this marker
 * in the PARENT process, strictly BEFORE the detached child they spawn ever calls `acquireLane`
 * (`../deliver-item-wrapper.mjs`) — so the literal "a lane's acquire step resets the lane's working tree...
 * before the dispatch-provider code ever gets to read it" race cannot happen through THAT seam: the resolved
 * provider name is captured as a plain string and threaded through `--provider=<name>` argv, immune to whatever
 * a LANE's own later acquire does to a directory the read never touched (`dispatch-lane-build-wiring.test.mjs`
 * already covers that ordering).
 *
 * The REAL, confirmed bug is narrower: the marker is invisible to the read unless it is ALREADY on `REPO_ROOT`'s
 * own on-disk copy of its tracked branch AT READ TIME. It lands there the same way every other backlog
 * frontmatter field does — lane clone → PR → merge — but nothing kept `REPO_ROOT`'s own working tree current
 * before the read ran. A marker that HAD already merged could still be invisible to the very next dispatch
 * decision if `REPO_ROOT` itself had gone stale — which is why the trial's "the marker can only currently take
 * effect if it's already merged into main" finding is true but incomplete. THIS file proves that gap and its
 * fix: `defaultFreshenPrimaryCheckout` (`../delivery-agent-marker.mjs`), wired into `createDispatchSinks` via
 * the new `freshenCheckout` option, best-effort fetches + fast-forwards `root` BEFORE any provider — and
 * therefore any marker read — runs.
 *
 * NOTHING HERE SPAWNS A PROCESS OR SHELLS REAL `git`. Every seam is injected, mirroring
 * `dispatch-lane-build-wiring.test.mjs` and `main-staleness.test.mjs`'s own conventions.
 */
import { describe, it, expect } from 'vitest';

import { createDispatchSinks, routeDispatchProvider } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { deliverItemDetachedProvider } from '../dispatch-providers/build.mjs';
import { readItemDeliveryAgentMarker } from '../delivery-agent-marker.mjs';

/** The effect payload `dispatch-lane.mjs`'s `dispatch` step actually emits, trimmed to what a provider reads. */
const buildPayload = (over = {}) => ({
  num: '9999',
  launchKind: 'build',
  lane: 7,
  sessionSlug: 'conveyor-9999',
  scope: 'we:scripts/operations',
  prompt: '# a filled brief\n',
  expectedWithinMinutes: 45,
  ...over,
});

function recordingSpawnDetached(pid = 4242) {
  const calls = [];
  const fn = (argv, opts) => { calls.push({ argv, opts }); return { pid, unref() {} }; };
  return { fn, calls };
}

describe('createDispatchSinks — `freshenCheckout` ordering', () => {
  it('defaults to a NO-OP: every existing caller stays byte-identical', async () => {
    const { fn: spawnDetached } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: '/repo',
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'mechanical',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached, readDeliveryAgentMarker: () => null }),
        agent: () => { throw new Error('must not reach the agent path'); },
      }),
    });
    // No `freshenCheckout` named — must not throw, must not require one.
    await expect(sinks[DISPATCH_EFFECT](buildPayload())).resolves.toMatchObject({ handle: 'pid:4242' });
  });

  it('runs `freshenCheckout(root)` BEFORE the provider — the ordering the marker read depends on', async () => {
    const order = [];
    const { fn: spawnDetached } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: '/primary/checkout',
      freshenCheckout: (root) => order.push(['freshen', root]),
      provider: (request) => {
        order.push(['provider', request.num]);
        return routeDispatchProvider(request, {
          buildMode: 'mechanical',
          mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached, readDeliveryAgentMarker: () => null }),
          agent: () => { throw new Error('must not reach the agent path'); },
        });
      },
    });
    await sinks[DISPATCH_EFFECT](buildPayload());
    expect(order).toEqual([['freshen', '/primary/checkout'], ['provider', '9999']]);
  });

  it('trusts `freshenCheckout` to already be best-effort — the sink adds no second guard', async () => {
    const { fn: spawnDetached } = recordingSpawnDetached();
    // The CONTRACT lives on `freshenCheckout` itself: the real default (`defaultFreshenPrimaryCheckout`) never
    // throws — see its own docblock and `delivery-agent-marker.test.mjs`'s "NEVER THROWS" case. The sink does
    // NOT re-wrap the call in a second try/catch (that would be a duplicate of the same promise in two places),
    // so an injected double that breaks the contract propagates — pinning that this is a deliberate choice, not
    // an oversight, should a future caller ever be tempted to hand in a throwing one.
    const sinks = createDispatchSinks({
      root: '/repo',
      freshenCheckout: () => { throw new Error('network unreachable'); },
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'mechanical',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached, readDeliveryAgentMarker: () => null }),
        agent: () => { throw new Error('must not reach the agent path'); },
      }),
    });
    await expect(sinks[DISPATCH_EFFECT](buildPayload())).rejects.toThrow(/network unreachable/);
  });
});

describe('THE ORIGINAL BUG, reproduced and closed end to end', () => {
  /**
   * An in-memory git-tracked-file stand-in: `store.files` is what `REPO_ROOT`'s OWN on-disk backlog directory
   * currently holds; `store.origin` is what has ALREADY LANDED on the tracked branch (e.g. a lane's PR merged
   * the `deliveryAgent:` marker in). Before a fetch+ff, they can legitimately disagree — that disagreement IS
   * the bug. `readItemDeliveryAgentMarker` — the REAL production function, not a stand-in — reads `store.files`
   * exactly as it reads real disk.
   */
  function makeStore(initialFiles) {
    return { files: { ...initialFiles }, origin: { ...initialFiles } };
  }

  const readMarkerFromStore = (store) => (num) => readItemDeliveryAgentMarker(num, {
    root: 'primary', // never touched as a real path — `listFiles`/`read` are stubbed below.
    listFiles: () => Object.keys(store.files),
    read: (p) => {
      const name = p.split('/').pop();
      if (!(name in store.files)) throw new Error(`no such file: ${p}`);
      return store.files[name];
    },
  });

  it('BEFORE THE FIX (freshenCheckout absent): a marker landed on origin stays invisible forever', async () => {
    // The marker has ALREADY MERGED — e.g. the item's own lane opened a PR that landed it — but `REPO_ROOT`'s
    // own on-disk copy has not been synced since. This is the trial's own "can only take effect if already
    // merged into main" finding, shown to be INCOMPLETE: merged is not enough without a fresh read too.
    const store = makeStore({ '9999-some-item.md': '---\nstatus: open\n---\n' });
    store.origin['9999-some-item.md'] = '---\nstatus: open\ndeliveryAgent: codex\n---\n';

    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: '/repo',
      // NO freshenCheckout — the pre-fix shape (the option did not exist at all before this change).
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'mechanical',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached, readDeliveryAgentMarker: readMarkerFromStore(store) }),
        agent: () => { throw new Error('must not reach the agent path'); },
      }),
    });
    await sinks[DISPATCH_EFFECT](buildPayload());
    // The bug: `--provider=codex` never appears, because the stale on-disk copy was all that was ever read.
    expect(calls[0].argv.join(' ')).not.toMatch(/--provider=/);
  });

  it('AFTER THE FIX: the SAME landed-but-stale marker IS honoured, because freshening runs first', async () => {
    const store = makeStore({ '9999-some-item.md': '---\nstatus: open\n---\n' });
    store.origin['9999-some-item.md'] = '---\nstatus: open\ndeliveryAgent: codex\n---\n';

    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: '/repo',
      // The real production wiring (`run.mjs`'s own registration): freshen BEFORE the provider runs. Modelled
      // here as "pull brings the tracked branch's current content in" — exactly what `--ff-only --autostash`
      // does for real, proven separately (with an injected `git`) in `delivery-agent-marker.test.mjs`.
      freshenCheckout: () => { store.files = { ...store.origin }; },
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'mechanical',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached, readDeliveryAgentMarker: readMarkerFromStore(store) }),
        agent: () => { throw new Error('must not reach the agent path'); },
      }),
    });
    await sinks[DISPATCH_EFFECT](buildPayload());
    expect(calls[0].argv).toContain('--provider=codex');
  });

  it('THE LITERAL REPORTED SCENARIO: a SEPARATE lane clone gets its own acquire-reset — irrelevant either way', async () => {
    // Reproduces exactly what the live trial described: the marker was set on the item's backlog file WHILE
    // working in a lane clone, and that SAME lane's own `lane-pool.mjs acquire` (a totally different directory
    // and a totally different store from `REPO_ROOT`) resets its working tree back to `origin/main` — discarding
    // whatever local edit was sitting there. This models that reset as its own, independent store mutation, and
    // proves it has ZERO bearing on the dispatch decision either way: the marker's fate is decided entirely by
    // `REPO_ROOT`'s own state (freshened or not), never by the lane's.
    const primary = makeStore({ '9999-some-item.md': '---\nstatus: open\n---\n' });
    primary.origin['9999-some-item.md'] = '---\nstatus: open\ndeliveryAgent: codex\n---\n';
    const laneClone = { files: { '9999-some-item.md': '---\nstatus: open\ndeliveryAgent: codex\n---\n' } };

    // The lane's OWN acquire: reset ITS OWN copy back to origin/main — wipes the lane-local edit, same as
    // `lane-pool.mjs acquire`'s real `checkout -B <branch> origin/main` would. This runs BEFORE dispatch, as
    // the trial describes, and touches ONLY `laneClone`, never `primary`.
    laneClone.files['9999-some-item.md'] = '---\nstatus: open\n---\n'; // acquire happened; marker gone from the lane.
    expect(laneClone.files['9999-some-item.md']).not.toMatch(/deliveryAgent/); // sanity: the lane really lost it.

    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    const sinks = createDispatchSinks({
      root: '/repo',
      freshenCheckout: () => { primary.files = { ...primary.origin }; },
      provider: (request) => routeDispatchProvider(request, {
        buildMode: 'mechanical',
        mechanical: (r) => deliverItemDetachedProvider(r, { spawnDetached, readDeliveryAgentMarker: readMarkerFromStore(primary) }),
        agent: () => { throw new Error('must not reach the agent path'); },
      }),
    });
    await sinks[DISPATCH_EFFECT](buildPayload());
    // Dispatch still honours the marker — resolved from `primary` (freshened), utterly unaffected by the
    // lane's own, separate reset.
    expect(calls[0].argv).toContain('--provider=codex');
  });
});
