export const STARTING_ENERGY = 1000
export const MOVE_COST_NORMAL = 10
export const WARP_ENGAGE_COST = 50

/** Torpedoes are a physical inventory, not energy - a limited, game-wide supply, replenished only at a starbase. */
export const STARTING_TORPEDOES = 10

// A warp jump's cost scales with how far it actually travels (in impulse-
// hop distance - see warpNetwork.ts): a flat per-jump base plus a rate per
// sector covered. That keeps a 1-sector warp hop pointless (base cost
// alone already exceeds one impulse move) while a jump near the edge of
// warp's radius is clearly worth it over several impulse hops.
export const WARP_MOVE_BASE_COST = 8
export const WARP_MOVE_COST_PER_SECTOR = 6

/** Energy for one hop. `distance` (impulse-hop count) only matters under warp - an impulse move is always distance 1. */
export function moveCost(warpEngaged: boolean, distance: number = 1): number {
  return warpEngaged ? WARP_MOVE_BASE_COST + WARP_MOVE_COST_PER_SECTOR * distance : MOVE_COST_NORMAL
}

// Long-range sensors sweep every sector reachable in one hop under the
// current drive mode - warp's radius reaches far more sectors than
// impulse's immediate 8, so a warp scan costs proportionately more. Flat
// costs rather than "per sector scanned" so a sector at the rim or pole
// (fewer neighbors either way) doesn't get a cheaper scan by accident.
export const LRS_COST_IMPULSE = 15
export const LRS_COST_WARP = 70

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
