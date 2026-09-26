# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nextrek ("Subspace Wumpus"): Hunt the Wumpus meets Asteroids, loosely based on 1971 BASIC *Star Trek*. A turn-based galaxy-exploration layer (the "hunt phase") drops into real-time top-down combat (the "kill phase") whenever the player moves into a sector holding hostiles. React 19 + TypeScript + Vite, bitECS for the combat simulation, Vitest for tests. Deployed to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).

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

## How the project got here

Started (2026-09-06) as a Vite+React+TS scaffold with `UndoGraph` and the anomaly primitives built first, before there was a game on top of them - the hunt-phase galaxy map, bitECS kill phase, and phase-transition layer (`GameShell`) followed the same day. Fog-of-war sensing and the energy economy came next, then the hunt-phase UI went through its first real restructure (Status/Comms/Engineering/Sciences panels) and shields/phasers became real, refundable combat resources rather than free stats.

Mid-September brought a wave of world-shape changes: rings switched from equal-area to equal-width, the galaxy grew to 6 rings, and per-ring angular resolution was introduced (coarse core, finer outer rings) - all in service of making the map read better at a glance. Anomalies were reworked repeatedly in this window: a "well" became a *barrier* (blocks entry, not exit), then anomalies overall were rebuilt around entry-triggered effects (barrier/gate/conduit), with several passes just on how each type reads on the map (marker glyphs added, then partly removed again once they cluttered more than they clarified). Starbases (auto-dock, restores shields/phasers/reserves) arrived in the same period.

Late September was the combat-depth push: torpedoes as a scarce secondary weapon, multi-hostile packs, star hazards, and the timer+quota win condition followed by stranding as a defeat condition (destroyed - real hull-to-zero defeat - didn't land until much later, see below). This is also when Tactical merged into the hunt-phase HUD as a Sciences-toggle panel instead of a separate full-screen mode, which is what makes `display: contents | none` (not unmounting) load-bearing for `KillPhase` today - and when a real bug (hostiles teleporting when Engineering sliders moved mid-fight) forced the stable-callback-identity pattern that `useGalaxy.ts`'s stale-closures note above documents.

Late September also did the two consolidation passes this codebase leans on: every tunable constant moved into `src/balance.ts` (previously scattered across modules), and a maintainability cleanup pass removed dead code and duplicated helpers. CLAUDE.md itself, the test suite for `useGalaxy`'s core transitions, and the MIT license all landed around the same time - this was the point the project shifted from "get it working" to "keep it working."

The most recent arc (2026-09-25 on) was about getting the game in front of a real player on a real device: a headless balance simulator (reusing the actual hunt/kill logic with a scripted bot, including a flee threshold so "stranded" - not "destroyed" - was the dominant failure mode) was used to derive Easy/Normal/Hard presets; a tablet/phone pass added on-screen touch controls, PWA icons, and a name unification (the game had been developing under "Subspace Wumpus" internally, "Nextrek" became the primary name everywhere - title, manifest, README, CLAUDE.md); and a live mobile-Safari test surfaced a real CSS cascade-order bug that was crushing the sidebar on narrow screens. That same real-device push is what exposed that "ship destroyed" was copy without a mechanism - `DefeatReason` only had `timeout`/`stranded` - which is why it was added for real as the third defeat condition (2026-09-26), as a sticky `shipDestroyed` flag rather than a derived threshold, checked first in status derivation.

A same-day follow-up pass (2026-09-26) tightened up combat feel and the energy economy's edges. The player ship used to spawn dead-center and motionless at the start of every kill-phase encounter even though hostiles have always drifted from spawn; `spawnPlayer` now takes a heading/speed the same way `spawnHostile` already did, with `pickPlayerSpawnHeading` (`kill/spawn.ts`) keeping that heading clear of a star hazard's direction when one's present. Separately, H/P keyboard shortcuts were added so a player can add shield/phaser energy mid-fight without reaching for the mouse (`useGalaxy.ts`'s `adjustEnergy`) - deliberately increment-only, no decrement key, because a decrement *was* available already via the Engineering slider (`allocateEnergy`) and turned out to be exploitable: dragging a slider down right before a fight resolved reclaimed that energy at full value instead of the `REFUND_EFFICIENCY` (50%) rate `resolveEncounter`'s own end-of-fight refund charges on unspent energy. That loophole got closed the same day by giving `allocateEnergy` an `inCombat` flag - a decrease while an encounter is active is now credited at the same lossy rate a real stand-down would be, so timing a slider drag against the end of a fight no longer avoids the cost.
