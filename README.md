# Subspace Wumpus

**[Play it now →](https://dennisdunn.github.io/Nextrek/)**

Hunt the Wumpus meets Asteroids, loosely based on 1971 BASIC *Star Trek*. Explore a procedurally generated galaxy turn by turn, then drop into real-time combat the moment you run into trouble.

## The game

Subspace Wumpus alternates between two phases:

- **Hunt phase** — a turn-based strategic layer. The galaxy is a polar grid of sectors arranged in rings around a galactic core. You move sector to sector by impulse or warp, spend energy on long-range and subspace scans to reveal what's nearby, and manage shield/phaser power allocation. Subspace anomalies (barriers, gates, conduits) complicate navigation, and starbases fully restore your ship.
- **Kill phase** — a real-time, top-down arena in the style of *Asteroids*, opened automatically the moment you move into a sector holding hostiles. Fly your ship, fire phasers, and lock on with homing torpedoes while managing the same shield/phaser energy pools from the hunt phase. Some encounters also have a star to avoid.

**Objective:** destroy enough hostiles before the mission clock runs out. **You lose** if the clock runs out first, if your ship is destroyed in combat, or if you become stranded — too little energy left to make even the cheapest possible move.

Every mission starts in a random, clear sector, and ship subsystems (warp drive, shields, phasers, impulse engines, sensors, torpedo tubes) can take lasting damage in combat, degrading what they do until you reach a starbase for repairs.

## Controls

| Action | How |
| --- | --- |
| Long-range scan | Controls panel → **LRS**, or press **L** |
| Subspace scan (reveal anomalies) | Controls panel → **Subspace**, or press **S** |
| Engage warp | Controls panel → **Warp**, or press **W** |
| Return to impulse | Controls panel → **Impulse**, or press **I** |
| Move | Sciences panel → click a reachable sector on the map |
| Allocate energy | Engineering panel → Shields / Phasers sliders |
| Steer / thrust (in combat) | Arrow keys or **WASD** |
| Fire phasers (in combat) | **Space** |
| Fire a homing torpedo (in combat) | **Enter** or **T** |
| Flee combat | Switch to Sciences and pick a sector to move to |

## Running locally

Requires Node.js.

```bash
npm install
npm run dev        # start the dev server with hot reload
npm run build      # typecheck and produce a production build in dist/
npm run preview    # serve the production build locally
npm run test       # run the test suite in watch mode
npm run test:run   # run the test suite once (what CI runs)
npm run lint       # lint with oxlint
```

## Tech stack

- [React](https://react.dev/) + TypeScript, built with [Vite](https://vite.dev/)
- [bitECS](https://github.com/NateTheGreatt/bitECS) for the real-time kill-phase entity/component/system loop
- [Vitest](https://vitest.dev/) for the unit test suite covering galaxy generation, mission logic, and combat systems
- Installable as a PWA (offline-capable, via `vite-plugin-pwa`)
- Deployed automatically to [GitHub Pages](https://pages.github.com/) on every push to `main` (see `.github/workflows/deploy.yml`)

## Tuning gameplay

Every gameplay-balance constant — energy costs, mission length, galaxy seeding densities, combat damage, ship handling — lives in one place: [`src/balance.ts`](src/balance.ts).

## Project layout

- `src/hunt/` — the turn-based exploration phase: galaxy generation, sensors, mission state, and the bridge station UI panels
- `src/kill/` — the real-time bitECS combat phase
- `src/game/` — the phase-transition layer connecting hunt and kill (`GameShell.tsx`), plus the end screen
- `src/balance.ts` — every tunable gameplay constant, in one place
- `src/graph/`, `src/math/` — shared, domain-agnostic data structures and math helpers
