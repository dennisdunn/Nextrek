import { describe, expect, it } from 'vitest'
import type { Edge } from '../graph/UndoGraph'
import { buildWarpEdges, type GalaxyEdgeData } from './warpNetwork'

const IDS = ['a', 'b', 'c', 'd', 'e']

/** A chain a-b-c-d-e, bidirectionally adjacent to its immediate neighbor only. */
function chainEdges(): Edge<unknown>[] {
  const edges: Edge<unknown>[] = []
  for (let i = 0; i < IDS.length - 1; i++) {
    edges.push({ from: IDS[i], to: IDS[i + 1] })
    edges.push({ from: IDS[i + 1], to: IDS[i] })
  }
  return edges
}

function edgesFrom(edges: Edge<GalaxyEdgeData>[], id: string) {
  return edges.filter((e) => e.from === id)
}

describe('buildWarpEdges', () => {
  it('at radius 1, reproduces the base adjacency with distance 1', () => {
    const warp = buildWarpEdges(chainEdges(), IDS, 1)
    const fromB = edgesFrom(warp, 'b')
    expect(fromB.map((e) => e.to).sort()).toEqual(['a', 'c'])
    for (const e of fromB) expect(e.data!.distance).toBe(1)
  })

  it('at radius 2, reaches two hops out with the correct distance', () => {
    const warp = buildWarpEdges(chainEdges(), IDS, 2)
    const fromA = edgesFrom(warp, 'a')
    expect(fromA.map((e) => e.to).sort()).toEqual(['b', 'c'])
    expect(fromA.find((e) => e.to === 'b')?.data?.distance).toBe(1)
    expect(fromA.find((e) => e.to === 'c')?.data?.distance).toBe(2)
  })

  it('from the middle of the chain, radius 2 reaches every other node', () => {
    const warp = buildWarpEdges(chainEdges(), IDS, 2)
    const fromC = edgesFrom(warp, 'c')
    expect(fromC.map((e) => e.to).sort()).toEqual(['a', 'b', 'd', 'e'])
  })

  it('never includes a self-edge', () => {
    const warp = buildWarpEdges(chainEdges(), IDS, 3)
    expect(warp.some((e) => e.from === e.to)).toBe(false)
  })

  it('an isolated node (no base edges) gets no warp edges at all', () => {
    const warp = buildWarpEdges([], IDS, 3)
    expect(warp.length).toBe(0)
  })

  it('respects a mutated topology - a removed edge shortens reach accordingly', () => {
    // strip d's only link back to c, simulating a barrier-style anomaly
    const mutated = chainEdges().filter((e) => !(e.from === 'd' && e.to === 'c'))
    const warp = buildWarpEdges(mutated, IDS, 3)
    // d can still reach forward to e, but never back toward a/b/c
    expect(edgesFrom(warp, 'd').map((e) => e.to).sort()).toEqual(['e'])
  })
})
