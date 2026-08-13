import type { DepthBelowRoot } from "./types.ts";

export function canSplit(depth: DepthBelowRoot): boolean {
  return depth === 0 || depth === 1;
}

export function childDepth(depth: DepthBelowRoot): DepthBelowRoot {
  switch (depth) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      throw new Error("depth cap: cannot nest below 2");
    default: {
      const _exhaustive: never = depth;
      throw new Error(`unexpected depth ${_exhaustive}`);
    }
  }
}
