// @webeverything/contracts/dockable — the dockable block's pure-contract surface (#1485 slice #1510; intent #1437).
// Type-only re-export (zero runtime emit) of the canonical contract module; the runtime impl is FUI's
// (the recursive container render #1511, drag-to-dock #1512, serialize/restore #1513, popout #1514 all
// live in FUI, statute #1290). This is the FUI→WE arrow over which the standard resolves: the FUI impl
// imports these types and the #1486 interchange Protocol's core schema is `DockLayout`, exactly like
// `./stepper` and `./graph`.
export type * from '../blocks/dockable/contract';
