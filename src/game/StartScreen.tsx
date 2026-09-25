import type { Difficulty } from '../balance'

export interface StartScreenProps {
  onSelect: (difficulty: Difficulty) => void
}

const DIFFICULTY_COPY: Record<Difficulty, { label: string; body: string }> = {
  easy: {
    label: 'Easy',
    body: 'Fewer, weaker hostiles and more starbases to fall back on. A gentler first mission.',
  },
  normal: {
    label: 'Normal',
    body: 'The standard mission - the numbers this game was built and balanced around.',
  },
  hard: {
    label: 'Hard',
    body: 'More hostiles, harder-hitting, fewer safe harbors, and a tighter clock. For a real challenge.',
  },
}

/**
 * First thing the player sees - picks a Difficulty (balance.ts's
 * DIFFICULTY_PRESETS) before a galaxy is even generated, since density and
 * starting resources are baked in at galaxy creation (see useGalaxy.ts).
 */
const CONTROLS: [string, string][] = [
  ['Click a sector', 'Move'],
  ['L', 'Long-range scan'],
  ['S', 'Subspace scan'],
  ['W / I', 'Engage warp / return to impulse'],
  ['Arrows / WASD', 'Steer & thrust'],
  ['Space', 'Fire phasers'],
  ['Enter / T', 'Fire a homing torpedo'],
]

export function StartScreen({ onSelect }: StartScreenProps) {
  return (
    <div className="start-screen">
      <h1>Nextrek</h1>
      <p className="start-screen__subtitle">Subspace Wumpus</p>

      <p className="start-screen__description">
        Hunt the Wumpus meets Asteroids, loosely based on 1971 BASIC <em>Star Trek</em>. Explore a
        procedurally generated galaxy sector by sector, then drop into real-time combat the
        moment you run into trouble. Destroy enough hostiles before the mission clock runs
        out - you lose if time runs out, your ship is destroyed, or you're stranded with too
        little energy left to move.
      </p>

      <div className="start-screen__instructions">
        <h2>Controls</h2>
        <div className="start-screen__controls">
          {CONTROLS.map(([key, action]) => (
            <div className="start-screen__control-row" key={key}>
              <span className="start-screen__key">{key}</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
        <p className="start-screen__note">
          Losing a fight? Switch back to Sciences and move to another sector - that's how you
          flee. On a touch device, on-screen controls appear automatically during combat.
        </p>
      </div>

      <p>Choose your mission difficulty.</p>
      <div className="start-screen__options">
        {(Object.keys(DIFFICULTY_COPY) as Difficulty[]).map((difficulty) => (
          <button
            key={difficulty}
            type="button"
            className={`start-screen__option start-screen__option--${difficulty}`}
            onClick={() => onSelect(difficulty)}
          >
            <strong>{DIFFICULTY_COPY[difficulty].label}</strong>
            <span>{DIFFICULTY_COPY[difficulty].body}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
