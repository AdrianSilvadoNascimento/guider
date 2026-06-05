import path from "path";

// Guard against zip-slip: throw if any archive entry would resolve outside
// destRoot. Returns the set of top-level folder names in the archive so the
// caller can derive the real skill folder instead of trusting the CLI arg.
export function assertSafeEntries(entryNames, destRoot) {
  const root = path.resolve(destRoot);
  const topLevel = new Set();

  for (const name of entryNames) {
    const dest = path.resolve(root, name);
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      throw new Error(`Refusing to extract unsafe path "${name}" — it escapes ${destRoot}.`);
    }
    const top = name.split("/")[0];
    if (top && top !== "..") topLevel.add(top);
  }

  return topLevel;
}
