---
kind: story
size: 8
status: open
dateOpened: "2026-07-15"
tags: []
---

# Restructure plateau-app into a thin product shell (coarse workflow-domain products)

Ratified in #2476: plateau-app becomes a thin product shell — each product (Platform Manager, Design-System Studio, Explorer, Plateau Loop, Brand, Docs) gets its own route prefix + second-level menu under the existing FUI nav blocks, replacing today's flat 17-item Tools list. Coarse granularity (membership from the product-vs-tool criterion; mode-not-product escape hatch for same-object surfaces). Keep the Explorer surface named 'Explorer' (internal label, no brand). Extraction-ready so a product's code can later move per #2446 as a route-move, not a rewrite.
