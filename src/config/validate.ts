import fs from "fs";

import { ObservatoryConfig } from "./types";

export function validateConfig(
    config: ObservatoryConfig
) {

    if (!fs.existsSync(config.run.promptFile)) {

        throw new Error(
            `Prompt file does not exist:\n${config.run.promptFile}`
        );

    }

    if (config.run.repeats < 1) {

        throw new Error(
            "repeats must be at least 1"
        );

    }

    if (config.browser.debugPort < 1) {

        throw new Error(
            "Invalid browser debug port"
        );

    }

}