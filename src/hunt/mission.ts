export const STARTING_STARDATE = 2395.0
export const STARDATE_PER_NORMAL_MOVE = 0.1
export const STARDATE_PER_WARP_MOVE = 0.05

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

/**
 * Normal-mode objective: destroy this many hostiles before the mission
 * clock runs out. A fixed number rather than "every hostile the galaxy
 * happened to seed" - simpler to reason about, and doesn't force a full
 * sweep of the map to win. (Survival mode, with no clock or quota, is a
 * distinct mode to add later - not a variation of this one.)
 */
export const HOSTILE_QUOTA = 15

/** Stardates allotted for the whole mission, starting from STARTING_STARDATE. */
export const STARDATE_BUDGET = 20

/** The stardate at which time runs out. */
export const MISSION_DEADLINE = STARTING_STARDATE + STARDATE_BUDGET

export type MissionStatus = 'active' | 'victory' | 'defeat'

/**
 * Victory is checked before defeat: reaching the quota on the very move
 * that would otherwise have run out the clock still counts as a win, not
 * a photo finish going the other way.
 */
export function missionStatus(hostilesDestroyed: number, stardate: number): MissionStatus {
  if (hostilesDestroyed >= HOSTILE_QUOTA) return 'victory'
  if (stardate >= MISSION_DEADLINE) return 'defeat'
  return 'active'
}

/** Stardates left before the mission clock runs out, floored at 0 for display. */
export function stardateRemaining(stardate: number): number {
  return Math.max(0, MISSION_DEADLINE - stardate)
}
