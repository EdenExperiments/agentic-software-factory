import type { FactoryJob, NodeSlice } from "./types.ts";

export function rootPrompt(input: {
  job: FactoryJob;
  planText: string;
  allowSplit: boolean;
}): string {
  const split = input.allowSplit
    ? `You may call factory_split once if this work should be parallel writers. After a split, stop editing files. Children write. You will verify and merge later.
If the work is one writer, do not split. Implement it.`
    : `Do not split. Implement this node yourself.`;

  return `This is a factory leaf-or-root run. pstack routes how you work. Start with /poteto-mode. Use /tdd when a cheap test loop exists. Use /arena plus judges when the shape is uncertain. Do not invent a parallel router.

Plan file:
${input.planText}

Target paths:
${input.job.targetPaths.map((path) => `- ${path}`).join("\n")}

Acceptance criteria:
${input.job.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}

Verification command (the dispatcher will run this, not you, unless you need it while building):
${input.job.verificationCommand}

${split}

Do not weaken tests. Do not commit secrets. Humans merge the final PR.`;
}

export function childPrompt(input: {
  job: FactoryJob;
  planText: string;
  slice: NodeSlice;
  allowSplit: boolean;
}): string {
  const split = input.allowSplit
    ? `You may call factory_split once if this slice should be parallel writers. After a split, stop editing files.`
    : `Depth cap: implement this slice yourself. factory_split will error if you call it.`;

  return `This is a factory child node. pstack routes how you work. Start with /poteto-mode. Use /tdd when a cheap test loop exists. Use /arena plus judges when the shape is uncertain. Do not invent a parallel router.

You own only this slice. Do not edit paths another child owns.

Slice: ${input.slice.title} (${input.slice.id})

Slice target paths:
${input.slice.targetPaths.map((path) => `- ${path}`).join("\n")}

Slice acceptance criteria:
${input.slice.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}

Full plan (context only):
${input.planText}

Job verification command:
${input.job.verificationCommand}

${split}

Do not weaken tests. Do not commit secrets.`;
}

export function conflictPrompt(): string {
  return `Merge conflicts are in this worktree. Resolve them. Keep both sides' intended behavior where you can. Do not rewrite unrelated files. Do not weaken tests. When conflicts are gone, stop.`;
}

export function verifyFixPrompt(output: string): string {
  return `Verification failed. Fix the code so the command passes. Do not weaken, skip, or delete tests.

Command output:
${output}`;
}
