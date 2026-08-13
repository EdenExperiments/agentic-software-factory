import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canSplit, childDepth } from "./depth.ts";
import { ensureWorktreeDependencies } from "./install.ts";
import { log } from "./log.ts";
import {
  childPrompt,
  conflictPrompt,
  rootPrompt,
  verifyFixPrompt,
} from "./prompts.ts";
import type {
  CreatePr,
  FactoryJob,
  GitOps,
  NodeSlice,
  RunAgent,
  VerifyOps,
} from "./types.ts";
import { parseNonEmptyString } from "./contract.ts";

export type KickResult = {
  prUrl: string;
  branch: string;
};

function planSlug(planPath: string): string {
  const normalized = planPath.replaceAll("\\", "/");
  const base = normalized.split("/").pop() ?? "job";
  const withoutExt = base.replace(/\.plan\.md$/i, "").replace(/\.md$/i, "");
  const cleaned = withoutExt.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(
    /^-+|-+$/g,
    "",
  );
  return cleaned === "" ? "job" : cleaned.slice(0, 40);
}

function branchSegment(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (cleaned === "") {
    throw new Error(`child id is not a usable branch segment: ${id}`);
  }
  return cleaned;
}

function worktreePath(repoRoot: string, branch: string): string {
  return join(repoRoot, ".factory-worktrees", branch.replaceAll("/", "-"));
}

async function verifyOrFix(input: {
  cwd: string;
  job: FactoryJob;
  runAgent: RunAgent;
  git: GitOps;
  verify: VerifyOps;
  title: string;
}): Promise<void> {
  const first = await input.verify.run({
    cwd: input.cwd,
    command: input.job.verificationCommand,
  });
  if (first.kind === "ok") {
    return;
  }
  log({ event: "verify_failed", cwd: input.cwd, output: first.output });
  const fix = await input.runAgent({
    cwd: input.cwd,
    prompt: verifyFixPrompt(first.output),
    allowSplit: false,
  });
  if (fix.kind === "error") {
    throw new Error(fix.message);
  }
  await input.git.commitIfDirty({
    cwd: input.cwd,
    message: `factory: fix verification for ${input.title}`,
  });
  const second = await input.verify.run({
    cwd: input.cwd,
    command: input.job.verificationCommand,
  });
  if (second.kind === "failed") {
    throw new Error(`verification still failing:\n${second.output}`);
  }
}

export async function kick(input: {
  repoRoot: string;
  job: FactoryJob;
  planText: string;
  runAgent: RunAgent;
  git: GitOps;
  verify: VerifyOps;
  createPr: CreatePr;
}): Promise<KickResult> {
  const repoRoot = resolve(input.repoRoot);
  const slug = planSlug(input.job.planPath);
  const rootBranch = `factory/${slug}`;
  const rootCwd = worktreePath(repoRoot, rootBranch);
  await mkdir(join(repoRoot, ".factory-worktrees"), { recursive: true });
  const startPoint = await input.git.head(repoRoot);
  await input.git.createWorktree({
    repoRoot,
    worktreePath: rootCwd,
    branch: rootBranch,
    startPoint,
  });
  await ensureWorktreeDependencies(rootCwd);
  const rootSlice: NodeSlice = {
    id: parseNonEmptyString("root", "id"),
    title: parseNonEmptyString(slug, "title"),
    targetPaths: input.job.targetPaths,
    acceptanceCriteria: input.job.acceptanceCriteria,
  };
  await runNode({
    repoRoot,
    job: input.job,
    planText: input.planText,
    slice: rootSlice,
    cwd: rootCwd,
    branch: rootBranch,
    depth: 0,
    runAgent: input.runAgent,
    git: input.git,
    verify: input.verify,
  });
  await input.git.push({ repoRoot, branch: rootBranch });
  const prUrl = await input.createPr({
    repoRoot,
    branch: rootBranch,
    title: `factory: ${slug}`,
    body: `Factory run for \`${input.job.planPath}\`.\n\nVerification: \`${input.job.verificationCommand}\`\n`,
  });
  log({ event: "pr_opened", prUrl, branch: rootBranch });
  return { prUrl, branch: rootBranch };
}

async function runNode(input: {
  repoRoot: string;
  job: FactoryJob;
  planText: string;
  slice: NodeSlice;
  cwd: string;
  branch: string;
  depth: 0 | 1 | 2;
  runAgent: RunAgent;
  git: GitOps;
  verify: VerifyOps;
}): Promise<void> {
  const allowSplit = canSplit(input.depth);
  const prompt =
    input.depth === 0
      ? rootPrompt({
          job: input.job,
          planText: input.planText,
          allowSplit,
        })
      : childPrompt({
          job: input.job,
          planText: input.planText,
          slice: input.slice,
          allowSplit,
        });
  log({
    event: "node_start",
    branch: input.branch,
    depth: input.depth,
    cwd: input.cwd,
  });
  const outcome = await input.runAgent({
    cwd: input.cwd,
    prompt,
    allowSplit,
  });
  switch (outcome.kind) {
    case "error": {
      log({
        event: "node_run_error",
        branch: input.branch,
        message: outcome.message,
        retryable: outcome.retryable,
      });
      const committed = await input.git.commitIfDirty({
        cwd: input.cwd,
        message: `factory: ${input.slice.title} after run error`,
      });
      if (!committed) {
        throw new Error(outcome.message);
      }
      await verifyOrFix({
        cwd: input.cwd,
        job: input.job,
        runAgent: input.runAgent,
        git: input.git,
        verify: input.verify,
        title: input.slice.title,
      });
      return;
    }
    case "implement":
      await input.git.commitIfDirty({
        cwd: input.cwd,
        message: `factory: ${input.slice.title}`,
      });
      await verifyOrFix({
        cwd: input.cwd,
        job: input.job,
        runAgent: input.runAgent,
        git: input.git,
        verify: input.verify,
        title: input.slice.title,
      });
      return;
    case "split": {
      if (!canSplit(input.depth)) {
        throw new Error("agent split past depth cap");
      }
      await input.git.commitIfDirty({
        cwd: input.cwd,
        message: `factory: ${input.slice.title} split point`,
      });
      const startPoint = await input.git.head(input.cwd);
      const nextDepth = childDepth(input.depth);
      const childBranches = await Promise.all(
        outcome.children.map(async (child) => {
          const childBranch = `${input.branch}@${branchSegment(child.id)}`;
          const childCwd = worktreePath(input.repoRoot, childBranch);
          await input.git.createWorktree({
            repoRoot: input.repoRoot,
            worktreePath: childCwd,
            branch: childBranch,
            startPoint,
          });
          await ensureWorktreeDependencies(childCwd);
          await runNode({
            repoRoot: input.repoRoot,
            job: input.job,
            planText: input.planText,
            slice: child,
            cwd: childCwd,
            branch: childBranch,
            depth: nextDepth,
            runAgent: input.runAgent,
            git: input.git,
            verify: input.verify,
          });
          return childBranch;
        }),
      );
      for (const childBranch of childBranches) {
        const merged = await input.git.mergeBranch({
          cwd: input.cwd,
          fromBranch: childBranch,
        });
        if (merged.kind === "conflicts") {
          const resolved = await input.runAgent({
            cwd: input.cwd,
            prompt: conflictPrompt(),
            allowSplit: false,
          });
          if (resolved.kind === "error") {
            throw new Error(resolved.message);
          }
          await input.git.commitIfDirty({
            cwd: input.cwd,
            message: `factory: resolve conflicts from ${childBranch}`,
          });
        }
      }
      await verifyOrFix({
        cwd: input.cwd,
        job: input.job,
        runAgent: input.runAgent,
        git: input.git,
        verify: input.verify,
        title: input.slice.title,
      });
      return;
    }
    default: {
      const _exhaustive: never = outcome;
      throw new Error(`unexpected outcome ${_exhaustive}`);
    }
  }
}
