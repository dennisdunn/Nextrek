import { describe, expect, it } from 'vitest'
import { allocate, refund, REFUND_EFFICIENCY } from './subsystems'

describe('allocate', () => {
  it('moves energy from reserve into a subsystem', () => {
    const pools = { reserve: 100, shields: 0, phasers: 0 }
    const next = allocate(pools, 'shields', 40)
    expect(next).toEqual({ reserve: 60, shields: 40, phasers: 0 })
  })

  it('moves energy back to reserve when lowering a subsystem', () => {
    const pools = { reserve: 60, shields: 40, phasers: 0 }
    const next = allocate(pools, 'shields', 10)
    expect(next).toEqual({ reserve: 90, shields: 10, phasers: 0 })
  })

  it('clamps to the combined budget of reserve + the subsystem itself', () => {
    const pools = { reserve: 60, shields: 40, phasers: 0 }
    const next = allocate(pools, 'shields', 1000)
    expect(next).toEqual({ reserve: 0, shields: 100, phasers: 0 })
  })

  it('never goes negative', () => {
    const pools = { reserve: 10, shields: 0, phasers: 0 }
    const next = allocate(pools, 'shields', -50)
    expect(next).toEqual({ reserve: 10, shields: 0, phasers: 0 })
  })

  it('does not touch the other subsystem', () => {
    const pools = { reserve: 50, shields: 20, phasers: 30 }
    const next = allocate(pools, 'phasers', 50)
    expect(next).toEqual({ reserve: 30, shields: 20, phasers: 50 })
  })
})

describe('refund', () => {
  it('returns only the reported leftover, at REFUND_EFFICIENCY, and always zeroes both subsystems', () => {
    // pools.shields/phasers (the pre-combat allocation) are stale once
    // combat starts - refund goes entirely off the reported leftover.
    const pools = { reserve: 10, shields: 999, phasers: 999 }
    const next = refund(40, 25, pools)
    expect(next).toEqual({ reserve: 10 + (40 + 25) * REFUND_EFFICIENCY, shields: 0, phasers: 0 })
  })

  it('recovers nothing when both pools were fully depleted in combat', () => {
    const pools = { reserve: 100, shields: 0, phasers: 0 }
    expect(refund(0, 0, pools)).toEqual({ reserve: 100, shields: 0, phasers: 0 })
  })

  it('is lossy: less comes back than was left over', () => {
    const pools = { reserve: 0, shields: 0, phasers: 0 }
    const next = refund(50, 50, pools)
    expect(next.reserve).toBeLessThan(100)
    expect(next.reserve).toBeGreaterThan(0)
  })
})
