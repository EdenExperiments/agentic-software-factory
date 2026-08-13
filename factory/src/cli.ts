import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createLocalRunAgent } from "./agent.ts";
import { isJsonObject, loadJobContract } from "./contract.ts";
import { createGitOps, createVerifyOps } from "./git.ts";
import { parseIssueJobContract } from "./issue.ts";
import { log } from "./log.ts";
import { createGhPr } from "./pr.ts";
import { kick } from "./tree.ts";
import type { FactoryJob } from "./types.ts";

const execFileAsync = promisify(execFile);

type KickSource =
  | { kind: "contract"; path: string }
  | { kind: "issue"; number: string };

type CliArgs = {
  kind: "kick";
  source: KickSource;
  repoRoot: string;
};

function printUsage(): void {
  process.stderr.write(`Usage:
  node factory/src/cli.ts kick --contract <job.json> [--repo-root <dir>]
  node factory/src/cli.ts kick --issue <n> [--repo-root <dir>]

Requires CURSOR_API_KEY. Optional FACTORY_MODEL (pstack slugs are mapped to SDK ids; default grok-4.6).
A GitHub Issue labelled factory:ready does not start a run.
`);
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv;
  if (command !== "kick") {
    printUsage();
    throw new Error("expected kick");
  }
  let contractPath: string | undefined;
  let issueNumber: string | undefined;
  let repoRoot = process.cwd();
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (flag === "--contract" && value !== undefined) {
      contractPath = value;
      i += 1;
      continue;
    }
    if (flag === "--issue" && value !== undefined) {
      issueNumber = value;
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
  if (contractPath !== undefined && issueNumber !== undefined) {
    printUsage();
    throw new Error("--issue and --contract are mutually exclusive");
  }
  if (contractPath !== undefined) {
    return {
      kind: "kick",
      source: { kind: "contract", path: contractPath },
      repoRoot,
    };
  }
  if (issueNumber !== undefined) {
    if (!/^[1-9]\d*$/.test(issueNumber)) {
      throw new Error("--issue must be a positive integer");
    }
    return {
      kind: "kick",
      source: { kind: "issue", number: issueNumber },
      repoRoot,
    };
  }
  printUsage();
  throw new Error("missing --contract or --issue");
}

async function readIssueBody(input: {
  repoRoot: string;
  number: string;
}): Promise<string> {
  const { stdout } = await execFileAsync(
    "gh",
    ["issue", "view", input.number, "--json", "title,body,labels"],
    { cwd: input.repoRoot, encoding: "utf8" },
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`gh issue view did not return JSON for issue ${input.number}`);
  }
  if (!isJsonObject(parsed) || typeof parsed.body !== "string") {
    throw new Error(`issue ${input.number} has no body`);
  }
  return parsed.body;
}

async function loadKickJob(args: CliArgs, repoRoot: string): Promise<FactoryJob> {
  switch (args.source.kind) {
    case "contract":
      return loadJobContract(resolve(args.source.path));
    case "issue":
      return parseIssueJobContract(
        await readIssueBody({ repoRoot, number: args.source.number }),
      );
    default: {
      const _exhaustive: never = args.source;
      throw new Error(`unhandled kick source: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args.repoRoot);
  const job = await loadKickJob(args, repoRoot);
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
