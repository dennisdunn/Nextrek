export const STARTING_ENERGY = 1000
export const MOVE_COST_NORMAL = 10
export const MOVE_COST_WARP = 4
export const WARP_ENGAGE_COST = 50

/** Energy for one hop under the current drive mode - warp is cheaper per hop despite reaching further. */
export function moveCost(warpEngaged: boolean): number {
  return warpEngaged ? MOVE_COST_WARP : MOVE_COST_NORMAL
}

// Long-range sensors sweep every adjacent sector at once, so scanning
// under warp (up to 8 neighbors) costs more than under impulse (up to 4) -
// flat costs rather than "per sector scanned" so a sector at the rim or
// pole (fewer neighbors either way) doesn't get a cheaper scan by accident.
export const LRS_COST_IMPULSE = 15
export const LRS_COST_WARP = 30

/** Subspace scans are exotic-physics sensing, pricier than ordinary LRS by this multiplier. */
export const SUBSPACE_SCAN_MULTIPLIER = 2

export function longRangeScanCost(warpEngaged: boolean): number {
  return warpEngaged ? LRS_COST_WARP : LRS_COST_IMPULSE
}

export function subspaceScanCost(warpEngaged: boolean): number {
  return longRangeScanCost(warpEngaged) * SUBSPACE_SCAN_MULTIPLIER
}

export function canAfford(energy: number, cost: number): boolean {
  return energy >= cost
}
