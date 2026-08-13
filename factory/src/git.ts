import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitOps, VerifyOps } from "./types.ts";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

async function git(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd, encoding: "utf8" });
}

export function createGitOps(): GitOps {
  return {
    async createWorktree({ repoRoot, worktreePath, branch, startPoint }) {
      await git(repoRoot, [
        "worktree",
        "add",
        "-b",
        branch,
        worktreePath,
        startPoint,
      ]);
    },
    async mergeBranch({ cwd, fromBranch }) {
      try {
        await git(cwd, ["merge", "--no-edit", fromBranch]);
        return { kind: "clean" };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("CONFLICT") || message.includes("conflict")) {
          return { kind: "conflicts" };
        }
        throw err;
      }
    },
    async head(cwd) {
      const { stdout } = await git(cwd, ["rev-parse", "HEAD"]);
      return stdout.trim();
    },
    async currentBranch(cwd) {
      const { stdout } = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      return stdout.trim();
    },
    async commitIfDirty({ cwd, message }) {
      await git(cwd, ["add", "-A"]);
      try {
        await git(cwd, ["diff", "--cached", "--quiet"]);
        return false;
      } catch {
        await git(cwd, ["commit", "-m", message]);
        return true;
      }
    },
    async push({ repoRoot, branch }) {
      await git(repoRoot, ["push", "-u", "origin", branch]);
    },
  };
}

export function createVerifyOps(): VerifyOps {
  return {
    async run({ cwd, command }) {
      try {
        await execAsync(command, { cwd, encoding: "utf8" });
        return { kind: "ok" };
      } catch (err) {
        const output =
          err instanceof Error
            ? `${err.message}${
                "stderr" in err && typeof err.stderr === "string"
                  ? `\n${err.stderr}`
                  : ""
              }`
            : String(err);
        return { kind: "failed", output };
      }
    },
  };
}
