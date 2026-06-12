---
type: idea
workItem: story
size: 2
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: router
tags: [exercise-app, loan-origination, router, consumption-slice]
---

# Loan app consumes the Router block (module nav + deep-links)

Consumption slice of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)): the module bar
(Pipeline / Application / Processing / Underwriting / Admin) and view switching are driven by the shipping
**Router** block — `route:link` anchors + a `<route-view>` of per-module `<template route>`s — making the
loan app the router's first enterprise consumer. **Resolved**: router reads `conformant` in the benchmark.
