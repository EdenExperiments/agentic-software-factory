import { readFileSync } from "node:fs";
import type { FactoryJob, NonEmptyList, NonEmptyString } from "./types.ts";

export function parseNonEmptyString(
  input: unknown,
  field: string,
): NonEmptyString {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return input.trim() as NonEmptyString;
}

export function parseNonEmptyStringList(
  input: unknown,
  field: string,
): NonEmptyList<NonEmptyString> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${field} must be a non-empty array of strings`);
  }
  const items = input.map((item, index) =>
    parseNonEmptyString(item, `${field}[${index}]`),
  );
  const first = items[0];
  if (first === undefined) {
    throw new Error(`${field} must be a non-empty array of strings`);
  }
  return [first, ...items.slice(1)];
}

export function isJsonObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

export function parseJobContract(input: unknown): FactoryJob {
  if (!isJsonObject(input)) {
    throw new Error("job contract must be an object");
  }
  const record = input;
  const extra = Object.keys(record).filter(
    (key) =>
      key !== "planPath" &&
      key !== "acceptanceCriteria" &&
      key !== "targetPaths" &&
      key !== "verificationCommand",
  );
  if (extra.length > 0) {
    throw new Error(`unknown job contract fields: ${extra.join(", ")}`);
  }
  return {
    planPath: parseNonEmptyString(record.planPath, "planPath"),
    acceptanceCriteria: parseNonEmptyStringList(
      record.acceptanceCriteria,
      "acceptanceCriteria",
    ),
    targetPaths: parseNonEmptyStringList(record.targetPaths, "targetPaths"),
    verificationCommand: parseNonEmptyString(
      record.verificationCommand,
      "verificationCommand",
    ),
  };
}

export function loadJobContract(path: string): FactoryJob {
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`job contract is not valid JSON: ${path}`);
  }
  return parseJobContract(parsed);
}
