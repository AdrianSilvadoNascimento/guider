#!/usr/bin/env node
// PreToolUse hook — copied into the project by `/guider init` (references/agent-hooks.md).
// Blocks two things before they happen:
//   1. writing secret files (.env*, private keys) — they belong in a secret manager;
//   2. adding a package while the package manager has no release quarantine
//      configured (references/supply-chain.md).
// Anything it doesn't recognize is allowed.

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { editedPaths, failOpen, loadConfig, projectRoot, readInput, shellCommand, tellAgent } from "./_lib.mjs";

const SECRET_FILE = /^\.env(\..+)?$|\.(pem|key|p12|pfx)$|^id_(rsa|ed25519|ecdsa)$/;
const SECRET_OK = /^\.env\.(example|sample|template|defaults)$/;

// Flags whose next token is a value, not a package.
const VALUE_FLAGS = new Set([
  "--filter", "-F", "-C", "--dir", "--prefix", "--cwd", "-w", "--workspace", "--registry",
  "-r", "--requirement", "-c", "--constraint", "-e", "--editable", "-i", "--index-url",
  "--extra-index-url", "-t", "--target", "-p", "--python", "--group", "--optional", "--package",
]);

// True when `command` runs `<tool> [flags] <verb> [flags] <package>`. A bare
// `install` (from the lockfile), local paths and redirections don't count.
function addsPackage(command, tools, verbs) {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      if (!tools.includes(tokens[i]) || (tokens[i].startsWith("pip") && tokens[i - 1] === "uv")) continue;
      let j = i + 1;
      while (j < tokens.length && tokens[j].startsWith("-")) j += VALUE_FLAGS.has(tokens[j]) ? 2 : 1;
      const verb = verbs.find((candidate) => candidate.split(" ").every((word, k) => tokens[j + k] === word));
      if (!verb) continue;
      for (j += verb.split(" ").length; j < tokens.length; j++) {
        const token = tokens[j];
        if (/^\d*[<>]/.test(token)) break; // redirection: the rest isn't arguments
        if (token.startsWith("-")) {
          if (VALUE_FLAGS.has(token)) j++;
          continue;
        }
        if (/^(\.|\/|~|file:|link:|workspace:)/.test(token)) continue; // local path
        return true;
      }
    }
  }
  return false;
}

// package manager → how to spot "adds a package", how to tell quarantine is configured
const MANAGERS = [
  {
    name: "pnpm",
    adds: (command) => addsPackage(command, ["pnpm"], ["add", "install", "i"]),
    configured: (root) => fileHas(root, "pnpm-workspace.yaml", /minimumReleaseAge\s*:/) || fileHas(root, ".npmrc", /minimum-release-age/),
    fix: "minimumReleaseAge: 10080 in pnpm-workspace.yaml",
  },
  {
    name: "npm",
    adds: (command) => addsPackage(command, ["npm"], ["install", "i", "add"]),
    configured: (root) => fileHas(root, ".npmrc", /^\s*(min-release-age|before)\s*=/m),
    fix: "min-release-age=7 in .npmrc",
  },
  {
    name: "yarn",
    adds: (command) => addsPackage(command, ["yarn"], ["add"]),
    configured: (root) => fileHas(root, ".yarnrc.yml", /npmMinimalAgeGate\s*:/),
    fix: 'npmMinimalAgeGate: "7d" in .yarnrc.yml',
  },
  {
    name: "bun",
    adds: (command) => addsPackage(command, ["bun"], ["add", "install", "i"]),
    configured: (root) => fileHas(root, "bunfig.toml", /minimumReleaseAge\s*=/),
    fix: "minimumReleaseAge = 604800 under [install] in bunfig.toml",
  },
  {
    name: "uv",
    adds: (command) => addsPackage(command, ["uv"], ["add", "pip install"]),
    configured: (root) => fileHas(root, "pyproject.toml", /exclude-newer\s*=/) || fileHas(root, "uv.toml", /exclude-newer\s*=/),
    fix: 'exclude-newer = "7 days" under [tool.uv] in pyproject.toml',
  },
  {
    name: "pip",
    adds: (command) => addsPackage(command, ["pip", "pip3"], ["install"]),
    configured: (_root, command) => /--uploaded-prior-to/.test(command) || Boolean(process.env.PIP_UPLOADED_PRIOR_TO),
    fix: "--uploaded-prior-to P7D (or PIP_UPLOADED_PRIOR_TO=P7D)",
  },
];

function fileHas(root, name, pattern) {
  const path = join(root, name);
  return existsSync(path) && pattern.test(readFileSync(path, "utf8"));
}

failOpen(async () => {
  const input = await readInput();
  const root = projectRoot(input);
  const config = loadConfig(root);

  if (config.secretFiles !== false) {
    const secret = editedPaths(input, root).find((path) => {
      const name = basename(path);
      return SECRET_FILE.test(name) && !SECRET_OK.test(name);
    });
    if (secret) {
      tellAgent(
        `Blocked by Guider: ${secret} holds secrets. Don't write it from the agent — ` +
        "ask the user to set the value in their secret manager or local env file.",
      );
    }
  }

  const command = shellCommand(input);
  if (command && config.quarantine !== false) {
    for (const manager of MANAGERS) {
      if (!manager.adds(command) || manager.configured(root, command)) continue;
      tellAgent(
        `Blocked by Guider: "${manager.name}" has no release quarantine configured, so this could ` +
        `install a version published minutes ago. Ask the user to add ${manager.fix} ` +
        "(references/supply-chain.md), or to approve a recorded bypass for an urgent security fix.",
      );
    }
  }
});
