export type NonEmptyString = string & { readonly __brand: "NonEmptyString" };

export type NonEmptyList<T> = [T, ...T[]];

export type FactoryJob = {
  planPath: NonEmptyString;
  acceptanceCriteria: NonEmptyList<NonEmptyString>;
  targetPaths: NonEmptyList<NonEmptyString>;
  verificationCommand: NonEmptyString;
};

export type SplitChild = {
  id: NonEmptyString;
  title: NonEmptyString;
  targetPaths: NonEmptyList<NonEmptyString>;
  acceptanceCriteria: NonEmptyList<NonEmptyString>;
};

export type AgentOutcome =
  | { kind: "implement" }
  | { kind: "split"; children: NonEmptyList<SplitChild> }
  | { kind: "error"; message: string; retryable: boolean };

export type DepthBelowRoot = 0 | 1 | 2;

export type NodeSlice = {
  id: NonEmptyString;
  title: NonEmptyString;
  targetPaths: NonEmptyList<NonEmptyString>;
  acceptanceCriteria: NonEmptyList<NonEmptyString>;
};

export type RunAgent = (input: {
  cwd: string;
  prompt: string;
  allowSplit: boolean;
}) => Promise<AgentOutcome>;

export type GitOps = {
  createWorktree: (input: {
    repoRoot: string;
    worktreePath: string;
    branch: string;
    startPoint: string;
  }) => Promise<void>;
  mergeBranch: (input: {
    cwd: string;
    fromBranch: string;
  }) => Promise<{ kind: "clean" } | { kind: "conflicts" }>;
  head: (cwd: string) => Promise<string>;
  currentBranch: (cwd: string) => Promise<string>;
  commitIfDirty: (input: { cwd: string; message: string }) => Promise<boolean>;
  push: (input: { repoRoot: string; branch: string }) => Promise<void>;
};

export type VerifyOps = {
  run: (input: { cwd: string; command: string }) => Promise<
    { kind: "ok" } | { kind: "failed"; output: string }
  >;
};

export type CreatePr = (input: {
  repoRoot: string;
  branch: string;
  title: string;
  body: string;
}) => Promise<string>;
