// name → GitHub repo that publishes the skill as a release asset.
export const REGISTRY = {
  guider: { repo: "docsales/guider", asset: "guider.skill" },
};

// Build the download URL for a skill, optionally pinned to a release tag.
// A direct --url always wins; otherwise we template the GitHub release URL.
export function resolve(name, { url, tag } = {}) {
  if (url) return url;

  const entry = REGISTRY[name];
  if (!entry) {
    throw new Error(`Unknown skill "${name}". Pass --url to install from a direct link.`);
  }

  const ref = tag ? `download/${tag}` : "latest/download";
  return `https://github.com/${entry.repo}/releases/${ref}/${entry.asset}`;
}
