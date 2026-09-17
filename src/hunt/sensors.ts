import type { NodeId } from '../graph/UndoGraph'
import type { Galaxy } from './galaxy'
import { impulseNeighbors } from './galaxy'

/**
 * Sectors the player has real information about on the strategic map:
 * everywhere they've physically been, plus wherever a long-range scan has
 * reached. Unlike the old model, being merely adjacent to a sector no
 * longer reveals it for free - a long-range scan is a deliberate, costed
 * action (see ship.ts's LRS costs and useGalaxy's longRangeScan()).
 */
export function knownSectors(visited: ReadonlySet<NodeId>, scanned: ReadonlySet<NodeId>): Set<NodeId> {
  return new Set([...visited, ...scanned])
}

/**
 * Neighboring sectors whose sensors read hostile - a passive proximity
 * warning (the tactical alert), free of charge and always short-range
 * (the grid's physical adjacency), regardless of whether warp happens to
 * be engaged. Warp's reach can span dozens of sectors (see
 * warpNetwork.ts); if this used the graph's *current* edges it would
 * silently give away a huge free-and-passive sensor radius the moment
 * warp engages, on top of the deliberate, costed long-range scan that's
 * supposed to be the way you extend your reach that far.
 */
export function sensedHostiles(galaxy: Galaxy, position: NodeId): NodeId[] {
  return impulseNeighbors(position).filter((id) => galaxy.getNode(id)?.hostile)
}

/**
 * Neighboring sectors carrying an undiscovered subspace anomaly - the
 * Wumpus-style "you feel a breeze" trigger. Same short-range,
 * warp-independent reasoning as sensedHostiles: it only tells you
 * *something* is nearby, never which neighbor or what kind - that takes
 * an explicit, costed subspace scan.
 */
export function sensedAnomalies(galaxy: Galaxy, position: NodeId): NodeId[] {
  return impulseNeighbors(position).filter((id) => galaxy.getNode(id)?.anomaly)
}
