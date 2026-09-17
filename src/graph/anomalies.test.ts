import { describe, expect, it } from 'vitest'
import { UndoGraph } from './UndoGraph'
import { barrier, chamber, conduit, gate } from './anomalies'

function ring(): UndoGraph<undefined, undefined> {
  return new UndoGraph(
    [
      ['a', undefined],
      ['b', undefined],
      ['c', undefined],
      ['d', undefined],
    ],
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'b' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'c' },
    ],
  )
}

describe('chamber', () => {
  it('adds a one-way entry and removes the return edge', () => {
    const g = ring()
    chamber(g, 'a', 'c')
    expect(g.neighbors('a').sort()).toEqual(['b', 'c'])
    // c can no longer get back to a, but its other exits still work
    expect(g.neighbors('c').sort()).toEqual(['b', 'd'])
  })

  it('reuses an existing edge instead of adding a duplicate when entry and target are already adjacent', () => {
    const g = ring()
    chamber(g, 'b', 'c') // b->c already exists in the ring
    const forwardEdges = g.edges.filter((e) => e.from === 'b' && e.to === 'c')
    expect(forwardEdges.length).toBe(1)
    expect(g.neighbors('c')).toEqual(['d'])
  })

  it('undoes as a single step', () => {
    const g = ring()
    const depthBefore = g.undoDepth
    chamber(g, 'a', 'c')
    expect(g.undoDepth).toBe(depthBefore + 1)
    g.undo()
    expect(g.neighbors('a')).toEqual(['b'])
    expect(g.neighbors('c').sort()).toEqual(['b', 'd'])
  })
})

describe('barrier', () => {
  it('strips every incoming edge to the walled-off node', () => {
    const g = ring()
    barrier(g, 'c')
    // nobody can route into c any more
    expect(g.neighbors('b')).toEqual(['a'])
    expect(g.neighbors('d')).toEqual([])
    // c's own outgoing edges are untouched - it can still leave, just never be re-entered
    expect(g.neighbors('c').sort()).toEqual(['b', 'd'])
  })

  it('undo restores the stripped edges', () => {
    const g = ring()
    barrier(g, 'c')
    g.undo()
    expect(g.neighbors('b').sort()).toEqual(['a', 'c'])
    expect(g.neighbors('d')).toEqual(['c'])
  })
})

describe('conduit', () => {
  it('links two distant nodes bidirectionally', () => {
    const g = ring()
    conduit(g, 'a', 'd')
    expect(g.neighbors('a')).toContain('d')
    expect(g.neighbors('d')).toContain('a')
  })

  it('does not duplicate a direction that is already adjacent', () => {
    const g = ring()
    conduit(g, 'a', 'b') // a<->b already exists in the ring
    expect(g.edges.filter((e) => e.from === 'a' && e.to === 'b').length).toBe(1)
    expect(g.edges.filter((e) => e.from === 'b' && e.to === 'a').length).toBe(1)
  })

  it('undoes both edges in one call', () => {
    const g = ring()
    const depthBefore = g.undoDepth
    conduit(g, 'a', 'd')
    expect(g.undoDepth).toBe(depthBefore + 1)
    g.undo()
    expect(g.neighbors('a')).not.toContain('d')
    expect(g.neighbors('d')).not.toContain('a')
  })
})

describe('gate', () => {
  it('links two nodes in one direction only', () => {
    const g = ring()
    gate(g, 'a', 'd')
    expect(g.neighbors('a')).toContain('d')
    expect(g.neighbors('d')).not.toContain('a')
  })

  it('is a no-op (nothing to undo) if the edge already exists', () => {
    const g = ring()
    const depthBefore = g.undoDepth
    gate(g, 'a', 'b') // a->b already exists in the ring
    expect(g.undoDepth).toBe(depthBefore)
    expect(g.edges.filter((e) => e.from === 'a' && e.to === 'b').length).toBe(1)
  })

  it('undo removes the shortcut', () => {
    const g = ring()
    gate(g, 'a', 'd')
    g.undo()
    expect(g.neighbors('a')).not.toContain('d')
  })
})
