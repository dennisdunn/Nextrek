import {
  LRS_COST_IMPULSE,
  LRS_COST_WARP,
  MOVE_COST_NORMAL,
  STARTING_ENERGY,
  STARTING_TORPEDOES,
  SUBSPACE_SCAN_MULTIPLIER,
  WARP_ENGAGE_COST,
  WARP_MOVE_BASE_COST,
  WARP_MOVE_COST_PER_SECTOR,
} from '../balance'

export {
  LRS_COST_IMPULSE,
  LRS_COST_WARP,
  MOVE_COST_NORMAL,
  STARTING_ENERGY,
  STARTING_TORPEDOES,
  SUBSPACE_SCAN_MULTIPLIER,
  WARP_ENGAGE_COST,
  WARP_MOVE_BASE_COST,
  WARP_MOVE_COST_PER_SECTOR,
}

/** Energy for one hop. `distance` (impulse-hop count) only matters under warp - an impulse move is always distance 1. */
export function moveCost(warpEngaged: boolean, distance: number = 1): number {
  return warpEngaged ? WARP_MOVE_BASE_COST + WARP_MOVE_COST_PER_SECTOR * distance : MOVE_COST_NORMAL
}

export function longRangeScanCost(warpEngaged: boolean): number {
  return warpEngaged ? LRS_COST_WARP : LRS_COST_IMPULSE
}

export function subspaceScanCost(warpEngaged: boolean): number {
  return longRangeScanCost(warpEngaged) * SUBSPACE_SCAN_MULTIPLIER
}

export function canAfford(energy: number, cost: number): boolean {
  return energy >= cost
}
