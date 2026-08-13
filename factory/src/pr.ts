import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CreatePr } from "./types.ts";

const execFileAsync = promisify(execFile);

export function createGhPr(): CreatePr {
  return async ({ repoRoot, branch, title, body }) => {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "pr",
        "create",
        "--draft",
        "--head",
        branch,
        "--title",
        title,
        "--body",
        body,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const url = stdout.trim();
    if (url === "") {
      throw new Error("gh pr create returned no URL");
    }
    return url;
  };
}
