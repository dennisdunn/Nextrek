import { HOSTILE_QUOTA, MISSION_DEADLINE, type MissionStatus } from '../hunt/mission'

export interface EndScreenProps {
  status: Extract<MissionStatus, 'victory' | 'defeat'>
  hostilesDestroyed: number
  stardate: number
  onNewGame: () => void
}

const COPY: Record<EndScreenProps['status'], { heading: string; body: string }> = {
  victory: {
    heading: 'Mission accomplished',
    body: 'Quota met before the clock ran out. Well flown, Captain.',
  },
  defeat: {
    heading: 'Mission failed',
    body: "Time's up, and the quota wasn't met. The mission clock waits for no one.",
  },
}

/** Full replacement for the bridge HUD once the mission is decided - nothing left to click through to. */
export function EndScreen({ status, hostilesDestroyed, stardate, onNewGame }: EndScreenProps) {
  const { heading, body } = COPY[status]
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
