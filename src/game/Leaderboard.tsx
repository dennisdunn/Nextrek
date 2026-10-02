import { useState } from 'react'
import { LEADERBOARD_MAX_ENTRIES } from '../balance'
import { addLeaderboardEntry, loadLeaderboard, type LeaderboardEntry } from './leaderboardStorage'

export interface LeaderboardProps {
  /**
   * A just-earned score to slot into the board with an inline name input -
   * omit entirely for a plain, read-only leaderboard (the start screen's
   * usage). A loss has no score to submit, so EndScreen only passes this on
   * a victory.
   */
  pendingScore?: number
}

type Row = { kind: 'entry'; entry: LeaderboardEntry } | { kind: 'pending' }

/**
 * Shared between StartScreen (read-only) and EndScreen (with a pending
 * score to name and save) rather than two components, since the only real
 * difference is whether `pendingScore` is present.
 */
export function Leaderboard({ pendingScore }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(loadLeaderboard)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)

  const showPending = pendingScore !== undefined && !saved
  // Where the pending score would land: after every entry it doesn't beat
  // outright, same as addLeaderboardEntry's own tie-break (a stable sort
  // keeps an existing entry ahead of a new, equal one).
  const pendingRank = showPending ? entries.filter((e) => e.score >= pendingScore).length : -1
  const qualifies = showPending && pendingRank < LEADERBOARD_MAX_ENTRIES

  function handleSave() {
    if (pendingScore === undefined) return
    const trimmedName = name.trim() || 'Anonymous'
    setEntries(addLeaderboardEntry(trimmedName, pendingScore))
    setSavedName(trimmedName)
    setSaved(true)
  }

  const rows: Row[] =
    showPending && qualifies
      ? [
          ...entries.slice(0, pendingRank).map((entry): Row => ({ kind: 'entry', entry })),
          { kind: 'pending' } satisfies Row,
          ...entries.slice(pendingRank).map((entry): Row => ({ kind: 'entry', entry })),
        ].slice(0, LEADERBOARD_MAX_ENTRIES)
      : entries.map((entry): Row => ({ kind: 'entry', entry }))

  return (
    <section className="leaderboard pk-frame pk-std" aria-label="Leaderboard">
      <h2 className="pk-title">Leaderboard</h2>
      <div className="pk-content leaderboard__body">
        {showPending && !qualifies && (
          <p className="leaderboard__note">That score didn't make the leaderboard this time.</p>
        )}
        {rows.length === 0 ? (
          <p className="leaderboard__empty">No scores yet - be the first.</p>
        ) : (
          <ol className="leaderboard__list">
            {rows.map((row, i) =>
              row.kind === 'pending' ? (
                <li key="pending" className="leaderboard__row leaderboard__row--pending">
                  <span className="leaderboard__rank">#{i + 1}</span>
                  <input
                    type="text"
                    className="leaderboard__name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="Your name"
                    maxLength={20}
                    autoFocus
                    aria-label="Your name"
                  />
                  <div className="leaderboard__pending-footer">
                    <span className="leaderboard__score">{pendingScore}</span>
                    <button type="button" className="pk-button leaderboard__save" onClick={handleSave}>
                      Save
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={`${row.entry.name}-${row.entry.score}-${i}`}
                  className={
                    saved && row.entry.name === savedName && row.entry.score === pendingScore
                      ? 'leaderboard__row leaderboard__row--you'
                      : 'leaderboard__row'
                  }
                >
                  <span className="leaderboard__rank">#{i + 1}</span>
                  <span className="leaderboard__name">{row.entry.name}</span>
                  <span className="leaderboard__score">{row.entry.score}</span>
                </li>
              ),
            )}
          </ol>
        )}
      </div>
    </section>
  )
}
