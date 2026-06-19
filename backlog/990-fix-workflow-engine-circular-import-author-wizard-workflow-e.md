---
type: issue
workItem: story
size: 3
parent: "972"
locus: frontierui
status: open
dateOpened: "2026-06-19"
tags: []
---

# Fix workflow-engine circular import + author wizard/workflow-engine FUI demos

Carved from #981 (which shipped the stepper demo). Two coupled blocks remain demo-less because of a real defect found in batch-2026-06-18: fui:blocks/workflow-engine/NativeWorkflowEngine.ts re-exports customWorkflowEngine from fui:blocks/workflow-engine/registry.ts, and fui:blocks/workflow-engine/registry.ts both imports NativeWorkflowEngine AND instantiates new NativeWorkflowEngine() at module top level — a load-time import cycle. It is benign under vitest but in a browser/Vite ESM graph the registry module evaluates before the class finishes initialising, throwing 'Cannot access NativeWorkflowEngine before initialization', so the workflow-engine entry (and the wizard, which imports it) is un-importable in the browser. FIX the cycle safely (e.g. lazy-seed the native default in fui:blocks/workflow-engine/registry.ts, or relocate the customWorkflowEngine singleton to a third module that imports both) WITHOUT removing the re-export (7 unit tests import customWorkflowEngine/CustomWorkflowEngineRegistry through NativeWorkflowEngine — a naive removal breaks them). THEN author fui:demos for wizard (<wizard-flow> over a portable WorkflowGraph) and workflow-engine (NativeWorkflowEngine send/current state machine) and wire demoFile. locus frontierui.
