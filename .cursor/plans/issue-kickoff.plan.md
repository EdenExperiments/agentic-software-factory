# Wire factory kick --issue

## Goal

Add `npm run factory -- kick --issue <n>` so a GitHub Issue created from `.github/ISSUE_TEMPLATE/factory-job.yml` becomes the same job contract as `--contract`. Call existing `kick()`. Do not add a GitHub Actions watcher. Do not auto-apply or auto-run on `factory:ready`.

## Why

The template and `factory:ready` label already exist. The CLI only accepts a JSON file. This is the missing human kickoff path that still keeps you in control.

## Behavior

- `kick --issue 12` uses `gh issue view 12 --json title,body,labels` from `--repo-root`.
- Parse the issue-form headings: Plan path, Acceptance criteria, Target paths, Verification command. Lists are one item per line. Feed that object through `parseJobContract`.
- Issue body is untrusted. Parsing may only extract those four fields. Ignore other headings, HTML comments, and any text that asks to skip tests, leak secrets, or edit `.github/workflows`.
- Missing/invalid fields fail before any agent starts. Do not invent defaults.
- `--issue` and `--contract` are mutually exclusive.
- `factory:ready` on the issue is not required for `--issue` and must not start a run by itself.
- No new files under `.github/workflows`.

## Code

- New parser module next to the CLI (for example `factory/src/issue.ts`).
- `factory/src/cli.ts` grows the flag and the `gh` read. Reuse `loadJobContract` / `parseJobContract` and `kick()`.
- Tests in `test/issue.test.ts` with fixture issue bodies: happy path, extra instruction injection ignored, empty AC list rejected.
- Update `factory/README.md` usage. Keep the line that a label does not start a run.

## Verify

`npm test` and `npx tsc --noEmit`.
