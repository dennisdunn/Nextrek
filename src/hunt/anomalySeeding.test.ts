import { describe, expect, it } from 'vitest'
import type { Edge } from '../graph/UndoGraph'
import { applyAnomalyPlacements, pickAnomalyPlacements } from './anomalySeeding'
import type { GalaxyEdgeData } from './warpNetwork'

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
    // rng sequence per candidate: [density-check, kind-pick]; 0.1 * 3 = 0.3 -> KINDS[0] = 'barrier'
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.1]), ringNeighbors)
    expect(placements.get('b')).toEqual({ kind: 'barrier' })
  })

  it('places a gate with no link when the roll picks that kind', () => {
    // 0.4 * 3 = 1.2 -> KINDS[1] = 'gate'
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.4]), ringNeighbors)
    expect(placements.get('b')).toEqual({ kind: 'gate' })
  })

  it('places a conduit whose link is NOT already a neighbor', () => {
    // 0.7 * 3 = 2.1 -> KINDS[2] = 'conduit'
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.7, 0]), ringNeighbors)
    const placement = placements.get('b')
    expect(placement?.kind).toBe('conduit')
    expect(ringNeighbors('b')).not.toContain(placement?.link)
    expect(placement?.link).not.toBe('b')
  })

  it('pairs a conduit both ways, and skips the partner when the main loop reaches it', () => {
    // b: density-check 0 (pass), kind-pick 0.7 -> conduit, candidate-index 0 -> its only
    // non-neighbor, non-home candidate is 'd'. c: density-check 1 (>= density 1, so skipped).
    // d is never rolled at all - it's already claimed as b's partner by the time the main
    // loop reaches it.
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.7, 0, 1]), ringNeighbors)
    expect(placements.get('b')).toEqual({ kind: 'conduit', link: 'd' })
    expect(placements.get('d')).toEqual({ kind: 'conduit', link: 'b' })
    expect(placements.has('c')).toBe(false)
    expect(placements.size).toBe(2)
  })

  it('never links a conduit to the excluded (home) sector', () => {
    // conduit kind, and the candidate-index roll would pick 'a' (home) if it weren't excluded
    const placements = pickAnomalyPlacements(IDS, 'a', 1, scripted([0, 0.7, 0]), ringNeighbors)
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
  const ring = (): Edge<GalaxyEdgeData>[] => [
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

  it('leaves a barrier sector fully connected - it stays dormant until the player walks into it', () => {
    const edges = ring()
    const next = applyAnomalyPlacements(edges, new Map([['c', { kind: 'barrier' as const }]]))
    expect(next).toEqual(edges)
  })

  it('leaves a gate sector fully connected - the redirect is a moveTo-time effect, not a topology change', () => {
    const edges = ring()
    const next = applyAnomalyPlacements(edges, new Map([['c', { kind: 'gate' as const }]]))
    expect(next).toEqual(edges)
  })

  it('conduit adds both directions between the paired sectors, tagged viaConduit', () => {
    const next = applyAnomalyPlacements(
      ring(),
      new Map([
        ['a', { kind: 'conduit' as const, link: 'd' }],
        ['d', { kind: 'conduit' as const, link: 'a' }],
      ]),
    )
    expect(next.find((e) => e.from === 'a' && e.to === 'd')?.data).toEqual({ viaConduit: true })
    expect(next.find((e) => e.from === 'd' && e.to === 'a')?.data).toEqual({ viaConduit: true })
    // processing both sides of the pair doesn't duplicate the edges
    expect(next.filter((e) => e.from === 'a' && e.to === 'd').length).toBe(1)
  })

  it('applies multiple placements independently', () => {
    const next = applyAnomalyPlacements(
      ring(),
      new Map([
        ['c', { kind: 'barrier' as const }],
        ['a', { kind: 'conduit' as const, link: 'd' }],
        ['d', { kind: 'conduit' as const, link: 'a' }],
      ]),
    )
    // barrier and gate are dormant (no edge change) - only the conduit's link shows up
    expect(next.some((e) => e.from === 'c')).toBe(true)
    expect(next.some((e) => e.from === 'a' && e.to === 'd')).toBe(true)
  })
})
