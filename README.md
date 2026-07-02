# AI Observatory Browser Runner

A small human-in-the-loop Playwright prototype for weekly browser-based prompt testing.

## What it does

- Loads prompts from a JSON file
- Shuffles the order each run
- Connects to an already-open Chrome session through remote debugging
- Sends one prompt at a time in ChatGPT
- Saves raw responses as JSON
- Records run state so you can resume after a failure

## Recommended browser setup

Use a dedicated Chrome profile launched with remote debugging:

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\AIObservatory\ChromeProfile"
```

Then log into ChatGPT manually in that browser window and keep it open.

## Install

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npm run run -- --prompts prompts/example.json
```

Optional flags:

- `--run-id=2026-07-02T120000Z`
- `--debug-port=9222`
- `--max-prompts=50`
- `--start-index=0`

## Output

Each run gets its own folder:

```text
runs/<runId>/
  state.json
  chatgpt/
    001-test-001.json
    002-test-003.json
```
