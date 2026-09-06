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

/** Stand shields and phasers down, returning whatever they held to the reserve - e.g. once combat resolves. */
export function refund(pools: EnergyPools): EnergyPools {
  return {
    reserve: pools.reserve + pools.shields + pools.phasers,
    shields: 0,
    phasers: 0,
  }
}
