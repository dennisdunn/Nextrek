import { describe, expect, it } from 'vitest'
import type { Edge } from '../graph/UndoGraph'
import { applyAnomalyPlacements, pickAnomalyPlacements } from './anomalySeeding'

const IDS = ['a', 'b', 'c', 'd']

/** A ring topology: a-b-c-d-a, each bidirectionally adjacent to its neighbors only. */
function ringNeighbors(id: string): string[] {
  const i = IDS.indexOf(id)
  return [IDS[(i + 1) % IDS.length], IDS[(i - 1 + IDS.length) % IDS.length]]
}

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('pickAnomalyPlacements', () => {
  it('places nothing at density 0', () => {
    const placements = pickAnomalyPlacements(IDS, 'a', 0, () => 0, ringNeighbors)
    expect(placements.size).toBe(0)
  })

  it('never places an anomaly on the excluded (home) sector', () => {
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0]), ringNeighbors)
    expect(placements.has('a')).toBe(false)
  })

  it('places a barrier with no link when the roll picks that kind', () => {
    // rng sequence per candidate: [density-check, kind-pick]; 0.3 * 4 = 1 -> KINDS[1] = 'barrier'
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.3]), ringNeighbors)
    expect(placements.get('b')).toEqual({ kind: 'barrier' })
  })

  it('places a chamber whose link is a real neighbor', () => {
    // 0 * 4 = 0 -> KINDS[0] = 'chamber'; then neighbor-pick index 0
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0]), ringNeighbors)
    const placement = placements.get('b')
    expect(placement?.kind).toBe('chamber')
    expect(ringNeighbors('b')).toContain(placement?.link)
  })

  it('places a conduit whose link is NOT already a neighbor', () => {
    // 0.6 * 4 = 2.4 -> KINDS[2] = 'conduit'
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.6, 0]), ringNeighbors)
    const placement = placements.get('b')
    expect(placement?.kind).toBe('conduit')
    expect(ringNeighbors('b')).not.toContain(placement?.link)
    expect(placement?.link).not.toBe('b')
  })

  it('places a gate whose link is NOT already a neighbor', () => {
    // 0.9 * 4 = 3.6 -> KINDS[3] = 'gate'
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.9, 0]), ringNeighbors)
    const placement = placements.get('b')
    expect(placement?.kind).toBe('gate')
    expect(ringNeighbors('b')).not.toContain(placement?.link)
  })

  it('never links a conduit/gate to the excluded (home) sector', () => {
    // conduit kind, and the candidate-index roll would pick 'a' (home) if it weren't excluded
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.6, 0]), ringNeighbors)
    for (const placement of placements.values()) {
      expect(placement.link).not.toBe('a')
    }
  })

  it('skips a candidate entirely when the density roll fails', () => {
    // density 0.5: rng 0.9 fails the roll (0.9 >= 0.5) so nothing is placed for any id
    const placements = pickAnomalyPlacements(IDS, 'a', 0.5, scripted([0.9]), ringNeighbors)
    expect(placements.size).toBe(0)
  })
})

describe('applyAnomalyPlacements', () => {
  const ring = (): Edge<undefined>[] => [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'a' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'b' },
    { from: 'c', to: 'd' },
    { from: 'd', to: 'c' },
  ]

  it('leaves the edges untouched when there are no placements', () => {
    const edges = ring()
    expect(applyAnomalyPlacements(edges, new Map())).toEqual(edges)
  })

  it('leaves a barrier sector fully connected - it stays dormant until a subspace scan activates it', () => {
    const edges = ring()
    const next = applyAnomalyPlacements(edges, new Map([['c', { kind: 'barrier' as const }]]))
    expect(next).toEqual(edges)
  })

  it('chamber removes the return edge and reuses the existing forward edge (no duplicate)', () => {
    const next = applyAnomalyPlacements(ring(), new Map([['c', { kind: 'chamber' as const, link: 'b' }]]))
    expect(next.filter((e) => e.from === 'b' && e.to === 'c').length).toBe(1)
    expect(next.some((e) => e.from === 'c' && e.to === 'b')).toBe(false)
    // c's other exit is untouched
    expect(next.some((e) => e.from === 'c' && e.to === 'd')).toBe(true)
  })

  it('conduit adds both directions between distant sectors', () => {
    const next = applyAnomalyPlacements(ring(), new Map([['a', { kind: 'conduit' as const, link: 'd' }]]))
    expect(next.some((e) => e.from === 'a' && e.to === 'd')).toBe(true)
    expect(next.some((e) => e.from === 'd' && e.to === 'a')).toBe(true)
  })

  it('gate adds only the one direction', () => {
    const next = applyAnomalyPlacements(ring(), new Map([['a', { kind: 'gate' as const, link: 'd' }]]))
    expect(next.some((e) => e.from === 'a' && e.to === 'd')).toBe(true)
    expect(next.some((e) => e.from === 'd' && e.to === 'a')).toBe(false)
  })

  it('applies multiple placements independently', () => {
    const next = applyAnomalyPlacements(
      ring(),
      new Map([
        ['c', { kind: 'barrier' as const }],
        ['a', { kind: 'gate' as const, link: 'd' }],
      ]),
    )
    // barrier is dormant (no edge change) - only the gate's shortcut shows up
    expect(next.some((e) => e.from === 'c')).toBe(true)
    expect(next.some((e) => e.from === 'a' && e.to === 'd')).toBe(true)
  })
})
