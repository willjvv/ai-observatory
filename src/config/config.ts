import fs from "fs";
import path from "path";
import YAML from "yaml";

import { ObservatoryConfig } from "./types";

export function loadConfig(
    file = "config/default.yaml"
): ObservatoryConfig {

    const absolute = path.resolve(file);

    if (!fs.existsSync(absolute)) {

        throw new Error(
            `Config file not found:\n${absolute}`
        );

    }

    const text = fs.readFileSync(
        absolute,
        "utf8"
    );

    return YAML.parse(text) as ObservatoryConfig;

}