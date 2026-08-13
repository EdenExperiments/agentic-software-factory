# Factory

Nested SDK tree is the kickoff default. The dispatcher is a local CLI. Ordinary IDE agents still must not treat this as their always-on procedure. You kick it.

```
npm run factory -- kick --contract path/to/job.json [--repo-root <git-repo>]
```

Needs `CURSOR_API_KEY`. Optional `FACTORY_MODEL` (default `cursor-grok-4.6-high-fast`).

A GitHub Issue labelled `factory:ready` does not start a run yet.

## What it does

The plan file on disk is the prompt. The CLI spawns local `@cursor/sdk` agents, one writer per git worktree.

- Root may call `factory_split` and fan out. Depth cap 2 below root, never more than 3 in a chain.
- Parents merge, resolve conflicts, run `verificationCommand`, then pass up.
- Leaves use pstack (`/poteto-mode`, `/tdd` when cheap, `/arena` plus judges when the shape is uncertain). This repo does not reimplement that router.
- The dispatcher pushes the root branch and opens a draft PR. You merge.

Worktrees land in `.factory-worktrees/` (gitignored).

## Contract

See [job-contract.schema.json](job-contract.schema.json): `planPath`, `acceptanceCriteria`, `targetPaths`, `verificationCommand`.
