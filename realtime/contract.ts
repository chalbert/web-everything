/**
 * Transport-Negotiation protocol — the **pure-contract half** (#1025, slice #1067).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/transport-negotiation` entry (#872/#874) that FUI depends on (the FUI→WE
 * arrow), superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`.
 * The runtime half — the native-first negotiating provider (SSE/WebSocket), the WebTransport capability
 * probe, and the hub adapters (Socket.IO, SignalR, Centrifugo) behind the swap registry — is impl and
 * lives in FUI; only the contract crosses the seam (npm scope mirrors layer).
 *
 * Web Realtime owns the **open-app** server↔client delivery family (live updates, presence, cursors) —
 * the sibling of the closed-app push transport (webnotifications); the #455 by-purpose split gives each
 * its own home. Choosing SSE vs WebSocket vs WebTransport vs long-poll is async, capability-dependent,
 * and swappable — a Protocol, not an intent. A producer never hard-wires a socket: it resolves a
 * `CustomTransportProvider` and gets a `Connection` for whichever channel won negotiation (a real
 * provider seam, per the Project/Protocol bar; #458 design).
 *
 * Two rulings are encoded here, not redecided downstream:
 *  - **Native-first, capability-gated, never assumed.** SSE + WebSocket are the defaults; WebTransport is
 *    feature-probed (Chrome/Edge only, no Safari) and, when absent, negotiation degrades to WebSocket,
 *    then the long-poll floor that always works. The `prefer` order is probed top-down.
 *  - **`send` is optional** — present only where the transport is bidirectional, so a one-way SSE
 *    `Connection` is type-honest rather than carrying a throwing stub.
 *
 * Out of scope for this foundation contract (the project's open questions, decided downstream): whether
 * negotiation re-evaluates mid-session (a WebTransport upgrade once probed) or is fixed at `connect`;
 * whether reconnect/backoff is owned here or delegated to webreliability's recovery registry; whether the
 * protocol standardizes a message envelope or stays payload-opaque (kept opaque here, like the push
 * `DeliveryReceipt`).
 */

/** The channels negotiation can settle on, in native-first floor order. */
export type TransportKind = 'websocket' | 'sse' | 'webtransport' | 'long-poll';

/**
 * A live connection — the result of a successful negotiation. `kind` reports which channel won; `send` is
 * present only on bidirectional transports (WebSocket / WebTransport), absent on one-way SSE / long-poll.
 */
export interface Connection {
  /** Which channel won negotiation. */
  readonly kind: TransportKind;
  /** Present only where the transport is bidirectional. */
  send?(data: unknown): void;
  /** Register the inbound-message handler. */
  onmessage(handler: (data: unknown) => void): void;
  /** Register the close handler. */
  onclose(handler: (reason?: string) => void): void;
  /** Tear down the connection. */
  close(): void;
}

/**
 * A transport provider — the swappable seam, the lock. `id: 'native'` (the default SSE/WebSocket
 * negotiation) or a hub (`'socket-io'` | `'signalr'` | `'centrifugo'` | …). Concrete providers are impl
 * and live in FUI, resolved nearest-scope-wins through the injector chain.
 */
export interface CustomTransportProvider {
  /** `'native'` (default) | `'socket-io'` | `'signalr'` | `'centrifugo'` | … */
  readonly id: string;
  /**
   * Open a connection, negotiating the best available channel. `prefer` is probed top-down; capability-
   * gated kinds (WebTransport) are feature-detected, never assumed.
   */
  connect(options: {
    url: string;
    /** Negotiation order; default `['websocket', 'sse', 'long-poll']`. */
    prefer?: TransportKind[];
  }): Promise<Connection>;
}
