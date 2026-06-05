import os from "os";
import path from "path";

export function resolveSkillsDir(optDir) {
  return optDir ?? path.join(os.homedir(), ".claude", "skills", "user");
}
