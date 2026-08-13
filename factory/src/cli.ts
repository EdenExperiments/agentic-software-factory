import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createLocalRunAgent } from "./agent.ts";
import { loadJobContract } from "./contract.ts";
import { createGitOps, createVerifyOps } from "./git.ts";
import { log } from "./log.ts";
import { createGhPr } from "./pr.ts";
import { kick } from "./tree.ts";

type CliArgs = {
  kind: "kick";
  contractPath: string;
  repoRoot: string;
};

function printUsage(): void {
  process.stderr.write(`Usage:
  node factory/src/cli.ts kick --contract <job.json> [--repo-root <dir>]

Requires CURSOR_API_KEY. Optional FACTORY_MODEL (default cursor-grok-4.6-high-fast).
GitHub Issue factory:ready kickoff is not wired yet.
`);
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv;
  if (command !== "kick") {
    printUsage();
    throw new Error("expected kick");
  }
  let contractPath: string | undefined;
  let repoRoot = process.cwd();
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (flag === "--contract" && value !== undefined) {
      contractPath = value;
      i += 1;
      continue;
    }
    if (flag === "--repo-root" && value !== undefined) {
      repoRoot = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${flag}`);
  }
  if (contractPath === undefined) {
    printUsage();
    throw new Error("missing --contract");
  }
  return { kind: "kick", contractPath, repoRoot };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args.repoRoot);
  const contractPath = resolve(args.contractPath);
  const job = loadJobContract(contractPath);
  const planPath = resolve(repoRoot, job.planPath);
  let planText: string;
  try {
    planText = readFileSync(planPath, "utf8");
  } catch {
    throw new Error(`plan file not found: ${planPath}`);
  }
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (apiKey === undefined || apiKey === "") {
    throw new Error("CURSOR_API_KEY is required");
  }
  const result = await kick({
    repoRoot,
    job,
    planText,
    runAgent: createLocalRunAgent({
      apiKey,
      modelId: process.env.FACTORY_MODEL?.trim(),
    }),
    git: createGitOps(),
    verify: createVerifyOps(),
    createPr: createGhPr(),
  });
  log({ event: "kick_done", ...result });
  process.stdout.write(`${result.prUrl}\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
