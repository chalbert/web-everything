---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
tags: [maas, polyglot, block-explorer, protocol]
---

# Define the MaaS wrapper-serve protocol (CEM→framework-wrapper ESM serve contract)

The #955 ruling builds #912's live-test sandbox on a dev-server endpoint that runs genWrapper(cem,target)+transpile and serves a ready ESM module the browser consumes via plain import(). That endpoint's request/response shape IS a MaaS wrapper-serve protocol — and unlike the resolved #081 cluster (#461/#505/#463, which defined the polyglot server-impl generation/distribution origin), the CEM→framework-wrapper ESM serve contract a browser sandbox consumes is not yet defined. Define it (request shape: block id + target framework [+ CEM hash for cache/pin]; response: ESM module + content-type + cache/version headers; how bare react/vue imports are left for the consumer's bundler/import-map to resolve; error/404 semantics) so the FUI dev-server endpoint conforms to a real contract (local form now, plateau-app hosted MaaS later per #091/#398) rather than being throwaway. Contract→WE, generator impl→FUI (#855), hosted serve→plateau-app.
