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
 * reserve plus the subsystem's current level can cover (and to maxLevel,
 * a damaged shield generator or phaser array's reduced ceiling - see
 * ShipSystem below), and the difference moves the other way. Energy
 * committed to shields or phasers is no longer available to the engines.
 */
export function allocate(pools: EnergyPools, subsystem: Subsystem, targetLevel: number, maxLevel: number = 100): EnergyPools {
  const available = pools.reserve + pools[subsystem]
  const next = Math.max(0, Math.min(targetLevel, available, maxLevel))
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

/**
 * The five ship systems combat can knock around. Each maps onto a control
 * the player already uses - warp, the shield/phaser sliders, ordinary
 * movement, and the two sensor scans - rather than introducing anything
 * new to manage. Torpedo tubes will join this list once torpedoes exist.
 */
export type ShipSystem = 'warpDrive' | 'shieldGenerator' | 'phaserArray' | 'impulseEngines' | 'sensors'

const SHIP_SYSTEMS: ShipSystem[] = ['warpDrive', 'shieldGenerator', 'phaserArray', 'impulseEngines', 'sensors']

export const SHIP_SYSTEM_LABEL: Record<ShipSystem, string> = {
  warpDrive: 'Warp drive',
  shieldGenerator: 'Shield generator',
  phaserArray: 'Phaser array',
  impulseEngines: 'Impulse engines',
  sensors: 'Sensors',
}

/** Health, 0-100, for each ship system - independent of the energy pools above and of any single encounter's hull. */
export type SubsystemHealth = Record<ShipSystem, number>

export function fullSubsystemHealth(): SubsystemHealth {
  return { warpDrive: 100, shieldGenerator: 100, phaserArray: 100, impulseEngines: 100, sensors: 100 }
}

/** Fraction of full capability a system still delivers at this health, in [0, 1] - 0 means fully offline. */
export function systemEfficiency(health: number): number {
  return Math.max(0, Math.min(100, health)) / 100
}

/** Below this, a system reads as struggling rather than merely "not full" - matches the yellow alert threshold. */
export const DEGRADED_SYSTEM_THRESHOLD = 50

/** Annunciator color class for a system readout at this health - shared by Engineering's and Sciences' status rows. */
export function systemAnnunciatorClass(health: number): string {
  if (health <= 0) return 'annunciator annunciator--red'
  if (health < DEGRADED_SYSTEM_THRESHOLD) return 'annunciator annunciator--yellow'
  return 'annunciator annunciator--green'
}

/**
 * Cost multiplier for a degraded system driving an energy cost (moving,
 * scanning, engaging warp): 1x at full health, up to 2x fully offline. A
 * cap rather than a hard cutoff, so a battered system still works, just
 * expensively, instead of stranding the player outright the moment
 * something takes a hit.
 */
export function degradedCostMultiplier(health: number): number {
  return 2 - systemEfficiency(health)
}

export interface SubsystemWearResult {
  subsystems: SubsystemHealth
  /** Which system took the hit, or null if there was no hull damage to convert. */
  damagedSystem: ShipSystem | null
}

/**
 * Damage taken to the hull during a kill-phase encounter also wears down
 * one randomly-chosen system, by the same amount - a stray hit knocks
 * something offline rather than always denting the same plating. One
 * system per encounter (not per shot fired) keeps this an occasional,
 * noticeable event instead of background noise on every hit.
 */
export function applySubsystemWear(
  subsystems: SubsystemHealth,
  hullDamageTaken: number,
  rng: () => number = Math.random,
): SubsystemWearResult {
  if (hullDamageTaken <= 0) return { subsystems, damagedSystem: null }
  const system = SHIP_SYSTEMS[Math.floor(rng() * SHIP_SYSTEMS.length)]
  const next = { ...subsystems, [system]: Math.max(0, subsystems[system] - hullDamageTaken) }
  return { subsystems: next, damagedSystem: system }
}
