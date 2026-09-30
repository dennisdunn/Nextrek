import { afterEach, describe, expect, it } from 'vitest'
import { LEADERBOARD_MAX_ENTRIES } from '../balance'
import { addLeaderboardEntry, loadLeaderboard } from './leaderboard'

const STORAGE_KEY = 'nextrek-leaderboard'

afterEach(() => {
  localStorage.clear()
})

describe('loadLeaderboard', () => {
  it('returns an empty array when nothing has been stored yet', () => {
    expect(loadLeaderboard()).toEqual([])
  })

  it('returns an empty array for corrupted JSON rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadLeaderboard()).toEqual([])
  })

  it('returns an empty array when the stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ oops: true }))
    expect(loadLeaderboard()).toEqual([])
  })

  it('filters out malformed entries but keeps well-formed ones', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ name: 'Kirk', score: 900 }, { name: 'no score' }, { score: 500 }, null, 'garbage']),
    )
    expect(loadLeaderboard()).toEqual([{ name: 'Kirk', score: 900 }])
  })
})

describe('addLeaderboardEntry', () => {
  it('adds an entry and returns it', () => {
    const entries = addLeaderboardEntry('Kirk', 900)
    expect(entries).toEqual([{ name: 'Kirk', score: 900 }])
  })

  it('persists across calls', () => {
    addLeaderboardEntry('Kirk', 900)
    const entries = addLeaderboardEntry('Spock', 1100)
    expect(entries).toEqual([
      { name: 'Spock', score: 1100 },
      { name: 'Kirk', score: 900 },
    ])
  })

  it('sorts by score descending', () => {
    addLeaderboardEntry('Low', 100)
    addLeaderboardEntry('High', 900)
    const entries = addLeaderboardEntry('Mid', 500)
    expect(entries.map((e) => e.name)).toEqual(['High', 'Mid', 'Low'])
  })

  it('keeps an existing entry ahead of a new one on an exact tie', () => {
    addLeaderboardEntry('First', 500)
    const entries = addLeaderboardEntry('Second', 500)
    expect(entries.map((e) => e.name)).toEqual(['First', 'Second'])
  })

  it('trims to LEADERBOARD_MAX_ENTRIES, dropping the lowest scores', () => {
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i++) {
      addLeaderboardEntry(`Player${i}`, 100 + i)
    }
    const entries = addLeaderboardEntry('TooLow', 0)
    expect(entries).toHaveLength(LEADERBOARD_MAX_ENTRIES)
    expect(entries.some((e) => e.name === 'TooLow')).toBe(false)
  })
})
