---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: '2026-06-02'
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: "intent:file-revision"
tags:
  - file-upload
  - file-update
  - traits
  - intents
  - paradigms
  - reliability
  - accessibility
relatedProject: webtraits
---

# Codify the file-update component as composable intents & traits

A "file update" control is not one component but a composition of reusable paradigms — and its distinguishing trait is that a value *already exists*: you are replacing/revising a file, not just uploading one. Decompose it the way the droplist and drag-and-drop families were, then codify the pieces as intents and traits, each mapping to a native substrate. The native baseline is `<input type="file">`; everything above it (drop zone, resumable transfer, local-disk pickers) is an opt-in enhancement, never the floor.

<h3>Why it's here</h3><p>Preliminary research, not a finished spec. Upload/update UIs are routinely rebuilt as one-off monoliths that fuse picking, validation, preview, transfer, progress, and persistence into a single widget. The same move that turned "dropdown" into a trait composition applies here: name the paradigms first, so a plain field, a drag-and-drop dropzone, and a resumable chunked uploader are the *same* component at different trait altitudes. Note the "update" framing specifically — an existing value implies dirty-tracking, revert, and replace-in-place semantics that a greenfield "upload" ignores.</p><h3>Candidate paradigms &rarr; intents/traits</h3><ul><li><strong>file-source</strong> — how files enter: native picker, drag-and-drop dropzone, clipboard paste, directory, or a File System Access handle. Each is a swappable provider; the dropzone variant <em>composes the existing drag-and-drop paradigms</em> rather than reinventing them.</li><li><strong>accept-constraint</strong> — declared accepted types / size / count, validated <em>before</em> transfer starts (overlaps <code>webvalidation</code>; a provider that gates the source).</li><li><strong>preview</strong> — render a representation of the chosen/current file (image thumbnail, PDF first page, type icon) — a component trait.</li><li><strong>transfer-strategy</strong> — how bytes move: single request, chunked, or resumable. A provider, so the same widget scales from a 2KB avatar to a multi-GB video without UI change.</li><li><strong>progress-state</strong> — the lifecycle <code>idle &rarr; selected &rarr; transferring &rarr; done | error</code> as observable state (overlaps <code>webstates</code>; drives both the bar and a11y announcements).</li><li><strong>replace-in-place / revision</strong> — the "update" core: there is a current value, so the trait owns dirty tracking, revert-to-original, and optimistic-vs-confirmed swap. This is what makes it <em>update</em> and not <em>upload</em>.</li><li><strong>commit / persistence strategy</strong> — where the new file is written (a POST/PUT endpoint, an OPFS entry, a File System Access handle, or just the form value) — a provider, mirroring the droplist's resolution model.</li></ul><h3>Native substrate</h3><ul><li><code>&lt;input type="file"&gt;</code> with <code>accept</code>, <code>multiple</code>, <code>capture</code> (camera), and <code>webkitdirectory</code> — the always-keyboard-operable baseline every higher trait degrades back to.</li><li>File API (<code>File</code>, <code>Blob</code>, <code>FileList</code>), Drag-and-Drop + <code>DataTransfer</code>, and the <code>paste</code> event / <code>ClipboardItem</code> — the three ways bytes reach the page.</li><li><strong>File System Access API</strong> (<code>showOpenFilePicker</code> / <code>showSaveFilePicker</code> / <code>showDirectoryPicker</code>) is <em>Chromium-only</em> — Firefox and Safari ship only the Origin Private File System (OPFS), with no local-disk pickers and no committed plan to add them. So local-disk handles are an enhancement; OPFS is the cross-browser staging area for resumable transfers.</li><li>Transfer/progress: <code>XMLHttpRequest.upload.onprogress</code> is still the reliable progress signal; <code>fetch</code> streaming upload (<code>ReadableStream</code> body + <code>duplex: "half"</code>) exists but support is patchier.</li><li>Resumable: the IETF <em>Resumable Uploads for HTTP</em> draft (104 <code>Upload Resumption Supported</code> + <code>Upload-Offset</code>) and the de-facto <strong>tus</strong> protocol (Cloudflare, Supabase, Vimeo) — this maps cleanly onto a <code>webreliability</code> recovery handler (resume = retry-from-offset), so resumability may belong there rather than in a bespoke transfer trait.</li><li>Accessibility: the bare input is keyboard-operable by default; a custom dropzone must stay so, and <code>progress-state</code> changes must announce via a live region. The standard should mandate this, not bolt it on.</li></ul><h3>Open questions to resolve before authoring</h3><ul><li>Does <strong>resumable transfer</strong> live in this component as a transfer-strategy trait, or is it purely a <code>webreliability</code> recovery handler the component consumes?</li><li>Replace-in-place semantics: optimistic swap (show new immediately, roll back on failure) vs. confirmed swap (keep old until commit succeeds) — default, and is it a trait option?</li><li>Is "file-update" a distinct standard, or just the droplist-style observation that the upload component <em>always</em> had a current-value dimension we under-modeled?</li><li>Which transfer axes are <strong>correctness</strong> (a shortfall rules an approach out) vs <strong>fidelity</strong> (a shortfall is a workable compromise)? The configurator currently models <code>metadata</code>, <code>destination</code>, and <code>resilience</code> as correctness, and <code>progress</code>, <code>multiplicity</code>, and no-JS as fidelity — confirm, especially <code>multiplicity</code> (is "many files with independent per-file retry" a hard requirement or a degrade-with-notice?).</li></ul><h3>Interactive surface</h3><p>The <code>transfer-strategy</code> decision tree is operationalized as a <strong>File Upload &amp; Update</strong> domain in the plateau-app Technical Configurator (<code>/technical-configurator</code>) — outcome axes (progress, companion fields, destination, size/resilience, files-per-upload, no-JS) ranked against concrete strategies (native form, XHR/fetch multipart, fetch streaming, presigned PUT, base64-JSON, resumable tus, File System Access). That tool is where a developer picks the correct upload approach from the options; this item is the standard it draws from.</p>

## Codification (2026-06-10) — what graduated, and the open questions resolved

Codified as **one UX-only intent — [`file-revision`](/intents/file-revision/)** (`we:src/_data/intents.json`,
status `concept`), not a sprawling new family. The decomposition deliberately **composes** existing/pending
intents rather than duplicating them, which resolves the open questions:

- **Scope (distinct standard vs under-modeled dimension):** the latter. `valuePresence: existing | empty`
  is modeled as a *dimension*, so file-**upload** and file-**update** are the **same** control at two
  settings — the droplist-style answer. The intent owns only the revision delta (`existing` unlocks revert +
  swap model).
- **Replace-in-place default:** `swapModel` is a trait option; default **`confirmed`** (keep the original
  until commit succeeds — an existing value is precious), with `optimistic` (show-then-rollback) as the opt-in.
- **`revert`:** a dimension, default **`enabled`** — restore-to-original is the affordance that distinguishes
  update from upload; the observable lifecycle is `pristine → staged → committed`.
- **Resumable transfer — trait or `webreliability` handler?** Reliability handler. Resume = retry-from-offset,
  so it composes the [Reliability](/intents/reliability/) intent; it is **not** a bespoke transfer trait here.
- **What is *not* an intent (UX-only rule):** entry/accept (file-source, drop-target, accepts) is the
  **data-transfer intent's** territory ([#007](/backlog/007-gap-11-clipboard-dnd-files-intents/)) — referenced,
  not duplicated; transfer + commit/persistence are **technical** and stay in the configurator domain;
  progress lifecycle composes Loader / Background Task. The correctness-vs-fidelity axis question stays with
  the configurator that models it (#007 + the configurator domain own those calls).

**Graduated to** `intent:file-revision` — File Revision Intent (concept) — UX-only revision delta (valuePresence/swapModel/revert); entry+accept defer to #007 data-transfer, transfer+commit to the File Upload & Update configurator domain, progress composes Loader/Background-Task, resumable composes Reliability.
