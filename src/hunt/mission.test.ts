import { describe, expect, it } from 'vitest'
import { stardateCost, tacticalAlert } from './mission'

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
