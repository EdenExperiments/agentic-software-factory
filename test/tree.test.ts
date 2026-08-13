import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  parseJobContract,
  parseNonEmptyString,
  parseNonEmptyStringList,
} from "../factory/src/contract.ts";
import { createGitOps } from "../factory/src/git.ts";
import { kick } from "../factory/src/tree.ts";
import type { CreatePr, GitOps, RunAgent, SplitChild, VerifyOps } from "../factory/src/types.ts";

const execFileAsync = promisify(execFile);

async function withTempRepoRoot<T>(fn: (repoRoot: string) => Promise<T>): Promise<T> {
  const repoRoot = await mkdtemp(join(tmpdir(), "factory-kick-"));
  try {
    return await fn(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

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

function gitMock(options?: {
  commitDirty?: boolean;
}): GitOps & { worktrees: string[]; merges: string[] } {
  const worktrees: string[] = [];
  const merges: string[] = [];
  let commit = "base";
  const commitDirty = options?.commitDirty ?? true;
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
      if (!commitDirty) {
        return false;
      }
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
  await withTempRepoRoot(async (repoRoot) => {
    const git = gitMock();
    const runAgent: RunAgent = async () => ({ kind: "implement" });
    const result = await kick({
      repoRoot,
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
});

test("kick fans out one worktree per child and merges up", async () => {
  await withTempRepoRoot(async (repoRoot) => {
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
      repoRoot,
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
      git.worktrees.some((entry) => entry.startsWith("factory/demo--left@")),
    );
    assert.ok(
      git.worktrees.some((entry) => entry.startsWith("factory/demo--right@")),
    );
    assert.deepEqual(git.merges, [
      "factory/demo--left",
      "factory/demo--right",
    ]);
    assert.equal(
      git.worktrees.some((entry) => entry.includes("factory/demo/")),
      false,
    );
  });
});

test("depth-2 nodes cannot split even if the agent asks", async () => {
  await withTempRepoRoot(async (repoRoot) => {
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
      repoRoot,
      job: job(),
      planText: "deep",
      runAgent,
      git,
      verify: verifyOk(),
      createPr: openPr,
    });
    assert.deepEqual(allowSplitByCall, [true, true, false]);
  });
});

test("kick keeps dirty work and still opens a PR when the run errors", async () => {
  await withTempRepoRoot(async (repoRoot) => {
    const git = gitMock();
    const runAgent: RunAgent = async () => ({
      kind: "error",
      message: "run run-1 failed after executing: boom",
      retryable: false,
    });
    const result = await kick({
      repoRoot,
      job: job(),
      planText: "salvage me",
      runAgent,
      git,
      verify: verifyOk(),
      createPr: openPr,
    });
    assert.equal(result.prUrl, "https://example.test/pr/1");
  });
});

test("kick fails when the run errors and the worktree is clean", async () => {
  await withTempRepoRoot(async (repoRoot) => {
    const git = gitMock({ commitDirty: false });
    const runAgent: RunAgent = async () => ({
      kind: "error",
      message: "run run-1 failed after executing: boom",
      retryable: false,
    });
    await assert.rejects(
      () =>
        kick({
          repoRoot,
          job: job(),
          planText: "empty",
          runAgent,
          git,
          verify: verifyOk(),
          createPr: openPr,
        }),
      /failed after executing: boom/,
    );
  });
});

test("git worktrees accept sibling factory branches joined with --", async () => {
  await withTempRepoRoot(async (repoRoot) => {
    await execFileAsync("git", ["init"], { cwd: repoRoot, encoding: "utf8" });
    await execFileAsync("git", ["config", "user.email", "factory@example.test"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    await execFileAsync("git", ["config", "user.name", "factory"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    await execFileAsync("git", ["commit", "--allow-empty", "-m", "base"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const startPoint = stdout.trim();
    await mkdir(join(repoRoot, ".factory-worktrees"), { recursive: true });
    const ops = createGitOps();
    await ops.createWorktree({
      repoRoot,
      worktreePath: join(repoRoot, ".factory-worktrees", "factory-demo"),
      branch: "factory/demo",
      startPoint,
    });
    await assert.rejects(
      () =>
        ops.createWorktree({
          repoRoot,
          worktreePath: join(repoRoot, ".factory-worktrees", "nested-left"),
          branch: "factory/demo/left",
          startPoint,
        }),
      /cannot lock ref|already exists/i,
    );
    await ops.createWorktree({
      repoRoot,
      worktreePath: join(repoRoot, ".factory-worktrees", "factory-demo--left"),
      branch: "factory/demo--left",
      startPoint,
    });
  });
});
