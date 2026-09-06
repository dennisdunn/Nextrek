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
