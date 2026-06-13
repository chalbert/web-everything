---
type: idea
locus: exercise-app
workItem: story
size: 8
status: open
parent: "317"
dateOpened: "2026-06-12"
tags: [exercise-app, loan-origination, configurator, pricing, phase]
---

# Phase S6 — product & rate configurator

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Select a loan
product from a catalog whose eligibility constraints filter the available set given the application; derive
rate/price from a rate sheet keyed by (product, LTV band, credit band, term, lock) + LLPAs; recompute
payment/APR/cash-to-close. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/)
(M5). Drives the **Technical Configurator / NL-to-config** paradigm (constraint graph).
