---
name: project_crossorigin_import_keeps_devserver_clean
description: Live-test/workbench loads framework wrapper modules cross-origin so the running dev server never resolves the vendor dep —
metadata: 
  node_type: memory
  type: project
  originSessionId: 85821b29-1b68-4252-9b8f-2599c1d09d4e
---

#1499 ruling: the workbench live-test (#1030/#912) serves a generated react/vue wrapper from a **separate origin** and **cross-origin-imports** it — `await import('http://localhost:<port>/<block>.js?form=react-wrapper')`. The framework dep (`react`/`react-dom`/`vue`) lives only on that serving origin, **never in the main `fui:` :3001 tree or the shipped bundle**.

**Why:** ES dynamic import is origin-agnostic, and #955-A2 forbids only the *iframe*, not a cross-origin fetch — the imported module still mounts **same-document**. `fui:workbench/mount.ts` imports a URL and never does `import 'react'` itself, so the running :3001 dev server never resolves/pre-bundles the vendor dep → no re-optimize, no reload, no don't-restart-the-server violation. This is why #1030's `setup` human-gate was wrong and got removed.

**How to apply:** before flagging "needs the dev server restarted" because a feature pulls a heavy dep, ask whether the dep can be served from a *second* origin and cross-origin-imported (CORS in dev is trivial). Two framework copies (one per origin) is fine when the consumer is framework-free and the mount is isolated. The excluded fork (same-origin via the running Vite's middleware) is flawed because it both reloads the server and leaks vendor deps toward the main tree — see [[project_fui_vendor_deps_quarantined_subpackage]].
