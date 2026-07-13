// name → GitHub repo that publishes the skill as a release asset.
export const REGISTRY = {
  guider: { repo: "AdrianSilvadoNascimento/guider", asset: "guider.skill" },
};

// Describe how to fetch a skill. A direct --url wins; otherwise we return a
// GitHub descriptor so the downloader can use the API (works for private repos).
export function resolve(name, { url, tag } = {}) {
  if (url) return { kind: "url", url };

  const entry = REGISTRY[name];
  if (!entry) {
    throw new Error(`Unknown skill "${name}". Pass --url to install from a direct link.`);
  }

  return { kind: "github", repo: entry.repo, asset: entry.asset, tag };
}
