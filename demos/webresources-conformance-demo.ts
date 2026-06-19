/**
 * Web Resources conformance demo (#1076, slice C of #1027) — the runnable proof of the pagination +
 * delivery-transport contract (#1074, contract `resources/contract.ts`).
 *
 * The resources contract is type-only (concrete REST/GraphQL/WS clients + the customResources registry
 * are impl in FUI). This demo proves it with in-demo **conforming stubs**: a `CustomResourceClient` that
 * returns a cold `Consumable` (nothing runs until subscribed), and `CustomPagination` windows for the
 * `offset` vs `cursor` strategies. The load-bearing conformance claim (#061): a `total` is present only
 * for offset/page (drives jump-to-page) and ABSENT for cursor (write-stable, next/prev only) — the
 * pairing constraint the discriminated union encodes. `setPlaygroundReady` reports the pass count.
 */
import type {
  CustomResourceClient,
  Consumable,
  ResourceOperation,
  ResourceResult,
  CustomPagination,
} from '/resources/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

/** A cold Consumable — runs the producer only on subscribe (independent execution each time). */
function cold<T>(produce: (o: { next?: (v: T) => void; error?: (e: unknown) => void; complete?: () => void }) => void): Consumable<T> {
  return {
    subscribe(observer) {
      let active = true;
      produce({
        next: (v) => active && observer.next?.(v),
        error: (e) => active && observer.error?.(e),
        complete: () => active && observer.complete?.(),
      });
      return { unsubscribe() { active = false; } };
    },
  };
}

/** A stub resource client decoupling the app from the transport (returns a cold Consumable). */
const client: CustomResourceClient & { executed: number } = {
  executed: 0,
  execute(operation: ResourceOperation): Consumable<ResourceResult> {
    return cold<ResourceResult>((o) => {
      client.executed++;
      o.next?.({ data: { op: operation.kind, key: operation.key } });
      o.complete?.();
    });
  },
};

const DATA = Array.from({ length: 25 }, (_, i) => `item-${i}`);

/** An offset-strategy pagination window — exposes `total` (jump-to-page). */
function offsetPage(offset: number, limit: number): CustomPagination<string> {
  const items = DATA.slice(offset, offset + limit);
  return {
    items,
    total: DATA.length,
    hasNext: offset + limit < DATA.length,
    hasPrevious: offset > 0,
    async next() { return offsetPage(offset + limit, limit); },
    async previous() { return offsetPage(Math.max(0, offset - limit), limit); },
  };
}

/** A cursor-strategy pagination window — NO `total` (write-stable, next/prev only). */
function cursorPage(after: number, limit: number): CustomPagination<string> {
  const items = DATA.slice(after, after + limit);
  return {
    items,
    // total deliberately omitted — the #061 pairing constraint
    hasNext: after + limit < DATA.length,
    hasPrevious: after > 0,
    async next() { return cursorPage(after + limit, limit); },
    async previous() { return cursorPage(Math.max(0, after - limit), limit); },
  };
}

const checks: { name: string; pass: boolean; detail: string }[] = [];
const assert = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

// 1) A Consumable is COLD — execute() runs nothing until subscribed.
const consumable = client.execute({ kind: 'query', key: ['users'], context: {} });
assert('execute() is cold (no run before subscribe)', client.executed === 0, `executed=${client.executed}`);

// 2) Subscribing runs it once and yields a transport-normalized result.
let result: ResourceResult | null = null;
consumable.subscribe({ next: (v) => { result = v; } });
assert('subscribe runs the operation and yields a result', client.executed === 1 && (result as any)?.data?.op === 'query', `executed=${client.executed}`);

// 3) offset strategy exposes total (jump-to-page is possible).
const o0 = offsetPage(0, 10);
assert('offset strategy exposes total (jump-to-page)', o0.total === 25, `total=${String(o0.total)}`);

// 4) next() advances the offset window.
const o1 = await o0.next();
assert('offset next() advances the window', o1.items[0] === 'item-10' && o1.hasPrevious, `first=${o1.items[0]}`);

// 5) cursor strategy exposes NO total (write-stable, the #061 constraint).
const cur = cursorPage(0, 10);
assert('cursor strategy omits total (write-stable)', cur.total === undefined, `total=${String(cur.total)}`);

// 6) cursor next()/previous() still navigate.
const cur1 = await cur.next();
assert('cursor next() advances without a total', cur1.items[0] === 'item-10' && cur1.total === undefined, `first=${cur1.items[0]}`);

// 7) The last offset window reports hasNext=false at the end.
const last = offsetPage(20, 10);
assert('offset window reports end-of-data', last.hasNext === false && last.items.length === 5, `len=${last.items.length}`);

// ── Render ──
const passCount = checks.filter((c) => c.pass).length;
const root = document.getElementById('play-root')!;
root.innerHTML = '';
const summary = document.createElement('p');
summary.className = 'conformance-summary';
summary.textContent = `${passCount}/${checks.length} conformance checks passed`;
const list = document.createElement('ul');
list.className = 'conformance-list';
for (const c of checks) {
  const li = document.createElement('li');
  li.className = c.pass ? 'pass' : 'fail';
  li.textContent = `${c.pass ? '✓' : '✗'} ${c.name} — ${c.detail}`;
  list.appendChild(li);
}
root.append(summary, list);
setPlaygroundReady(passCount);
