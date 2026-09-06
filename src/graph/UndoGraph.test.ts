import { describe, expect, it } from 'vitest'
import { UndoGraph } from './UndoGraph'

describe('UndoGraph nodes', () => {
  it('starts with the seeded node set at the top of the stack', () => {
    const g = new UndoGraph<{ name: string }>([['a', { name: 'Alpha' }]])
    expect(g.hasNode('a')).toBe(true)
    expect(g.getNode('a')).toEqual({ name: 'Alpha' })
    expect(g.nodes.size).toBe(1)
  })

  it('setNode pushes a new snapshot without mutating the previous one', () => {
    const g = new UndoGraph<{ hp: number }>([['a', { hp: 10 }]])
    const before = g.nodes
    g.setNode('a', { hp: 5 })
    expect(g.getNode('a')).toEqual({ hp: 5 })
    expect(before.get('a')).toEqual({ hp: 10 })
    expect(g.undoDepth).toBe(1)
  })

  it('undo restores the prior node snapshot', () => {
    const g = new UndoGraph<{ hp: number }>([['a', { hp: 10 }]])
    g.setNode('a', { hp: 5 })
    expect(g.undo()).toBe(true)
    expect(g.getNode('a')).toEqual({ hp: 10 })
    expect(g.undoDepth).toBe(0)
  })

  it('removeNode / undo round-trips', () => {
    const g = new UndoGraph<{ hp: number }>([['a', { hp: 10 }]])
    g.removeNode('a')
    expect(g.hasNode('a')).toBe(false)
    g.undo()
    expect(g.hasNode('a')).toBe(true)
    expect(g.getNode('a')).toEqual({ hp: 10 })
  })
})

describe('UndoGraph edges', () => {
  it('neighbors reflects the current edge snapshot', () => {
    const g = new UndoGraph<undefined, undefined>([], [{ from: 'a', to: 'b' }])
    expect(g.neighbors('a')).toEqual(['b'])
    expect(g.neighbors('b')).toEqual([])
  })

  it('addEdge / undo round-trips', () => {
    const g = new UndoGraph<undefined, undefined>()
    g.addEdge({ from: 'a', to: 'b' })
    expect(g.neighbors('a')).toEqual(['b'])
    g.undo()
    expect(g.neighbors('a')).toEqual([])
  })

  it('removeEdges / undo round-trips', () => {
    const g = new UndoGraph<undefined, undefined>(
      [],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
    )
    g.removeEdges((e) => e.to === 'b')
    expect(g.neighbors('a')).toEqual(['c'])
    g.undo()
    expect(g.neighbors('a').sort()).toEqual(['b', 'c'])
  })

  it('undo() returns false and no-ops when the undo stack is empty', () => {
    const g = new UndoGraph<undefined, undefined>()
    expect(g.canUndo()).toBe(false)
    expect(g.undo()).toBe(false)
  })

  it('multiple pushes undo in LIFO order', () => {
    const g = new UndoGraph<undefined, undefined>()
    g.addEdge({ from: 'a', to: 'b' })
    g.addEdge({ from: 'a', to: 'c' })
    expect(g.neighbors('a').sort()).toEqual(['b', 'c'])
    g.undo()
    expect(g.neighbors('a')).toEqual(['b'])
    g.undo()
    expect(g.neighbors('a')).toEqual([])
  })
})

describe('UndoGraph transaction', () => {
  it('collapses several pushes into a single undo entry', () => {
    const g = new UndoGraph<undefined, undefined>()
    g.transaction(() => {
      g.addEdge({ from: 'a', to: 'b' })
      g.addEdge({ from: 'b', to: 'a' })
    })
    expect(g.undoDepth).toBe(1)
    expect(g.neighbors('a')).toEqual(['b'])
    expect(g.neighbors('b')).toEqual(['a'])
    g.undo()
    expect(g.neighbors('a')).toEqual([])
    expect(g.neighbors('b')).toEqual([])
    expect(g.undoDepth).toBe(0)
  })

  it('is a no-op wrapper when the mutator makes a single push', () => {
    const g = new UndoGraph<undefined, undefined>()
    g.transaction(() => g.addEdge({ from: 'a', to: 'b' }))
    expect(g.undoDepth).toBe(1)
  })

  it('does not push an undo entry when the mutator makes no changes', () => {
    const g = new UndoGraph<undefined, undefined>()
    g.transaction(() => {})
    expect(g.undoDepth).toBe(0)
  })
})

describe('warp drive scenario', () => {
  // Normal space: a sparse ring of four sectors, each linked to its
  // immediate neighbor only - slow to cross.
  const normalSpaceEdges = [
    { from: 'N', to: 'E' },
    { from: 'E', to: 'S' },
    { from: 'S', to: 'W' },
    { from: 'W', to: 'N' },
  ]

  // Warp space: the same four sectors, fully connected - any sector
  // reachable in a single hop.
  const warpSpaceEdges = [
    { from: 'N', to: 'S' },
    { from: 'S', to: 'N' },
    { from: 'E', to: 'W' },
    { from: 'W', to: 'E' },
    ...normalSpaceEdges,
  ]

  it('engaging warp swaps the edge-set, disengaging pops back to normal space', () => {
    const g = new UndoGraph<undefined, undefined>(
      [
        ['N', undefined],
        ['E', undefined],
        ['S', undefined],
        ['W', undefined],
      ],
      normalSpaceEdges,
    )

    expect(g.neighbors('N')).toEqual(['E'])

    // engage warp drive
    g.replaceEdges(warpSpaceEdges)
    expect(g.neighbors('N').sort()).toEqual(['E', 'S'])

    // disengage warp drive
    expect(g.undo()).toBe(true)
    expect(g.neighbors('N')).toEqual(['E'])
    expect(g.canUndo()).toBe(false)
  })
})
