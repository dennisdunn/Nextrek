# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Subspace Wumpus ("Nextrek"): Hunt the Wumpus meets Asteroids, loosely based on 1971 BASIC *Star Trek*. A turn-based galaxy-exploration layer (the "hunt phase") drops into real-time top-down combat (the "kill phase") whenever the player moves into a sector holding hostiles. React 19 + TypeScript + Vite, bitECS for the combat simulation, Vitest for tests. Deployed to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).

## Commands

```bash
npm run dev        # dev server with HMR
npm run build      # tsc -b && vite build - typecheck + production build to dist/
npm run preview    # serve the production build locally
npm run test       # vitest in watch mode
npm run test:run   # vitest run once - what CI runs
npm run lint       # oxlint
```

Running a single test file or test: `npx vitest run src/hunt/useGalaxy.test.ts` or `npx vitest run -t "some test name"`.

**Typecheck gotcha:** the root `tsconfig.json` uses project references with `files: []`, so a bare `npx tsc --noEmit` silently checks nothing. Use `npx tsc --noEmit -p tsconfig.app.json` (app code only) or `npx tsc -b --force` (what `npm run build` actually runs, both `tsconfig.app.json` and `tsconfig.node.json`).

## Architecture

### The hunt/kill boundary is a hard rule, not a convention

`src/hunt/` (turn-based exploration) and `src/kill/` (real-time bitECS combat) are kept **completely independent** - neither imports from the other. `src/game/GameShell.tsx` is the *only* file that imports from both; it's the phase-transition layer that decides when a hunt-phase move triggers or ends a kill-phase encounter, and folds the outcome (hull damage, leftover shield/phaser energy, kills) back into hunt state.

Because of this, small pieces of logic that both phases need are deliberately **duplicated** rather than shared (e.g. `degradedCooldownMultiplier` in `kill/KillPhase.tsx` is a local copy of `hunt/subsystems.ts`'s `degradedCostMultiplier`). Don't "fix" this by adding a cross-boundary import.

The one deliberate exception is `src/balance.ts`: every tunable gameplay constant (energy costs, mission length, seeding densities, combat damage, ship handling) lives there, and both `hunt/` and `kill/` import from it. This is safe because it's plain data with no behavior - domain modules import what they need from it and re-export under their original names, so it reads as if each module still defines its own constants.

### The galaxy is an undo-stack, not a mutable graph

`src/graph/UndoGraph.ts` is a graph whose node set and edge set are each a *stack* of snapshots. Every mutation pushes a new snapshot and, in lockstep, pushes the inverse operation onto a shared undo stack; `undo()` pops back to the previous configuration. This one mechanism drives two unrelated features:

- **Warp drive**: engaging it pushes a fast shortcut edge-set (`buildWarpEdges` in `hunt/warpNetwork.ts`, BFS-scoped to a radius); disengaging just calls `undo()`.
- **Subspace anomalies** (`graph/anomalies.ts`): a *barrier* strips every incoming edge to a sector (blocks entry, not exit); a *conduit* adds a bidirectional shortcut between two sectors. A *gate* (the third anomaly kind) isn't a graph mutation at all - it's a one-off random redirect computed in `hunt/anomalyEffects.ts`'s `pickGateDestination` and applied directly in `moveTo`.

The galaxy object itself lives **outside React state** (`useGalaxy.ts` holds it via `useMemo`, not `useState`) since mutating it doesn't need to trigger a re-render through the normal state-diffing path - `toggleWarp` just calls `bump()` (a version-counter `setState`) after mutating the graph directly.

### `useGalaxy.ts` is the hunt-phase state machine

The single largest file in the project. It owns `HuntState` (position, energy, subsystems, torpedoes, log, etc.) and every action that can change it: `moveTo`, `toggleWarp`, `allocateEnergy`, `resolveEncounter`, `longRangeScan`, `subspaceScan`. `status`/`defeatReason` (victory/timeout/stranded) are derived each render from `hunt/mission.ts`'s pure functions, not stored directly.

**Watch out for stale closures here.** `resolveEncounter` is passed as a prop through `GameShell.tsx` into `KillPhase.tsx`'s world-building `useEffect`. If it closed over `state` directly, it would need `state.energy`/`state.subsystems` in its `useCallback` deps to stay fresh - giving it a new identity on every energy tweak, which propagates through `GameShell`'s `disengage`/`handleResolved` and causes `KillPhase` to tear down and rebuild its entire bitECS world (respawning hostiles at new random positions) on every unrelated state change. The fix in place: mirror `state` into a ref (`stateRef`) and read from that instead, so the callback's own identity stays stable. See `useGalaxy.test.ts`'s "keeps a stable function identity across unrelated state changes" test - this is a regression test for a real bug, not a hypothetical one.

### Galaxy generation and testability

The galaxy is a polar grid: rings around a galactic core, each ring with its own angular resolution (`hunt/cartography.ts`'s `sectorsInRing` - the innermost ring is coarser, the outer half finer), connected with Moore-neighborhood adjacency generalized across mismatched resolutions (`graph/polarTopology.ts`). Sectors are seeded probabilistically (hostile/anomaly/starbase densities, all in `src/balance.ts`) via an injectable `rng: () => number` parameter threaded through `createGalaxy`, `pickAnomalyPlacements`, `pickGateDestination`, `applySubsystemWear`, and `randomHomeSector` - this is what makes galaxy generation and combat outcomes deterministically testable. The one inconsistency: `moveTo`'s gate-redirect branch calls `Math.random` directly instead of taking an injectable rng, so tests that need a deterministic gate outcome mock `Math.random` globally instead.

The home sector is picked randomly each mission (`randomHomeSector`) but is always guaranteed clear of hostiles/anomalies/starbases - not by searching for an empty one, but because `createGalaxy`'s seeding loop unconditionally excludes whatever sector is designated home from every hazard roll.

### Kill phase: bitECS

`kill/world.ts` defines the ECS world as plain typed arrays keyed by entity id (no schema classes - see bitECS 0.4 idioms). `KillPhase.tsx` owns the tick loop (`requestAnimationFrame`), running systems in a fixed order every frame: `hostileAiSystem → homingSystem → physicsSystem → boundarySystem → hazardSystem → collisionSystem → ageoutSystem`, then `pruneSystem` (removes anything marked `Dead` this tick) and `renderSystem`. Shield energy absorbs damage before hull health does (`collisionSystem`); `markDead` (in `world.ts`) is the single idempotent way to tag an entity dead - always use it rather than mutating the `Dead` component directly, so a later system's check for "already dead" stays correct.

Engineering's shield/phaser sliders are live-synced into the running world via a separate, lightweight `useEffect` (not the world-building one) precisely so adjusting them mid-fight doesn't trigger a world rebuild.

### UI structure

`HuntPhase.tsx` lays out three columns: a Controls panel (every player action - scan/warp buttons, also bound to keyboard shortcuts L/S/W/I), a main station (Sciences or Tactical), and a sidebar (Status or Damage-control, then Engineering, then Comms). The Sciences/Tactical and Status/Damage-control pairs each share one panel slot with a header that doubles as the tab toggle (see `Panel.tsx`'s `toggle` prop). Sciences/Tactical specifically uses `display: contents | none` on a wrapper div rather than a conditional render, because unmounting `KillPhase` would tear down its live bitECS world and rAF loop mid-fight - `paused` (checked inside the tick loop) is how it actually pauses, not unmounting.

`App.tsx` starts a new mission by bumping a `gameKey` counter passed as `<GameShell key={gameKey}>` - a full remount, rather than a hand-rolled reset path through every piece of state.

### Testing shape

The pure logic layer (galaxy generation, mission rules, subsystem math, ECS systems, `useGalaxy.ts`'s state transitions) has thorough Vitest coverage, almost all of it exercised via injected `rng`/`Math.random` mocks rather than relying on real randomness. There are no component-level tests (no interaction/rendering tests for the panels, `GameShell`, or `KillPhase`'s canvas rendering) - UI changes have historically been verified with live manual/Playwright passes during development, not automated regression tests.
