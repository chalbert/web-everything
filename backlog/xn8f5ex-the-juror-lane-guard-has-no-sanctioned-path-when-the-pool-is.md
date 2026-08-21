---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# The juror lane guard has no sanctioned path when the pool is full

assertLaneCwd demands a lane clone that is not the driver own. With sibling agents holding every pool lane, four agents on 2026-08-21 each invented a different escape: a disposable clone in a shared scratchpad which another agent then deleted mid-run, a privately named clone, a separate named pool, and lane-pool provision --acquirable which grew the pool from 13 to 27 and nearly exhausted disk. All four worked; none is documented; one silently broke eight juror runs. Give the guard a sanctioned full-pool path so unattended agents stop inventing one.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
