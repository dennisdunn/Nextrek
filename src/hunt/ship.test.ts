import { describe, expect, it } from 'vitest'
import { canAfford, MOVE_COST_NORMAL, MOVE_COST_WARP, moveCost } from './ship'

describe('moveCost', () => {
  it('is cheaper per hop under warp than in normal space', () => {
    expect(moveCost(true)).toBe(MOVE_COST_WARP)
    expect(moveCost(false)).toBe(MOVE_COST_NORMAL)
    expect(moveCost(true)).toBeLessThan(moveCost(false))
  })
})

describe('canAfford', () => {
  it('allows exact and greater balances', () => {
    expect(canAfford(10, 10)).toBe(true)
    expect(canAfford(11, 10)).toBe(true)
  })

  it('rejects an insufficient balance', () => {
    expect(canAfford(9, 10)).toBe(false)
  })
})
