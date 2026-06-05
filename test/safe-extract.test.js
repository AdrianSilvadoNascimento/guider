import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeEntries } from "../lib/skills/safe-extract.js";

test("accepts entries that stay inside the target dir", () => {
  const top = assertSafeEntries(
    ["guider/SKILL.md", "guider/references/a.md"],
    "/tmp/skills",
  );
  assert.deepEqual([...top], ["guider"]);
});

test("refuses a zip-slip entry that escapes via ../", () => {
  assert.throws(
    () => assertSafeEntries(["../../../../tmp/PWNED.txt"], "/tmp/skills"),
    /Refusing to extract unsafe path/,
  );
});

test("refuses an absolute-path entry", () => {
  assert.throws(
    () => assertSafeEntries(["/etc/passwd"], "/tmp/skills"),
    /Refusing to extract unsafe path/,
  );
});

test("reports multiple top-level folders", () => {
  const top = assertSafeEntries(["a/x.md", "b/y.md"], "/tmp/skills");
  assert.deepEqual([...top].sort(), ["a", "b"]);
});
