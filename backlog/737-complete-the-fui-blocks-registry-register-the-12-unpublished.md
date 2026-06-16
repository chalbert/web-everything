---
type: issue
workItem: story
size: 5
parent: "723"
locus: frontierui
status: open
dateOpened: "2026-06-16"
tags: []
---

# Complete the FUI blocks registry — register the 12 unpublished blocks + spec pages

12 of 19 FUI block impls are absent from src/_data/blocks.json so they never render publicly; author each {id,name,type,summary,protocol,weSpecPath} (curated ids, not dir-names) + ensure a /blocks/{id}/ page. From the #723 audit.
