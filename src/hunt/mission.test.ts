import { describe, expect, it } from 'vitest'
import {
  HOSTILE_QUOTA,
  isStranded,
  MISSION_DEADLINE,
  missionStatus,
  stardateCost,
  stardateRemaining,
  STARTING_STARDATE,
  tacticalAlert,
} from './mission'

describe('stardateCost', () => {
  it('costs less mission time under warp than in normal space', () => {
    expect(stardateCost(true)).toBeLessThan(stardateCost(false))
  })
})

describe('tacticalAlert', () => {
  it('is red when a hostile is in the current sector, regardless of sensed count', () => {
    expect(tacticalAlert(true, 0)).toBe('red')
    expect(tacticalAlert(true, 3)).toBe('red')
  })

  it('is yellow when danger is sensed nearby but not present here', () => {
    expect(tacticalAlert(false, 1)).toBe('yellow')
  })

  it('is green when nothing is here or sensed nearby', () => {
    expect(tacticalAlert(false, 0)).toBe('green')
  })
})

describe('missionStatus', () => {
  it('is active before the quota is met and before the deadline', () => {
    expect(missionStatus(0, STARTING_STARDATE)).toBe('active')
    expect(missionStatus(HOSTILE_QUOTA - 1, MISSION_DEADLINE - 1)).toBe('active')
  })

  it('is victory once the quota is met, even exactly on the deadline', () => {
    expect(missionStatus(HOSTILE_QUOTA, STARTING_STARDATE)).toBe('victory')
    expect(missionStatus(HOSTILE_QUOTA, MISSION_DEADLINE)).toBe('victory')
  })

  it('is victory past the quota too', () => {
    expect(missionStatus(HOSTILE_QUOTA + 5, STARTING_STARDATE)).toBe('victory')
  })

  it('is defeat once the deadline passes without meeting the quota', () => {
    expect(missionStatus(0, MISSION_DEADLINE)).toBe('defeat')
    expect(missionStatus(HOSTILE_QUOTA - 1, MISSION_DEADLINE + 1)).toBe('defeat')
  })

  it('favors victory over defeat when both thresholds are hit on the same move', () => {
    expect(missionStatus(HOSTILE_QUOTA, MISSION_DEADLINE + 5)).toBe('victory')
  })
})

describe('stardateRemaining', () => {
  it('counts down from the full budget at mission start', () => {
    expect(stardateRemaining(STARTING_STARDATE)).toBeCloseTo(MISSION_DEADLINE - STARTING_STARDATE)
  })

  it('reaches zero exactly at the deadline', () => {
    expect(stardateRemaining(MISSION_DEADLINE)).toBe(0)
  })

  it('never goes negative past the deadline', () => {
    expect(stardateRemaining(MISSION_DEADLINE + 10)).toBe(0)
  })
})

describe('isStranded', () => {
  it('is false when total energy covers the cheapest move', () => {
    expect(isStranded(10, 10)).toBe(false)
    expect(isStranded(100, 10)).toBe(false)
  })

  it('is true when total energy falls short of the cheapest move', () => {
    expect(isStranded(9, 10)).toBe(true)
    expect(isStranded(0, 10)).toBe(true)
  })
})
