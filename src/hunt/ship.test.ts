import { describe, expect, it } from 'vitest'
import {
  canAfford,
  longRangeScanCost,
  LRS_COST_IMPULSE,
  LRS_COST_WARP,
  MOVE_COST_NORMAL,
  MOVE_COST_WARP,
  moveCost,
  SUBSPACE_SCAN_MULTIPLIER,
  subspaceScanCost,
} from './ship'

describe('moveCost', () => {
  it('is cheaper per hop under warp than in normal space', () => {
    expect(moveCost(true)).toBe(MOVE_COST_WARP)
    expect(moveCost(false)).toBe(MOVE_COST_NORMAL)
    expect(moveCost(true)).toBeLessThan(moveCost(false))
  })
})

describe('longRangeScanCost', () => {
  it('costs more under warp than under impulse, since more sectors are swept', () => {
    expect(longRangeScanCost(false)).toBe(LRS_COST_IMPULSE)
    expect(longRangeScanCost(true)).toBe(LRS_COST_WARP)
    expect(longRangeScanCost(true)).toBeGreaterThan(longRangeScanCost(false))
  })
})

describe('subspaceScanCost', () => {
  it('is the long-range scan cost times the configured multiplier, for both drive modes', () => {
    expect(subspaceScanCost(false)).toBe(LRS_COST_IMPULSE * SUBSPACE_SCAN_MULTIPLIER)
    expect(subspaceScanCost(true)).toBe(LRS_COST_WARP * SUBSPACE_SCAN_MULTIPLIER)
  })

  it('is always pricier than the corresponding long-range scan', () => {
    expect(subspaceScanCost(false)).toBeGreaterThan(longRangeScanCost(false))
    expect(subspaceScanCost(true)).toBeGreaterThan(longRangeScanCost(true))
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
