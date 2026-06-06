---
type: idea
status: open
dateOpened: "2026-06-03"
tags: [droplist, tree-select, hierarchical, block, traits]
relatedProject: webblocks
crossRef:
  url: /blocks/droplist/
  label: droplist family page
---

# Design and author the tree-select block standard

A hierarchical concrete member of the droplist family: an anchored surface whose collection is a `role=tree` rather than a `role=listbox`, with expandable group nodes and selection commit at leaf (single) or any-node (multiple) depths. Unlike the other variants, no design exists yet — the trait selections for hierarchy, expand/collapse, and the focus model under a tree (still virtual focus, but with arrow-left/arrow-right collapsing/expanding the focused group) have to be worked out before a block standard can be written.

Open design questions: is "tree collection" a separate Intent (`tree-collection`?) the droplist composes when this variant is in play, or does the existing collection intent stretch to cover hierarchy? How does Windowed Collection interact with always-mount-focused-node when the focused node is a deep leaf? Does single-select-tree commit at any depth (folder-as-value) or only at leaves?
