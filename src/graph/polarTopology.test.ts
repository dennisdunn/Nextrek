import { describe, expect, it } from 'vitest'
import { gridNodeId } from './gridTopology'
import { buildPolarGridEdges } from './polarTopology'

function neighborsOf(edges: ReturnType<typeof buildPolarGridEdges>, id: string): string[] {
  return edges.filter((e) => e.from === id).map((e) => e.to)
}

describe('buildPolarGridEdges', () => {
  it('at equal resolution, reduces to the classic Moore radius+-1/angle+-1 neighborhood', () => {
    // Three equal-resolution rings of 8 - a sector should see its two
    // same-ring neighbors, plus 3 in each adjacent ring (direct + 2 diagonal).
    const edges = buildPolarGridEdges([8, 8, 8])
    const middle = neighborsOf(edges, gridNodeId(4, 1)).sort()
    expect(middle).toEqual(
      [
        gridNodeId(3, 1),
        gridNodeId(5, 1), // same ring
        gridNodeId(3, 0),
        gridNodeId(4, 0),
        gridNodeId(5, 0), // ring in
        gridNodeId(3, 2),
        gridNodeId(4, 2),
        gridNodeId(5, 2), // ring out
      ].sort(),
    )
  })

  it('wraps angularly within a ring', () => {
    const edges = buildPolarGridEdges([8])
    expect(neighborsOf(edges, gridNodeId(0, 0)).sort()).toEqual([gridNodeId(1, 0), gridNodeId(7, 0)].sort())
  })

  it('never wraps radially - the innermost ring has no inward neighbors, the outermost none outward', () => {
    const edges = buildPolarGridEdges([8, 8])
    const innerNeighbors = neighborsOf(edges, gridNodeId(0, 0))
    expect(innerNeighbors.every((id) => !id.endsWith(',1'))).toBe(false) // does have ring-1 (outward) neighbors
    expect(innerNeighbors.some((id) => id.endsWith(',-1'))).toBe(false) // never a ring -1
  })

  it('a coarse sector reaches every finer sector under it, plus one across each edge', () => {
    // 4 -> 16 (k=4): quadrant 0 spans fine regions 0-3 directly, plus the
    // fine sectors just across each of its two angular edges (15 and 4) -
    // plus its own same-ring neighbors (1 and 3, wrapping mod 4).
    const edges = buildPolarGridEdges([4, 16])
    const all = neighborsOf(edges, gridNodeId(0, 0)).sort()
    expect(all).toEqual(
      [
        gridNodeId(1, 0),
        gridNodeId(3, 0),
        gridNodeId(15, 1),
        gridNodeId(0, 1),
        gridNodeId(1, 1),
        gridNodeId(2, 1),
        gridNodeId(3, 1),
        gridNodeId(4, 1),
      ].sort(),
    )
  })

  it('the fan-out is symmetric - every fine sector it reaches points back at it', () => {
    const edges = buildPolarGridEdges([4, 16])
    for (const fine of [15, 0, 1, 2, 3, 4]) {
      expect(neighborsOf(edges, gridNodeId(fine, 1))).toContain(gridNodeId(0, 0))
    }
  })

  it('a 16 -> 32 boundary (k=2) gives each coarse sector exactly 4 outward neighbors', () => {
    const edges = buildPolarGridEdges([16, 32])
    // coarse region 0 spans fine 0-1, plus one across each edge (31, 2) -
    // plus its own same-ring neighbors (1 and 15, wrapping mod 16).
    expect(neighborsOf(edges, gridNodeId(0, 0)).sort()).toEqual(
      [
        gridNodeId(1, 0),
        gridNodeId(15, 0),
        gridNodeId(31, 1),
        gridNodeId(0, 1),
        gridNodeId(1, 1),
        gridNodeId(2, 1),
      ].sort(),
    )
  })

  it('never produces a duplicate edge', () => {
    const edges = buildPolarGridEdges([4, 16, 16, 32, 32, 32])
    const seen = new Set<string>()
    for (const e of edges) {
      const key = `${e.from}->${e.to}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('throws on a non-integer resolution ratio between adjacent rings', () => {
    expect(() => buildPolarGridEdges([8, 12])).toThrow()
  })

  it('the full six-ring profile has no isolated sector', () => {
    const sectorsPerRing = [4, 16, 16, 32, 32, 32]
    const edges = buildPolarGridEdges(sectorsPerRing)
    for (let ring = 0; ring < sectorsPerRing.length; ring++) {
      for (let region = 0; region < sectorsPerRing[ring]; region++) {
        expect(neighborsOf(edges, gridNodeId(region, ring)).length).toBeGreaterThan(0)
      }
    }
  })
})
