import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseJobContract,
  parseNonEmptyString,
  parseNonEmptyStringList,
} from "../factory/src/contract.ts";
import { kick } from "../factory/src/tree.ts";
import type { CreatePr, GitOps, RunAgent, SplitChild, VerifyOps } from "../factory/src/types.ts";

function job() {
  return parseJobContract({
    planPath: ".cursor/plans/demo.plan.md",
    acceptanceCriteria: ["done"],
    targetPaths: ["src/a.ts"],
    verificationCommand: "npm test",
  });
}

function child(id: string, path: string): SplitChild {
  return {
    id: parseNonEmptyString(id, "id"),
    title: parseNonEmptyString(id, "title"),
    targetPaths: parseNonEmptyStringList([path], "targetPaths"),
    acceptanceCriteria: parseNonEmptyStringList(["done"], "acceptanceCriteria"),
  };
}

function gitMock(): GitOps & { worktrees: string[]; merges: string[] } {
  const worktrees: string[] = [];
  const merges: string[] = [];
  let commit = "base";
  return {
    worktrees,
    merges,
    async createWorktree({ branch, worktreePath }) {
      worktrees.push(`${branch}@${worktreePath}`);
    },
    async mergeBranch({ fromBranch }) {
      merges.push(fromBranch);
      return { kind: "clean" };
    },
    async head() {
      return commit;
    },
    async currentBranch() {
      return "main";
    },
    async commitIfDirty() {
      commit = `${commit}+`;
      return true;
    },
    async push() {},
  };
}

function verifyOk(): VerifyOps {
  return {
    async run() {
      return { kind: "ok" };
    },
  };
}

const openPr: CreatePr = async () => "https://example.test/pr/1";

test("kick runs a single writer when the root does not split", async () => {
  const git = gitMock();
  const runAgent: RunAgent = async () => ({ kind: "implement" });
  const result = await kick({
    repoRoot: "/repo",
    job: job(),
    planText: "do the thing",
    runAgent,
    git,
    verify: verifyOk(),
    createPr: openPr,
  });
  assert.equal(result.branch, "factory/demo");
  assert.equal(result.prUrl, "https://example.test/pr/1");
  assert.equal(git.worktrees.length, 1);
  assert.match(git.worktrees[0] ?? "", /^factory\/demo@/);
  assert.deepEqual(git.merges, []);
});

test("kick fans out one worktree per child and merges up", async () => {
  const git = gitMock();
  let splitOnce = false;
  const runAgent: RunAgent = async () => {
    if (!splitOnce) {
      splitOnce = true;
      return {
        kind: "split",
        children: [child("left", "src/a.ts"), child("right", "src/b.ts")],
      };
    }
    return { kind: "implement" };
  };
  const result = await kick({
    repoRoot: "/repo",
    job: job(),
    planText: "split me",
    runAgent,
    git,
    verify: verifyOk(),
    createPr: openPr,
  });
  assert.equal(result.branch, "factory/demo");
  assert.equal(git.worktrees.length, 3);
  assert.ok(
    git.worktrees.some((entry) => entry.startsWith("factory/demo/left@")),
  );
  assert.ok(
    git.worktrees.some((entry) => entry.startsWith("factory/demo/right@")),
  );
  assert.deepEqual(git.merges, ["factory/demo/left", "factory/demo/right"]);
});

test("depth-2 nodes cannot split even if the agent asks", async () => {
  const git = gitMock();
  const allowSplitByCall: boolean[] = [];
  const runAgent: RunAgent = async ({ allowSplit }) => {
    allowSplitByCall.push(allowSplit);
    if (allowSplit) {
      return { kind: "split", children: [child("a", "a.ts")] };
    }
    return { kind: "implement" };
  };
  await kick({
    repoRoot: "/repo",
    job: job(),
    planText: "deep",
    runAgent,
    git,
    verify: verifyOk(),
    createPr: openPr,
  });
  assert.deepEqual(allowSplitByCall, [true, true, false]);
});
