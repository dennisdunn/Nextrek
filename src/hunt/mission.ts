import { HOSTILE_QUOTA, STARDATE_BUDGET, STARDATE_PER_NORMAL_MOVE, STARDATE_PER_WARP_MOVE, STARTING_STARDATE } from '../balance'

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

/** Which of the two ways a defeat happened - drives which message the end screen shows. */
export type DefeatReason = 'timeout' | 'stranded'

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
