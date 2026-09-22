import type { Edge } from './UndoGraph'
import { gridNodeId } from './gridTopology'

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size
}

function pushBothWays(edges: Edge<undefined>[], ringA: number, regionA: number, ringB: number, regionB: number): void {
  edges.push({ from: gridNodeId(regionA, ringA), to: gridNodeId(regionB, ringB) })
  edges.push({ from: gridNodeId(regionB, ringB), to: gridNodeId(regionA, ringA) })
}

/**
 * Build Moore-neighborhood edges for a polar grid where each ring can have
 * a different angular resolution, as long as every pair of radially
 * adjacent rings has an integer resolution ratio - one ring's sector count
 * evenly divides the other's (see cartography.ts's sectorsInRing, which
 * only ever produces values a fixed multiple/divisor of the baseline, so
 * this always holds there). Always wraps angularly (it's a full circle),
 * never radially (there's no ring before the innermost or after the
 * outermost).
 *
 * Two sectors in the same ring are neighbors if they're adjacent in that
 * ring's own angular order. Two sectors in adjacent rings are neighbors if
 * their angular ranges touch at all: the coarser sector's exact span
 * (however many finer sectors that covers) plus the one finer sector just
 * across each of its two edges - what a Moore diagonal degenerates into
 * once the two rings don't share a resolution. At equal resolution this
 * reduces exactly to the classic radius+-1-and-angle+-1 diagonal pair.
 */
export function buildPolarGridEdges(sectorsPerRing: readonly number[]): Edge<undefined>[] {
  const edges: Edge<undefined>[] = []

  // Same-ring (angular) neighbors.
  for (let ring = 0; ring < sectorsPerRing.length; ring++) {
    const count = sectorsPerRing[ring]
    for (let region = 0; region < count; region++) {
      const from = gridNodeId(region, ring)
      edges.push({ from, to: gridNodeId(wrap(region + 1, count), ring) })
      edges.push({ from, to: gridNodeId(wrap(region - 1, count), ring) })
    }
  }

  // Cross-ring (radial + diagonal) neighbors, one ring boundary at a time.
  for (let ring = 0; ring < sectorsPerRing.length - 1; ring++) {
    const innerCount = sectorsPerRing[ring]
    const outerCount = sectorsPerRing[ring + 1]
    const coarseIsInner = innerCount <= outerCount
    const coarseCount = coarseIsInner ? innerCount : outerCount
    const fineCount = coarseIsInner ? outerCount : innerCount
    const coarseRing = coarseIsInner ? ring : ring + 1
    const fineRing = coarseIsInner ? ring + 1 : ring

    if (fineCount % coarseCount !== 0) {
      throw new Error(
        `polar topology requires an integer resolution ratio between adjacent rings ${ring} and ${ring + 1} (got ${innerCount} and ${outerCount})`,
      )
    }
    const k = fineCount / coarseCount

    for (let fine = 0; fine < fineCount; fine++) {
      const parent = Math.floor(fine / k)
      pushBothWays(edges, coarseRing, parent, fineRing, fine)
      if (fine % k === 0) {
        const prevFine = wrap(fine - 1, fineCount)
        const prevParent = wrap(parent - 1, coarseCount)
        pushBothWays(edges, coarseRing, prevParent, fineRing, fine)
        pushBothWays(edges, coarseRing, parent, fineRing, prevFine)
      }
    }
  }

  return edges
}
