import { describe, expect, it } from 'vitest'
import {
  canAfford,
  longRangeScanCost,
  LRS_COST_IMPULSE,
  LRS_COST_WARP,
  MOVE_COST_NORMAL,
  moveCost,
  SUBSPACE_SCAN_MULTIPLIER,
  subspaceScanCost,
  WARP_MOVE_BASE_COST,
  WARP_MOVE_COST_PER_SECTOR,
} from './ship'

describe('moveCost', () => {
  it('impulse is always the flat per-hop cost, regardless of distance', () => {
    expect(moveCost(false)).toBe(MOVE_COST_NORMAL)
    expect(moveCost(false, 1)).toBe(MOVE_COST_NORMAL)
  })

  it('warp scales with distance: base cost plus a rate per sector', () => {
    expect(moveCost(true, 1)).toBe(WARP_MOVE_BASE_COST + WARP_MOVE_COST_PER_SECTOR)
    expect(moveCost(true, 3)).toBe(WARP_MOVE_BASE_COST + WARP_MOVE_COST_PER_SECTOR * 3)
  })

  it('a short warp hop is not cheaper than the same hop under impulse', () => {
    // a 1-sector warp jump should never undercut just using impulse for it
    expect(moveCost(true, 1)).toBeGreaterThanOrEqual(moveCost(false))
  })

  it('a long warp jump beats the equivalent number of impulse hops', () => {
    const distance = 3
    const warpCost = moveCost(true, distance)
    const impulseCost = MOVE_COST_NORMAL * distance
    expect(warpCost).toBeLessThan(impulseCost)
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
