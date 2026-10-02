import { missionScore, type DefeatReason, type MissionResources, type MissionStatus } from '../hunt/mission'
import { Leaderboard } from './Leaderboard'

export interface EndScreenProps {
  status: Extract<MissionStatus, 'victory' | 'defeat'>
  /** Which kind of defeat this was - ignored (and may be null) for a victory. */
  defeatReason: DefeatReason | null
  hostilesDestroyed: number
  /** The active difficulty's quota/deadline - see balance.ts's DIFFICULTY_PRESETS. */
  hostileQuota: number
  stardate: number
  missionDeadline: number
  /** The active difficulty's stardate allotment - see balance.ts's DIFFICULTY_PRESETS. Needed alongside missionDeadline to recover how much of it was actually spent (see hunt/mission.ts's missionScore). */
  stardateBudget: number
  /** What's left of the ship's energy/torpedoes at the moment the mission ended - only meaningful (and only shown) on a victory. */
  resources: MissionResources
  /** The active difficulty's own multiplier on the mission score - see balance.ts's DIFFICULTY_PRESETS. */
  scoreMultiplier: number
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
  destroyed: {
    heading: 'Ship destroyed',
    body: 'The hull gave out before the hostiles did. The mission ends here.',
  },
}

/** Full replacement for the bridge HUD once the mission is decided - nothing left to click through to. */
export function EndScreen({
  status,
  defeatReason,
  hostilesDestroyed,
  hostileQuota,
  stardate,
  missionDeadline,
  stardateBudget,
  resources,
  scoreMultiplier,
  onNewGame,
}: EndScreenProps) {
  const { heading, body } = status === 'victory' ? VICTORY_COPY : DEFEAT_COPY[defeatReason ?? 'timeout']
  // A performance readout only makes sense for a completed win - fewest
  // resources/quickest time/most hostiles are all framed as "how well did
  // you do it", which a loss doesn't have an answer to.
  const score =
    status === 'victory'
      ? missionScore(hostilesDestroyed, hostileQuota, stardate, stardateBudget, resources, scoreMultiplier)
      : null
  return (
    <div className={`end-screen end-screen--${status}`}>
      <section
        className={`end-screen__frame pk-frame pk-std${status === 'defeat' ? ' pk-alert' : ''}`}
        aria-label={heading}
      >
        <h1 className="pk-title">{heading}</h1>
        <div className="pk-content">
          <p>{body}</p>
          <dl className="readout end-screen__stats">
            <dt>Hostiles destroyed</dt>
            <dd>
              {hostilesDestroyed} / {hostileQuota}
            </dd>
            <dt>Final stardate</dt>
            <dd>
              {stardate.toFixed(1)} / {missionDeadline.toFixed(1)}
            </dd>
            {score !== null && (
              <>
                <dt>Mission score</dt>
                <dd className="end-screen__score">{score}</dd>
              </>
            )}
          </dl>
          <button type="button" className="pk-button" onClick={onNewGame}>
            New game
          </button>
        </div>
      </section>
      <Leaderboard pendingScore={score ?? undefined} />
    </div>
  )
}
