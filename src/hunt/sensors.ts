import type { NodeId } from '../graph/UndoGraph'
import type { Galaxy } from './galaxy'

/**
 * Sectors the player has real information about: everywhere they've
 * physically been, plus whatever the current position's sensors reach -
 * its immediate neighbors under the graph's current topology (which
 * shrinks or grows as warp is engaged/disengaged). Anything else is
 * unknown - "sense nearby danger", not "see the whole board".
 */
export function knownSectors(
  galaxy: Galaxy,
  position: NodeId,
  visited: ReadonlySet<NodeId>,
): Set<NodeId> {
  const known = new Set(visited)
  known.add(position)
  for (const neighbor of galaxy.neighbors(position)) known.add(neighbor)
  return known
}

/** Neighboring sectors whose sensors read hostile - what "sense danger nearby" surfaces to the player. */
export function sensedHostiles(galaxy: Galaxy, position: NodeId): NodeId[] {
  return galaxy.neighbors(position).filter((id) => galaxy.getNode(id)?.hostile)
}
