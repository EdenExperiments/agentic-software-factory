import { parseJobContract } from "./contract.ts";
import type { FactoryJob } from "./types.ts";

const ISSUE_FIELDS = {
  "Plan path": { key: "planPath", kind: "scalar" },
  "Acceptance criteria": { key: "acceptanceCriteria", kind: "list" },
  "Target paths": { key: "targetPaths", kind: "list" },
  "Verification command": { key: "verificationCommand", kind: "scalar" },
} as const;

type IssueLabel = keyof typeof ISSUE_FIELDS;

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HEADING = /^###\s+(.+?)\s*$/;
const LIST_MARK = /^(?:[-*+]|\d+\.)\s+/;
const GITHUB_EMPTY_FIELD = "_No response_";

function isIssueLabel(label: string): label is IssueLabel {
  return Object.hasOwn(ISSUE_FIELDS, label);
}

function fieldLines(sectionLines: string[]): string[] {
  const lines: string[] = [];
  for (const raw of sectionLines) {
    const line = raw.replace(LIST_MARK, "").trim();
    if (line !== "" && line !== GITHUB_EMPTY_FIELD) {
      lines.push(line);
    }
  }
  return lines;
}

function jobFieldsFromIssueBody(body: string): Record<string, unknown> {
  const sections = new Map<IssueLabel, string[]>();
  let current: IssueLabel | undefined;
  for (const line of body.replace(HTML_COMMENT, "").split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const label = heading[1];
      if (label !== undefined && isIssueLabel(label) && !sections.has(label)) {
        current = label;
        sections.set(label, []);
      } else {
        current = undefined;
      }
      continue;
    }
    if (current === undefined) {
      continue;
    }
    const existing = sections.get(current);
    if (existing !== undefined) {
      existing.push(line);
    }
  }

  const record: Record<string, unknown> = {};
  for (const label of Object.keys(ISSUE_FIELDS)) {
    if (!isIssueLabel(label)) {
      continue;
    }
    const spec = ISSUE_FIELDS[label];
    const lines = fieldLines(sections.get(label) ?? []);
    switch (spec.kind) {
      case "scalar":
        record[spec.key] = lines[0] ?? "";
        break;
      case "list":
        record[spec.key] = lines;
        break;
      default: {
        const _exhaustive: never = spec;
        throw new Error(`unhandled issue field: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  return record;
}

export function parseIssueJobContract(body: string): FactoryJob {
  return parseJobContract(jobFieldsFromIssueBody(body));
}
