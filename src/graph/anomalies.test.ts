import { describe, expect, it } from 'vitest'
import { UndoGraph } from './UndoGraph'
import { chamber, conduit, gate, well } from './anomalies'

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

describe('well', () => {
  it('strips every outgoing edge from the trap node', () => {
    const g = ring()
    well(g, 'c')
    expect(g.neighbors('c')).toEqual([])
    // incoming edges into the trap are untouched - you can still fall in
    expect(g.neighbors('b').sort()).toEqual(['a', 'c'])
    expect(g.neighbors('d')).toEqual(['c'])
  })

  it('undo restores the stripped edges', () => {
    const g = ring()
    well(g, 'c')
    g.undo()
    expect(g.neighbors('c').sort()).toEqual(['b', 'd'])
  })
})

describe('conduit', () => {
  it('links two distant nodes bidirectionally', () => {
    const g = ring()
    conduit(g, 'a', 'd')
    expect(g.neighbors('a')).toContain('d')
    expect(g.neighbors('d')).toContain('a')
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

  it('undo removes the shortcut', () => {
    const g = ring()
    gate(g, 'a', 'd')
    g.undo()
    expect(g.neighbors('a')).not.toContain('d')
  })
})
