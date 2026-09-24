import { describe, expect, it } from 'vitest'
import {
  allocate,
  applySubsystemWear,
  CRITICAL_SYSTEM_THRESHOLD,
  degradedCostMultiplier,
  fullSubsystemHealth,
  HEALTHY_SYSTEM_THRESHOLD,
  refund,
  REFUND_EFFICIENCY,
  systemAnnunciatorClass,
  systemEfficiency,
} from './subsystems'

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

  it('clamps to maxLevel even when reserve could otherwise cover more', () => {
    const pools = { reserve: 200, shields: 0, phasers: 0 }
    const next = allocate(pools, 'shields', 80, 50)
    expect(next).toEqual({ reserve: 150, shields: 50, phasers: 0 })
  })

  it('defaults maxLevel to 100 when not given', () => {
    const pools = { reserve: 200, shields: 0, phasers: 0 }
    const next = allocate(pools, 'shields', 150)
    expect(next.shields).toBe(100)
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

describe('systemEfficiency', () => {
  it('is 1 at full health and 0 at zero health', () => {
    expect(systemEfficiency(100)).toBe(1)
    expect(systemEfficiency(0)).toBe(0)
  })

  it('scales linearly in between', () => {
    expect(systemEfficiency(50)).toBe(0.5)
  })

  it('clamps out-of-range health to [0, 100]', () => {
    expect(systemEfficiency(-10)).toBe(0)
    expect(systemEfficiency(150)).toBe(1)
  })
})

describe('systemAnnunciatorClass', () => {
  it('reads red at or below the critical threshold, including fully offline', () => {
    expect(systemAnnunciatorClass(0)).toBe('annunciator annunciator--red')
    expect(systemAnnunciatorClass(CRITICAL_SYSTEM_THRESHOLD)).toBe('annunciator annunciator--red')
  })

  it('reads yellow strictly between the critical and healthy thresholds', () => {
    expect(systemAnnunciatorClass(CRITICAL_SYSTEM_THRESHOLD + 1)).toBe('annunciator annunciator--yellow')
    expect(systemAnnunciatorClass(HEALTHY_SYSTEM_THRESHOLD - 1)).toBe('annunciator annunciator--yellow')
  })

  it('reads green at or above the healthy threshold', () => {
    expect(systemAnnunciatorClass(HEALTHY_SYSTEM_THRESHOLD)).toBe('annunciator annunciator--green')
    expect(systemAnnunciatorClass(100)).toBe('annunciator annunciator--green')
  })
})

describe('degradedCostMultiplier', () => {
  it('is 1x at full health', () => {
    expect(degradedCostMultiplier(100)).toBe(1)
  })

  it('is 2x fully offline - a cap, not a hard cutoff', () => {
    expect(degradedCostMultiplier(0)).toBe(2)
  })

  it('scales linearly in between', () => {
    expect(degradedCostMultiplier(50)).toBe(1.5)
  })
})

describe('applySubsystemWear', () => {
  it('does nothing when there is no hull damage to convert', () => {
    const subsystems = fullSubsystemHealth()
    const result = applySubsystemWear(subsystems, 0)
    expect(result).toEqual({ subsystems, damagedSystem: null })
  })

  it('degrades exactly one system by the full damage amount', () => {
    const subsystems = fullSubsystemHealth()
    const result = applySubsystemWear(subsystems, 30, () => 0.41) // picks the 3rd of 6 systems
    expect(result.damagedSystem).toBe('phaserArray')
    expect(result.subsystems.phaserArray).toBe(70)
    // every other system is untouched
    expect(result.subsystems.warpDrive).toBe(100)
    expect(result.subsystems.shieldGenerator).toBe(100)
    expect(result.subsystems.impulseEngines).toBe(100)
    expect(result.subsystems.sensors).toBe(100)
    expect(result.subsystems.torpedoTubes).toBe(100)
  })

  it('can pick torpedo tubes, the last system in the list', () => {
    const subsystems = fullSubsystemHealth()
    const result = applySubsystemWear(subsystems, 15, () => 0.99)
    expect(result.damagedSystem).toBe('torpedoTubes')
    expect(result.subsystems.torpedoTubes).toBe(85)
  })

  it('never drops a system below zero', () => {
    const subsystems = fullSubsystemHealth()
    const result = applySubsystemWear(subsystems, 1000, () => 0)
    expect(result.damagedSystem).toBe('warpDrive')
    expect(result.subsystems.warpDrive).toBe(0)
  })

  it('does not mutate the input', () => {
    const subsystems = fullSubsystemHealth()
    applySubsystemWear(subsystems, 30, () => 0)
    expect(subsystems.warpDrive).toBe(100)
  })
})
