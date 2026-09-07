export type Subsystem = 'shields' | 'phasers'

export interface EnergyPools {
  /** Unallocated reserve - what's available to spend on movement and warp. */
  reserve: number
  shields: number
  phasers: number
}

/**
 * Move energy between the unallocated reserve and a subsystem, like an
 * engineering console slider: the target level is clamped to whatever the
 * reserve plus the subsystem's current level can cover, and the
 * difference moves the other way. Energy committed to shields or phasers
 * is no longer available to the engines.
 */
export function allocate(pools: EnergyPools, subsystem: Subsystem, targetLevel: number): EnergyPools {
  const available = pools.reserve + pools[subsystem]
  const next = Math.max(0, Math.min(targetLevel, available))
  return {
    ...pools,
    reserve: available - next,
    [subsystem]: next,
  }
}

/**
 * Fraction of leftover shield/phaser energy actually recovered when
 * combat ends. A one-way conversion loss: allocating energy "just in
 * case" and never spending it still costs you (1 - this) of it, so
 * over-committing before a fight isn't free just because it's undone
 * afterward.
 */
export const REFUND_EFFICIENCY = 0.5

/**
 * Stand shields and phasers down after combat. Only the reported
 * leftover (not the original allocation - whatever was actually spent
 * absorbing hits or firing is gone) comes back, and only at
 * REFUND_EFFICIENCY on the dollar.
 */
export function refund(leftoverShields: number, leftoverPhasers: number, pools: EnergyPools): EnergyPools {
  const recovered = Math.max(0, leftoverShields + leftoverPhasers) * REFUND_EFFICIENCY
  return {
    reserve: pools.reserve + recovered,
    shields: 0,
    phasers: 0,
  }
}
