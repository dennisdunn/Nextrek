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
export function StartScreen({ onSelect }: StartScreenProps) {
  return (
    <div className="start-screen">
      <h1>Subspace Wumpus</h1>
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
