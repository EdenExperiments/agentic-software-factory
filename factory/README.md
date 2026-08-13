# Factory

Nested SDK tree is the kickoff default. It is not implemented until the dispatcher exists. Ordinary agents must not treat this document as a live procedure.

This directory holds the job-contract schema for a later dispatcher. There is no runner here.

## Kickoff (later)

You kick a factory run from a CLI, a file under `factory/`, or a GitHub Issue you label `factory:ready` after you accept a saved Plan Mode plan under `.cursor/plans/`. Until the dispatcher exists, those entry points do nothing on their own.

The plan file on disk is the prompt. Intended shape, not code:

- Epic, small app, or migration. You decide when to kick this, not the always-on overlay.
- SDK root may split into a nested tree. Depth cap 2 below root, never more than 3.
- One writer per branch or worktree. Parents verify, resolve merge conflicts, and pass up.
- Leaves use pstack (`/poteto-mode`, `/tdd` when cheap, `/arena` plus judges when the shape is uncertain). Do not reimplement that router here.
- Draft PR. Bugbot. Remediate with cursor-team-kit (`get-pr-comments`, `loop-on-ci`). You merge.

## Contract

See [job-contract.schema.json](job-contract.schema.json): `planPath`, `acceptanceCriteria`, `targetPaths`, `verificationCommand`.
