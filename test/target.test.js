import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GLOBAL_SKILLS_DIR,
  projectSkillsDir,
  resolveSkillsDir,
  promptSkillsDir,
} from "../lib/utils.js";

test("resolveSkillsDir prefers --dir, then --project, then global", () => {
  assert.equal(resolveSkillsDir({ dir: "/x" }), "/x");
  assert.equal(resolveSkillsDir({ project: true }), projectSkillsDir());
  assert.equal(resolveSkillsDir({}), GLOBAL_SKILLS_DIR);
});

test("promptSkillsDir honours explicit flags without prompting", async () => {
  assert.equal(await promptSkillsDir({ dir: "/x" }), "/x");
  assert.equal(await promptSkillsDir({ global: true }), GLOBAL_SKILLS_DIR);
  assert.equal(await promptSkillsDir({ project: true }), projectSkillsDir());
});

test("promptSkillsDir falls back to global when not a TTY", async () => {
  // The test runner's stdin is not a TTY, so this must not block.
  assert.equal(await promptSkillsDir({}), GLOBAL_SKILLS_DIR);
});
