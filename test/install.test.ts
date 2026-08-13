import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ensureWorktreeDependencies } from "../factory/src/install.ts";

const execFileAsync = promisify(execFile);
const overlayRoot = fileURLToPath(new URL("..", import.meta.url));

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "factory-install-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("ensureWorktreeDependencies is a no-op without a lockfile", async () => {
  await withTempDir(async (cwd) => {
    await ensureWorktreeDependencies(cwd);
    await assert.rejects(() => stat(join(cwd, "node_modules")));
  });
});

test("ensureWorktreeDependencies is a no-op when node_modules already exists", async () => {
  await withTempDir(async (cwd) => {
    await copyFile(join(overlayRoot, "package.json"), join(cwd, "package.json"));
    await copyFile(
      join(overlayRoot, "package-lock.json"),
      join(cwd, "package-lock.json"),
    );
    await mkdir(join(cwd, "node_modules"));
    await writeFile(join(cwd, "node_modules", "sentinel"), "keep");
    await ensureWorktreeDependencies(cwd);
    const sentinel = await stat(join(cwd, "node_modules", "sentinel"));
    assert.ok(sentinel.isFile());
    await assert.rejects(() => stat(join(cwd, "node_modules/@cursor/sdk")));
  });
});

test(
  "ensureWorktreeDependencies installs @cursor/sdk in a git worktree",
  { timeout: 120_000 },
  async () => {
    await withTempDir(async (parent) => {
      const repo = join(parent, "repo");
      const worktree = join(parent, "worktree");
      await mkdir(repo);
      await execFileAsync("git", ["init"], { cwd: repo, encoding: "utf8" });
      await execFileAsync("git", ["config", "user.email", "factory@example.test"], {
        cwd: repo,
        encoding: "utf8",
      });
      await execFileAsync("git", ["config", "user.name", "factory"], {
        cwd: repo,
        encoding: "utf8",
      });
      await copyFile(join(overlayRoot, "package.json"), join(repo, "package.json"));
      await copyFile(
        join(overlayRoot, "package-lock.json"),
        join(repo, "package-lock.json"),
      );
      await execFileAsync("git", ["add", "package.json", "package-lock.json"], {
        cwd: repo,
        encoding: "utf8",
      });
      await execFileAsync("git", ["commit", "-m", "lockfile"], {
        cwd: repo,
        encoding: "utf8",
      });
      await execFileAsync("git", ["worktree", "add", worktree], {
        cwd: repo,
        encoding: "utf8",
      });
      await assert.rejects(() => stat(join(worktree, "node_modules/@cursor/sdk")));
      await ensureWorktreeDependencies(worktree);
      const sdk = await stat(join(worktree, "node_modules/@cursor/sdk"));
      assert.ok(sdk.isDirectory());
    });
  },
);
