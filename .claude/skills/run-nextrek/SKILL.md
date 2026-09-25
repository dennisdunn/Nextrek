---
name: run-nextrek
description: Build, run, and drive Subspace Wumpus (Nextrek) - a Vite/React browser game. Use when asked to start the dev server, run its tests, build it, take a screenshot of the game, or interact with the running app (start screen, hunt phase, combat).
---

This is a Vite + React + TypeScript single-page app with no backend - drive
it by starting the Vite dev server, then running the headless-Chromium
driver at `.claude/skills/run-nextrek/driver.mjs`. All paths below are
relative to the repo root.

## Prerequisites

Nothing beyond what a normal Node checkout needs - no OS packages were
required in this container. Node 22 and a Chromium binary are already
present in this environment: Playwright is installed globally (not as a
project dependency) at `/opt/node22/lib/node_modules/playwright`, and its
Chromium build lives at `/opt/pw-browsers/chromium`. See Gotchas if either
path doesn't exist in your environment.

## Setup

```bash
npm ci
```

## Build

```bash
npm run build   # tsc -b && vite build -> dist/
```

Not needed to run the driver below - the dev server serves source directly.

## Run (agent path)

Start the dev server, wait for it to actually serve, then run the driver:

```bash
npm run dev -- --port 5193 > /tmp/vite-dev.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:5193 >/dev/null; do sleep 1; done'
node .claude/skills/run-nextrek/driver.mjs
```

Stop the server when done: `lsof -ti:5193 -sTCP:LISTEN | xargs -r kill`
(npm doesn't forward SIGTERM to the vite process it spawns, so killing the
port's listener is what actually frees it for the next run).

The driver:
1. Launches headless Chromium and navigates to the app.
2. Screenshots the start screen (difficulty picker).
3. Clicks "Normal", waits for the hunt-phase HUD, screenshots it.
4. Reads back reserve power / hostile quota from the DOM and logs them
   against the expected Normal-difficulty values (1000 / 15).
5. Counts rendered `<path class="sector">` elements in the Sciences map's
   SVG, as a render sanity check.
6. Reports any browser console errors and exits non-zero if there were any.

Screenshots land in `.claude/skills/run-nextrek/screenshots/`
(`01-start-screen.png`, `02-hunt-phase.png`).

`node .claude/skills/run-nextrek/driver.mjs [outDir] [port]` - both args
optional, defaulting to the screenshots dir above and port 5193.

## Run (human path)

```bash
npm run dev   # -> http://localhost:5173/, Ctrl-C to stop
```

Opens a normal dev server; open the URL in a real browser. Useless
headless - use the driver above instead.

## Test

```bash
npm run test:run
```

212 tests across 21 files pass in ~8s. A separate, much slower (~90s)
Monte Carlo balance simulator lives at `src/__balanceSim.test.ts` but is
excluded from this by `vite.config.ts` - run it on purpose with
`npm run sim:balance` if you're specifically retuning difficulty presets,
not as part of routine verification.

## Gotchas

- **No `playwright` devDependency in this project.** The driver imports it
  from this container's global install
  (`/opt/node22/lib/node_modules/playwright/index.mjs`). If that path
  doesn't exist in your environment, `npm install --no-save playwright`
  and change the driver's import to the bare specifier `'playwright'`
  instead, then `npx playwright install chromium`.
- **`chromium-cli` is not installed in this container** - confirmed via
  `which chromium-cli` (not found), which is why this skill ships a
  hand-rolled Playwright driver instead of the usual `chromium-cli`
  one-liner. If a future environment has `chromium-cli`, prefer it; the
  driver here still works either way.
- **The project is ESM** (`"type": "module"` in `package.json`), so the
  driver is `.mjs` and uses `import`, not `require` - a `require()`-based
  script placed inside this tree will throw `ERR_REQUIRE_ESM`.
- **Vite's default port (5173) can collide with another running instance.**
  The driver and the commands above use `--port 5193` and kill that port's
  listener before relaunching, rather than `pkill -f vite` (too broad -
  can kill unrelated processes sharing the pattern).
- **`sector--reachable` elements only exist right after a scan or at
  mission start** - the driver doesn't click into the map because reachable
  sectors are seeded randomly each run and aren't guaranteed hostile-free;
  it only verifies the Sciences map itself rendered (`path.sector` count).
  See `src/__balanceSim.test.ts`'s bot-player logic if you need to script
  actual movement/combat deterministically.

## Troubleshooting

- **`ERR_REQUIRE_ESM` or `Cannot use import statement outside a module`**:
  you're mixing `require`/`import` incorrectly given `"type": "module"` -
  use `.mjs` and `import` throughout, as `driver.mjs` does.
- **Driver hangs on `page.goto`**: the dev server isn't actually up yet -
  the `timeout 30 bash -c 'until curl -sf ...'` polling loop above is
  there specifically because a raw `sleep` isn't reliably long enough for
  Vite's first compile.
- **`browserType.launch: Executable doesn't exist`**: the hardcoded
  `executablePath: '/opt/pw-browsers/chromium'` in `driver.mjs` doesn't
  exist in your environment - remove that option from the `chromium.launch()`
  call to let Playwright fall back to its own managed browser (after
  `npx playwright install chromium`).
