# AI Observatory Browser Runner

A small human-in-the-loop Playwright prototype for weekly browser-based prompt testing.

## What it does

- Loads prompts from a JSON file
- Reads run behavior from YAML config
- Connects to an already-open Chrome session through remote debugging
- Sends one prompt at a time in ChatGPT
- Saves one run manifest, one prompt snapshot, one state file, and one flat response file per prompt repeat

## Install

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npm run run
```

Optional config profiles:

```bash
npm run quick
npm run weekly
```

Or explicitly:

```bash
npm run run -- --config=config/weekly.yaml
```

## Output

Each run gets its own folder:

```text
runs/<runId>/
  run.json
  prompts.json
  state.json
  responses/
    prompt-001/
      001-test-001.json
      001-test-002.json
      001-test-003.json
    prompt-002/
      002-test-001.json
      002-test-002.json
      002-test-003.json
```
