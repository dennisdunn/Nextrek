import { describe, expect, it } from 'vitest'
import { buildGridEdges, gridNodeId } from './gridTopology'

function neighborsOf(edges: ReturnType<typeof buildGridEdges>, from: string): string[] {
  return edges.filter((e) => e.from === from).map((e) => e.to).sort()
}

describe('buildGridEdges - flat, Von Neumann', () => {
  const edges = buildGridEdges({ width: 3, height: 3, neighborhood: 'vonNeumann' })

  it('a corner has two orthogonal neighbors', () => {
    expect(neighborsOf(edges, gridNodeId(0, 0)).sort()).toEqual(
      [gridNodeId(1, 0), gridNodeId(0, 1)].sort(),
    )
  })

  it('the center has four orthogonal neighbors', () => {
    expect(neighborsOf(edges, gridNodeId(1, 1)).sort()).toEqual(
      [gridNodeId(0, 1), gridNodeId(2, 1), gridNodeId(1, 0), gridNodeId(1, 2)].sort(),
    )
  })

  it('does not wrap past the boundary', () => {
    expect(neighborsOf(edges, gridNodeId(0, 0))).not.toContain(gridNodeId(2, 0))
  })
})

describe('buildGridEdges - toroidal, Moore', () => {
  const edges = buildGridEdges({
    width: 3,
    height: 3,
    wrapX: true,
    wrapY: true,
    neighborhood: 'moore',
  })

  it('every cell has all eight neighbors, wrapping at the edges', () => {
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(neighborsOf(edges, gridNodeId(x, y)).length).toBe(8)
      }
    }
  })

  it('a corner wraps to the opposite corner diagonally', () => {
    expect(neighborsOf(edges, gridNodeId(0, 0))).toContain(gridNodeId(2, 2))
  })
})

describe('buildGridEdges - single-axis wrap (cylinder)', () => {
  const edges = buildGridEdges({
    width: 4,
    height: 3,
    wrapX: true,
    wrapY: false,
    neighborhood: 'vonNeumann',
  })

  it('wraps around the x axis', () => {
    expect(neighborsOf(edges, gridNodeId(0, 1))).toContain(gridNodeId(3, 1))
  })

  it('does not wrap the y axis', () => {
    expect(neighborsOf(edges, gridNodeId(0, 0))).not.toContain(gridNodeId(0, 2))
  })
})
