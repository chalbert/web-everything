---
type: issue
workItem: epic
status: open
dateOpened: "2026-06-15"
tags: []
---

# webtraits: tree-shakable trait composition across all major build tools + MaaS + public docs

Umbrella for taking the Trait Enforcer's usage-scanned code-splitting (today Vite-only, #034/#484) to full cross-toolchain + served reach. Goal: a composed component declares only the traits it binds, and unused traits emit zero bytes — under every major bundler (Rollup, webpack, esbuild, Parcel, +SWC-native), proven by one conformance suite, served framework-agnostically through the MaaS origin (#461), and documented publicly on FUI's site. Ratified out of #713 (date/time picker scope → option C: one abstract temporal block + named shallow preset blocks, bundle kept honest by traits). The component-compiler chain (#127/#231/#234/#238) and MaaS-module chain (#461/#505/#506) are proven templates for this work, not coverage of it — they split a different artifact (<component>, not traits).
