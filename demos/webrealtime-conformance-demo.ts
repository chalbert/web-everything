/**
 * Web Realtime conformance demo (#1069, slice C of #1025) — the runnable proof of the transport-
 * negotiation contract+runtime (#1067, contract `realtime/contract.ts`).
 *
 * The transport-negotiation contract is type-only (the runtime — native SSE/WebSocket negotiation, the
 * WebTransport probe, the hub adapters — is impl in FUI). This demo proves the contract with an in-demo
 * **negotiating stub** that conforms to `CustomTransportProvider`: it probes a `prefer` order top-down
 * against a capability set and returns a `Connection` for whichever channel won, message exchange and all.
 * The conformance claims: native-first floor order, capability-gating (an absent WebTransport degrades),
 * `send` present only on bidirectional channels. `setPlaygroundReady` reports the pass count.
 */
import type {
  CustomTransportProvider,
  Connection,
  TransportKind,
} from '/realtime/contract.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

/** A negotiating stub provider — picks the first preferred channel the capability set supports. */
function stubProvider(available: Set<TransportKind>): CustomTransportProvider {
  return {
    id: 'native',
    async connect({ prefer = ['websocket', 'sse', 'long-poll'] }): Promise<Connection> {
      const kind = prefer.find((k) => available.has(k)) ?? 'long-poll';
      const handlers: { msg?: (d: unknown) => void; close?: (r?: string) => void } = {};
      const bidirectional = kind === 'websocket' || kind === 'webtransport';
      const conn: Connection = {
        kind,
        onmessage(h) { handlers.msg = h; },
        onclose(h) { handlers.close = h; },
        close() { handlers.close?.('client-closed'); },
        ...(bidirectional
          ? { send(data: unknown) { handlers.msg?.({ echo: data }); } } // loopback echo for the demo
          : {}),
      };
      return conn;
    },
  };
}

const checks: { name: string; pass: boolean; detail: string }[] = [];
const assert = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

// 1) Native-first: with WebSocket available, the preferred top channel wins.
const full = stubProvider(new Set<TransportKind>(['websocket', 'sse', 'long-poll']));
const c1 = await full.connect({ url: 'wss://x', prefer: ['websocket', 'sse', 'long-poll'] });
assert('negotiates the top preferred available channel (websocket)', c1.kind === 'websocket', `kind=${c1.kind}`);

// 2) Capability-gating: WebTransport requested but unavailable → degrades down the floor to websocket.
const noWT = stubProvider(new Set<TransportKind>(['websocket', 'sse', 'long-poll']));
const c2 = await noWT.connect({ url: 'wss://x', prefer: ['webtransport', 'websocket', 'sse'] });
assert('absent WebTransport degrades to the next floor (websocket)', c2.kind === 'websocket', `kind=${c2.kind}`);

// 3) The long-poll floor always works (nothing else available).
const floor = stubProvider(new Set<TransportKind>(['long-poll']));
const c3 = await floor.connect({ url: 'http://x', prefer: ['websocket', 'sse'] });
assert('falls through to the long-poll floor when nothing preferred is available', c3.kind === 'long-poll', `kind=${c3.kind}`);

// 4) `send` present only on a bidirectional channel (type-honest one-way SSE).
const sse = stubProvider(new Set<TransportKind>(['sse', 'long-poll']));
const cSse = await sse.connect({ url: 'http://x', prefer: ['sse'] });
assert('one-way SSE has no send() (type-honest)', typeof cSse.send !== 'function', `hasSend=${typeof cSse.send === 'function'}`);
assert('bidirectional websocket has send()', typeof c1.send === 'function', `hasSend=${typeof c1.send === 'function'}`);

// 5) Message exchange round-trips over a bidirectional connection.
let received: unknown = null;
c1.onmessage((d) => { received = d; });
c1.send!('ping');
assert('message exchange round-trips', (received as any)?.echo === 'ping', `received=${JSON.stringify(received)}`);

// 6) close() fires the close handler.
let closed = false;
c1.onclose(() => { closed = true; });
c1.close();
assert('close() fires the close handler', closed, `closed=${closed}`);

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
