import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const installCopy =
  "mkdir -p $HOME/.cursor/rules && cp .cursor/rules/pstack-models.mdc $HOME/.cursor/rules/pstack-models.mdc";

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "expected YAML frontmatter");
  return match[1];
}

test("environment.json copies pstack-models to $HOME/.cursor/rules", () => {
  const env = JSON.parse(read(".cursor/environment.json"));
  assert.equal(env.install, installCopy);
});

test("pstack-models.mdc is alwaysApply", () => {
  const matter = frontmatter(read(".cursor/rules/pstack-models.mdc"));
  assert.match(matter, /^alwaysApply:\s*true\s*$/m);
});

test("security-baseline.mdc is alwaysApply", () => {
  const matter = frontmatter(read(".cursor/rules/security-baseline.mdc"));
  assert.match(matter, /^alwaysApply:\s*true\s*$/m);
});
