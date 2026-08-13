import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type WorktreeInstallDecision =
  | { kind: "skip-no-lockfile" }
  | { kind: "skip-installed" }
  | { kind: "ci" };

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureWorktreeDependencies(cwd: string): Promise<void> {
  let decision: WorktreeInstallDecision;
  if (!(await pathExists(join(cwd, "package-lock.json")))) {
    decision = { kind: "skip-no-lockfile" };
  } else if (await pathExists(join(cwd, "node_modules"))) {
    decision = { kind: "skip-installed" };
  } else {
    decision = { kind: "ci" };
  }
  switch (decision.kind) {
    case "skip-no-lockfile":
    case "skip-installed":
      return;
    case "ci":
      await execFileAsync("npm", ["ci"], { cwd, encoding: "utf8" });
      return;
    default: {
      const _exhaustive: never = decision;
      throw new Error(`unexpected install decision ${_exhaustive}`);
    }
  }
}
