// @webeverything/contracts/trainable-judge — the trainable-judge feedback corpus's pure-contract surface
// (#1580; epic #1552; ruled by #1553). Type-only re-export (zero runtime emit) of the canonical contract
// module. Per we:docs/agent/platform-decisions.md#trainable-judge ruling 4, WE owns ONLY this schema; the
// corpus store (#1581), learning mechanism (#1583), benchmark (#1582), and #490 distillation are Plateau
// impl (#1282). This is the WE→FUI/Plateau arrow over which the trainable judge's never-lose corpus is
// defined — the model-agnostic asset, exactly like `./dockable` and `./analytics`.
export type * from '../trainable-judge/contract';
