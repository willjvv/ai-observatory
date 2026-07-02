import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ObservatoryConfig } from "./types.js";

export function loadConfig(filePath = "config/default.yaml"): ObservatoryConfig {
  const absolutePath = path.resolve(filePath);

  try {
    const text = readFileSync(absolutePath, "utf8");
    return YAML.parse(text) as ObservatoryConfig;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`Config file not found:
${absolutePath}`);
    }
    throw err;
  }
}
