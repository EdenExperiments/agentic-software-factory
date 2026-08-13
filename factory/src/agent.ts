import { Agent, CursorAgentError } from "@cursor/sdk";
import {
  isJsonObject,
  parseNonEmptyString,
  parseNonEmptyStringList,
} from "./contract.ts";
import { log } from "./log.ts";
import type {
  AgentOutcome,
  NonEmptyList,
  RunAgent,
  SplitChild,
} from "./types.ts";

const DEFAULT_MODEL = "cursor-grok-4.6-high-fast";

function parseSplitChildren(input: unknown): NonEmptyList<SplitChild> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("factory_split children must be a non-empty array");
  }
  const children = input.map((item, index) => {
    if (!isJsonObject(item)) {
      throw new Error(`factory_split children[${index}] must be an object`);
    }
    return {
      id: parseNonEmptyString(item.id, `children[${index}].id`),
      title: parseNonEmptyString(item.title, `children[${index}].title`),
      targetPaths: parseNonEmptyStringList(
        item.targetPaths,
        `children[${index}].targetPaths`,
      ),
      acceptanceCriteria: parseNonEmptyStringList(
        item.acceptanceCriteria,
        `children[${index}].acceptanceCriteria`,
      ),
    };
  });
  const first = children[0];
  if (first === undefined) {
    throw new Error("factory_split children must be a non-empty array");
  }
  const ids = new Set<string>();
  for (const child of children) {
    if (ids.has(child.id)) {
      throw new Error(`factory_split duplicate child id: ${child.id}`);
    }
    ids.add(child.id);
  }
  return [first, ...children.slice(1)];
}

export function createLocalRunAgent(input: {
  apiKey: string;
  modelId?: string;
}): RunAgent {
  const modelId = input.modelId ?? DEFAULT_MODEL;
  return async ({ cwd, prompt, allowSplit }) => {
    let split: NonEmptyList<SplitChild> | undefined;
    await using agent = await Agent.create({
      apiKey: input.apiKey,
      model: { id: modelId },
      local: {
        cwd,
        settingSources: ["project", "user", "plugins"],
        customTools: {
          factory_split: {
            description: allowSplit
              ? "Propose child jobs instead of writing this node yourself. Call at most once. After this, stop editing files."
              : "Disabled at this depth. Implement the work yourself.",
            inputSchema: {
              type: "object",
              properties: {
                children: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      targetPaths: {
                        type: "array",
                        items: { type: "string" },
                      },
                      acceptanceCriteria: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: [
                      "id",
                      "title",
                      "targetPaths",
                      "acceptanceCriteria",
                    ],
                  },
                },
              },
              required: ["children"],
            },
            execute: (args) => {
              if (!allowSplit) {
                return {
                  content: [
                    {
                      type: "text",
                      text: "Depth cap: implement this node yourself. Do not split.",
                    },
                  ],
                  isError: true,
                };
              }
              if (split !== undefined) {
                return {
                  content: [
                    {
                      type: "text",
                      text: "factory_split already used on this node.",
                    },
                  ],
                  isError: true,
                };
              }
              try {
                split = parseSplitChildren(args.children);
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                  content: [{ type: "text", text: message }],
                  isError: true,
                };
              }
              return "Split accepted. Stop writing. Children will take the listed paths.";
            },
          },
        },
      },
    });
    try {
      const run = await agent.send(prompt);
      log({
        event: "run_started",
        agentId: agent.agentId,
        runId: run.id,
        cwd,
      });
      const result = await run.wait();
      switch (result.status) {
        case "finished":
          if (split !== undefined) {
            return { kind: "split", children: split };
          }
          return { kind: "implement" };
        case "error":
          return {
            kind: "error",
            message: `run ${result.id} failed after executing`,
            retryable: false,
          };
        case "cancelled":
          return {
            kind: "error",
            message: `run ${result.id} cancelled`,
            retryable: false,
          };
        default: {
          const _exhaustive: never = result.status;
          return {
            kind: "error",
            message: `unexpected status ${_exhaustive}`,
            retryable: false,
          };
        }
      }
    } catch (err) {
      if (err instanceof CursorAgentError) {
        return {
          kind: "error",
          message: err.message,
          retryable: err.isRetryable,
        };
      }
      throw err;
    }
  };
}
