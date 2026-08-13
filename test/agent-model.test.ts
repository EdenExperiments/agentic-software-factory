import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSdkModel } from "../factory/src/agent.ts";

test("resolveSdkModel maps pstack Task slugs to SDK ids", () => {
  assert.equal(resolveSdkModel("cursor-grok-4.6-high-fast"), "grok-4.6");
  assert.equal(resolveSdkModel("claude-opus-5-thinking-high"), "claude-opus-5");
  assert.equal(resolveSdkModel("gpt-5.6-sol-xhigh"), "gpt-5.6-sol");
});

test("resolveSdkModel defaults and passes through SDK ids", () => {
  assert.equal(resolveSdkModel(undefined), "grok-4.6");
  assert.equal(resolveSdkModel("  "), "grok-4.6");
  assert.equal(resolveSdkModel("grok-4.6"), "grok-4.6");
});
