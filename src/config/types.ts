export interface ObservatoryConfig {

    version: number;

    provider: string;

    browser: {

        debugPort: number;

    };

    run: {

        promptFile: string;

        repeats: number;

        maxPrompts: number | null;

        shuffle: boolean;

        startIndex: number;

    };

    behavior: {

        openNewChatEachPrompt: boolean;

    };

    output: {

        runsDir: string;

    };

}