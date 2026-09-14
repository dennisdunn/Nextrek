import type { NodeId } from '../graph/UndoGraph'
import type { Galaxy } from './galaxy'

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
 * warning (the tactical alert), distinct from and free of charge compared
 * to the deliberate long-range scan that fills in the strategic map.
 */
export function sensedHostiles(galaxy: Galaxy, position: NodeId): NodeId[] {
  return galaxy.neighbors(position).filter((id) => galaxy.getNode(id)?.hostile)
}

/**
 * Neighboring sectors carrying an undiscovered subspace anomaly - the
 * Wumpus-style "you feel a breeze" trigger. Like sensedHostiles, this is
 * passive and free; it only tells you *something* is nearby, never which
 * neighbor or what kind - that takes an explicit, costed subspace scan.
 */
export function sensedAnomalies(galaxy: Galaxy, position: NodeId): NodeId[] {
  return galaxy.neighbors(position).filter((id) => galaxy.getNode(id)?.anomaly)
}
