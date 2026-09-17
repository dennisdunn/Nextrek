import type { NodeId } from '../graph/UndoGraph'

export interface GateDestinationOptions {
  /** Home never receives a gate's redirect. */
  home: NodeId
  /** Wherever the ship was standing just before it walked into the gate. */
  departedFrom: NodeId
  /** That sector's immediate neighbors - a "random" jump one step away wouldn't feel like one. */
  nearbyDeparted: readonly NodeId[]
  /** A gate never chains into a second hazard. */
  hasAnomaly: (id: NodeId) => boolean
}

/**
 * Where a gate anomaly flings the ship - Blackhole Assisted Traversal, the
 * Wumpus-bats equivalent. Pure and deterministic given `rng`, excluding
 * home, wherever the ship just came from, that sector's immediate
 * neighbors, and any other anomaly sector. Returns undefined if nothing
 * qualifies (a vanishingly unlikely, tiny-galaxy edge case).
 */
export function pickGateDestination(
  allIds: readonly NodeId[],
  options: GateDestinationOptions,
  rng: () => number,
): NodeId | undefined {
  const excluded = new Set([options.home, options.departedFrom, ...options.nearbyDeparted])
  const candidates = allIds.filter((id) => !excluded.has(id) && !options.hasAnomaly(id))
  if (candidates.length === 0) return undefined
  return candidates[Math.floor(rng() * candidates.length)]
}
