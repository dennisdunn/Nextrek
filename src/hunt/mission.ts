import {
  HOSTILE_QUOTA,
  MISSION_SCORE_MAX,
  STARDATE_BUDGET,
  STARDATE_PER_NORMAL_MOVE,
  STARDATE_PER_WARP_MOVE,
  STARTING_STARDATE,
} from '../balance'

export { HOSTILE_QUOTA, STARDATE_BUDGET, STARDATE_PER_NORMAL_MOVE, STARDATE_PER_WARP_MOVE, STARTING_STARDATE }

/** Time cost of a single hop - warp is faster, not just cheaper in energy. */
export function stardateCost(warpEngaged: boolean): number {
  return warpEngaged ? STARDATE_PER_WARP_MOVE : STARDATE_PER_NORMAL_MOVE
}

export type AlertLevel = 'green' | 'yellow' | 'red'

/** Tactical annunciator: red in a hostile sector, yellow if one is sensed nearby, green otherwise. */
export function tacticalAlert(hostileHere: boolean, sensedNearbyCount: number): AlertLevel {
  if (hostileHere) return 'red'
  if (sensedNearbyCount > 0) return 'yellow'
  return 'green'
}

/** The stardate at which time runs out, at the default (normal-difficulty) quota/budget. */
export const MISSION_DEADLINE = STARTING_STARDATE + STARDATE_BUDGET

/** The quota/budget a mission is actually running with - varies by difficulty (see balance.ts's DIFFICULTY_PRESETS). */
export interface MissionConfig {
  hostileQuota: number
  stardateBudget: number
}

export const DEFAULT_MISSION_CONFIG: MissionConfig = { hostileQuota: HOSTILE_QUOTA, stardateBudget: STARDATE_BUDGET }

/** The stardate at which time runs out for a given mission config. */
export function missionDeadline(config: MissionConfig = DEFAULT_MISSION_CONFIG): number {
  return STARTING_STARDATE + config.stardateBudget
}

export type MissionStatus = 'active' | 'victory' | 'defeat'

/**
 * Victory is checked before defeat: reaching the quota on the very move
 * that would otherwise have run out the clock still counts as a win, not
 * a photo finish going the other way.
 */
export function missionStatus(
  hostilesDestroyed: number,
  stardate: number,
  config: MissionConfig = DEFAULT_MISSION_CONFIG,
): MissionStatus {
  if (hostilesDestroyed >= config.hostileQuota) return 'victory'
  if (stardate >= missionDeadline(config)) return 'defeat'
  return 'active'
}

/** Stardates left before the mission clock runs out, floored at 0 for display. */
export function stardateRemaining(stardate: number, config: MissionConfig = DEFAULT_MISSION_CONFIG): number {
  return Math.max(0, missionDeadline(config) - stardate)
}

/** Which way a defeat happened - drives which message the end screen shows. */
export type DefeatReason = 'timeout' | 'stranded' | 'destroyed'

/**
 * True once no combination of reserve, shields, and phasers can cover even
 * the cheapest possible move - shields/phasers energy is reclaimable back
 * to reserve at full value outside combat (see subsystems.ts's allocate),
 * so it's the *combined* total that has to run dry, not reserve alone.
 * Unrecoverable: moving is the only thing that can ever change the
 * situation, and moving is exactly what this rules out.
 */
export function isStranded(totalEnergy: number, cheapestMoveCost: number): boolean {
  return totalEnergy < cheapestMoveCost
}

/** What's left of each spendable resource at the moment a mission ends - see missionScore. */
export interface MissionResources {
  /** Reserve + shields + phasers combined - see isStranded's note on why the combined total is what matters. */
  energyRemaining: number
  startingEnergy: number
  torpedoesRemaining: number
  startingTorpedoes: number
}

function clamp01(fraction: number): number {
  return Math.max(0, Math.min(1, fraction))
}

/**
 * A post-mission performance readout for a victory (see EndScreen.tsx) -
 * not a gameplay mechanic itself, unlike everything else in this file, so
 * it takes its inputs flattened rather than a MissionConfig. Equally
 * weighted across the three things a player was told mattered: hostiles
 * destroyed relative to quota (uncapped - going past quota costs real
 * time and resources, so it isn't a free way to inflate this), time spent
 * relative to budget, and energy/torpedoes still in hand relative to what
 * the mission started with (each clamped to [0, 1] - unlike the hostile
 * count, a budget can't meaningfully be "under-spent" past 100%).
 *
 * `scoreMultiplier` (the active difficulty's own, from balance.ts's
 * DIFFICULTY_PRESETS - defaults to 1, Normal's own multiplier) is applied
 * last, over the whole average - the same relative performance (e.g. a
 * clean win right at quota) reads higher on Hard than on Easy, rewarding
 * the harder mission rather than just the raw play.
 */
export function missionScore(
  hostilesDestroyed: number,
  hostileQuota: number,
  stardate: number,
  stardateBudget: number,
  resources: MissionResources,
  scoreMultiplier = 1,
): number {
  const hostileFactor = hostileQuota > 0 ? hostilesDestroyed / hostileQuota : 1
  const stardateUsed = stardate - STARTING_STARDATE
  const timeFactor = clamp01(1 - stardateUsed / stardateBudget)
  const energyFactor = clamp01(resources.energyRemaining / resources.startingEnergy)
  const torpedoFactor =
    resources.startingTorpedoes > 0 ? clamp01(resources.torpedoesRemaining / resources.startingTorpedoes) : 1
  const resourceFactor = (energyFactor + torpedoFactor) / 2
  return Math.round(((hostileFactor + timeFactor + resourceFactor) / 3) * MISSION_SCORE_MAX * scoreMultiplier)
}
