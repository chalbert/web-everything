---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
tags: [maas, polyglot, block-explorer, protocol]
---

# Define the MaaS wrapper-serve protocol (CEM→framework-wrapper ESM serve contract)

The #955 ruling builds #912's live-test sandbox on a dev-server endpoint that runs `genWrapper(cem,target)` + transpile and serves a ready ESM module the browser consumes via plain `import()`. That endpoint's request/response shape **is** a MaaS wrapper-serve protocol — and the resolved #081 cluster (#461/#505/#463) defined the polyglot *server-impl* generation origin, **not** the CEM→framework-wrapper ESM serve contract a browser sandbox consumes. Define that contract (request: block id + target [+ CEM hash for cache/pin]; response: ESM module + cache/version headers; how bare react/vue imports stay for the consumer's bundler/import-map; error/404 semantics) so the FUI dev-server endpoint conforms to it (local form now, plateau-app hosted MaaS later, #091/#398) rather than being throwaway. Contract→WE, generator→FUI (#855), hosted serve→plateau-app.
