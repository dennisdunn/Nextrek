import { LEADERBOARD_MAX_ENTRIES } from '../balance'

export interface LeaderboardEntry {
  name: string
  score: number
}

const STORAGE_KEY = 'nextrek-leaderboard'

/**
 * Reads the leaderboard from localStorage. Never throws - a missing key,
 * corrupted JSON, or storage being unavailable at all (private browsing,
 * disabled entirely) all just read back as an empty leaderboard rather than
 * breaking the start/end screen around it.
 */
export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is LeaderboardEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as LeaderboardEntry).name === 'string' &&
        typeof (entry as LeaderboardEntry).score === 'number',
    )
  } catch {
    return []
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked - the score just doesn't persist this time,
    // not worth surfacing to the player over.
  }
}

/**
 * Adds `name`/`score` as a new entry, re-sorts by score descending (a tie
 * keeps whichever entry was already there ahead of the new one - `sort` is
 * stable and the new entry is appended last, before sorting), trims to
 * LEADERBOARD_MAX_ENTRIES, and persists the result - returned directly so
 * the caller can render it without a second read. `name` is used exactly as
 * given; defaulting an empty name is the caller's call, not this module's.
 */
export function addLeaderboardEntry(name: string, score: number): LeaderboardEntry[] {
  const entries = [...loadLeaderboard(), { name, score }]
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_MAX_ENTRIES)
  saveLeaderboard(entries)
  return entries
}
