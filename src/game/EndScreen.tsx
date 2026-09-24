import { HOSTILE_QUOTA, MISSION_DEADLINE, type DefeatReason, type MissionStatus } from '../hunt/mission'

export interface EndScreenProps {
  status: Extract<MissionStatus, 'victory' | 'defeat'>
  /** Which kind of defeat this was - ignored (and may be null) for a victory. */
  defeatReason: DefeatReason | null
  hostilesDestroyed: number
  stardate: number
  onNewGame: () => void
}

const VICTORY_COPY = {
  heading: 'Mission accomplished',
  body: 'Quota met before the clock ran out. Well flown, Captain.',
}

const DEFEAT_COPY: Record<DefeatReason, { heading: string; body: string }> = {
  timeout: {
    heading: 'Mission failed',
    body: "Time's up, and the quota wasn't met. The mission clock waits for no one.",
  },
  stranded: {
    heading: 'Stranded',
    body: "Not enough energy left to move - not even by standing down shields and phasers. The ship drifts, and that's the end of the mission.",
  },
}

/** Full replacement for the bridge HUD once the mission is decided - nothing left to click through to. */
export function EndScreen({ status, defeatReason, hostilesDestroyed, stardate, onNewGame }: EndScreenProps) {
  const { heading, body } = status === 'victory' ? VICTORY_COPY : DEFEAT_COPY[defeatReason ?? 'timeout']
  return (
    <div className={`end-screen end-screen--${status}`}>
      <h1>{heading}</h1>
      <p>{body}</p>
      <dl className="readout end-screen__stats">
        <dt>Hostiles destroyed</dt>
        <dd>
          {hostilesDestroyed} / {HOSTILE_QUOTA}
        </dd>
        <dt>Final stardate</dt>
        <dd>
          {stardate.toFixed(1)} / {MISSION_DEADLINE.toFixed(1)}
        </dd>
      </dl>
      <button type="button" onClick={onNewGame}>
        New game
      </button>
    </div>
  )
}
