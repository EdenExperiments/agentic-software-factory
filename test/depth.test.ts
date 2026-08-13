import assert from "node:assert/strict";
import { test } from "node:test";
import { canSplit, childDepth } from "../factory/src/depth.ts";

test("root and first children may split", () => {
  assert.equal(canSplit(0), true);
  assert.equal(canSplit(1), true);
  assert.equal(canSplit(2), false);
});

test("childDepth stops at 2", () => {
  assert.equal(childDepth(0), 1);
  assert.equal(childDepth(1), 2);
  assert.throws(() => childDepth(2), /depth cap/);
});
