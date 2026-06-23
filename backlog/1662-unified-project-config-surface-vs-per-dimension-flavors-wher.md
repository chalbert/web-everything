---
kind: decision
parent: "099"
status: open
dateOpened: "2026-06-23"
tags: []
---

# Unified project-config surface vs per-dimension flavors — where config-extends-platform-default values live

Surfaced by #798: the config-extends-platform-default statute says dimension values (SoT-mode, auto-define, render-strategy, theme…) live in a project config extending a platform-default flavor — but is there ONE materialized project-config artifact all dimensions inherit from, or does each dimension carry its own flavor config? Fork: (a) a single unified project-config surface (like an inherited rc/platform-config file) vs (b) per-dimension flavor configs that compose. Decide the materialization shape so future config-extends-platform-default dimensions have a home to write into.
