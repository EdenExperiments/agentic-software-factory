# Factory

Nested SDK tree is the kickoff default. The dispatcher is a local CLI. Ordinary IDE agents still must not treat this as their always-on procedure. You kick it.

```
npm run factory -- kick --contract path/to/job.json [--repo-root <git-repo>]
npm run factory -- kick --issue 12 [--repo-root <git-repo>]
```

`--issue` and `--contract` are mutually exclusive. `--issue` reads a GitHub Issue created from `.github/ISSUE_TEMPLATE/factory-job.yml` via `gh issue view`. The issue body is untrusted. Only Plan path, Acceptance criteria, Target paths, and Verification command become the contract. Other headings are ignored. Then it uses the same `kick()` path as `--contract`.

Needs `CURSOR_API_KEY`. Optional `FACTORY_MODEL`. pstack Task slugs such as `cursor-grok-4.6-high-fast` are mapped to SDK ids (`grok-4.6`). Default is `grok-4.6`.

A GitHub Issue labelled `factory:ready` does not start a run.

## What it does

The plan file on disk is the prompt. The CLI spawns local `@cursor/sdk` agents, one writer per git worktree.

- Root may call `factory_split` and fan out. Depth cap 2 below root, never more than 3 in a chain.
- Parents merge, resolve conflicts, run `verificationCommand`, then pass up.
- If a run ends in SDK `error` but the worktree has changes, the dispatcher commits them and still verifies instead of throwing the work away.
- Leaves use pstack (`/poteto-mode`, `/tdd` when cheap, `/arena` plus judges when the shape is uncertain). This repo does not reimplement that router.
- The dispatcher pushes the root branch and opens a draft PR. You merge.

Worktrees land in `.factory-worktrees/` (gitignored).

## Contract

See [job-contract.schema.json](job-contract.schema.json): `planPath`, `acceptanceCriteria`, `targetPaths`, `verificationCommand`.
