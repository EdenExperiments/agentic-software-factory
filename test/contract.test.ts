import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJobContract } from "../factory/src/contract.ts";

test("parseJobContract accepts a valid contract", () => {
  const job = parseJobContract({
    planPath: ".cursor/plans/epic.plan.md",
    acceptanceCriteria: ["npm test passes"],
    targetPaths: ["factory/src/tree.ts"],
    verificationCommand: "npm test",
  });
  assert.equal(job.planPath, ".cursor/plans/epic.plan.md");
  assert.deepEqual(job.targetPaths, ["factory/src/tree.ts"]);
});

test("parseJobContract rejects extra fields", () => {
  assert.throws(
    () =>
      parseJobContract({
        planPath: "p.md",
        acceptanceCriteria: ["a"],
        targetPaths: ["a.ts"],
        verificationCommand: "npm test",
        orchestrator: true,
      }),
    /unknown job contract fields/,
  );
});

test("parseJobContract rejects empty lists", () => {
  assert.throws(
    () =>
      parseJobContract({
        planPath: "p.md",
        acceptanceCriteria: [],
        targetPaths: ["a.ts"],
        verificationCommand: "npm test",
      }),
    /acceptanceCriteria/,
  );
});
