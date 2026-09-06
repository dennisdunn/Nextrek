export const STARTING_ENERGY = 1000
export const MOVE_COST_NORMAL = 10
export const MOVE_COST_WARP = 4
export const WARP_ENGAGE_COST = 50

/** Energy for one hop under the current drive mode - warp is cheaper per hop despite reaching further. */
export function moveCost(warpEngaged: boolean): number {
  return warpEngaged ? MOVE_COST_WARP : MOVE_COST_NORMAL
}

export function canAfford(energy: number, cost: number): boolean {
  return energy >= cost
}
