import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sectorId } from './cartography'
import { HOSTILE_QUOTA, STARDATE_PER_NORMAL_MOVE, STARDATE_PER_WARP_MOVE } from './mission'
import { LRS_COST_IMPULSE, LRS_COST_WARP, MOVE_COST_NORMAL, STARTING_ENERGY, STARTING_TORPEDOES, SUBSPACE_SCAN_MULTIPLIER, WARP_ENGAGE_COST } from './ship'
import { REFUND_EFFICIENCY } from './subsystems'
import { useGalaxy } from './useGalaxy'

const HOME = sectorId(0, 0)

/**
 * A deterministic, anomaly/hostile/starbase-free galaxy - core-transition
 * tests inject exactly the scenario they need directly onto the graph
 * (see e.g. the barrier/gate/conduit tests below) rather than fighting
 * createGalaxy's own seeding odds to land one in a useful spot.
 */
function makeGalaxy() {
  return renderHook(() =>
    useGalaxy({
      hostileDensity: 0,
      anomalyDensity: 0,
      starbaseDensity: 0,
      starHazardDensity: 0,
      homeSector: { region: 0, ring: 0 },
      rng: () => 0,
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('moveTo', () => {
  it('moves to a reachable neighbor, spending energy and advancing the stardate', () => {
    const { result } = makeGalaxy()
    const target = result.current.neighbors[0]

    act(() => {
      result.current.moveTo(target)
    })

    expect(result.current.state.position).toBe(target)
    expect(result.current.state.energy.reserve).toBe(STARTING_ENERGY - MOVE_COST_NORMAL)
    expect(result.current.state.stardate).toBeCloseTo(2395.0 + STARDATE_PER_NORMAL_MOVE)
    expect(result.current.state.visited.has(target)).toBe(true)
    expect(result.current.state.log.at(-1)).toMatch(/^Moved to /)
  })

  it('refuses to move to a sector that is not a neighbor, leaving state untouched', () => {
    const { result } = makeGalaxy()
    const notANeighbor = [...result.current.galaxy.nodes.keys()].find(
      (id) => id !== HOME && !result.current.neighbors.includes(id),
    )!

    let moved: unknown
    act(() => {
      moved = result.current.moveTo(notANeighbor)
    })

    expect(moved).toBe(false)
    expect(result.current.state.position).toBe(HOME)
    expect(result.current.state.energy.reserve).toBe(STARTING_ENERGY)
  })

  it('costs less mission time under warp than under impulse', () => {
    const { result } = makeGalaxy()
    act(() => result.current.toggleWarp())
    const target = result.current.neighbors[0]
    const stardateBefore = result.current.state.stardate

    act(() => {
      result.current.moveTo(target)
    })

    expect(result.current.state.stardate - stardateBefore).toBeCloseTo(STARDATE_PER_WARP_MOVE)
  })

  it('auto-docks at a starbase: fully restores energy, subsystems, and torpedoes', () => {
    const { result } = makeGalaxy()
    const target = result.current.neighbors[0]
    const node = result.current.galaxy.getNode(target)!
    result.current.galaxy.setNode(target, { ...node, starbase: true })
    // Spend some energy first so the restoration is actually observable.
    act(() => result.current.allocateEnergy('shields', 40))

    act(() => {
      result.current.moveTo(target)
    })

    expect(result.current.state.energy).toEqual({ reserve: STARTING_ENERGY, shields: 0, phasers: 0 })
    expect(result.current.state.torpedoes).toBe(STARTING_TORPEDOES)
    expect(Object.values(result.current.state.subsystems).every((health) => health === 100)).toBe(true)
    expect(result.current.state.log.at(-1)).toMatch(/^Docked at /)
  })

  it('a barrier severs every route back into it, once entered', () => {
    const { result } = makeGalaxy()
    const target = result.current.neighbors[0]
    const node = result.current.galaxy.getNode(target)!
    result.current.galaxy.setNode(target, { ...node, anomaly: { kind: 'barrier' } })

    act(() => {
      result.current.moveTo(target)
    })

    expect(result.current.state.position).toBe(target)
    expect(result.current.galaxy.incomingEdges(target)).toHaveLength(0)
    expect(result.current.state.log.at(-1)).toMatch(/barrier collapses inward/)
  })

  it('a gate redirects the ship to a different, non-anomaly sector', () => {
    const { result } = makeGalaxy()
    const target = result.current.neighbors[0]
    const node = result.current.galaxy.getNode(target)!
    result.current.galaxy.setNode(target, { ...node, anomaly: { kind: 'gate' } })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    act(() => {
      result.current.moveTo(target)
    })

    expect(result.current.state.position).not.toBe(target)
    expect(result.current.state.visited.has(target)).toBe(true)
    expect(result.current.state.visited.has(result.current.state.position)).toBe(true)
    // The redirect destination can itself land next to the gate sector's
    // anomaly, appending a "detected nearby" line after this one - so check
    // the log contains the traversal message rather than assuming it's last.
    expect(result.current.state.log.some((line) => /Blackhole-assisted traversal/.test(line))).toBe(true)
  })

  it('walking into a conduit the ordinary way channels through to its paired sector', () => {
    const { result } = makeGalaxy()
    const target = result.current.neighbors[0]
    const link = [...result.current.galaxy.nodes.keys()].find((id) => id !== target && id !== HOME)!
    const node = result.current.galaxy.getNode(target)!
    result.current.galaxy.setNode(target, { ...node, anomaly: { kind: 'conduit', link } })

    act(() => {
      result.current.moveTo(target)
    })

    expect(result.current.state.position).toBe(link)
    expect(result.current.state.visited.has(target)).toBe(true)
    expect(result.current.state.visited.has(link)).toBe(true)
    // The conduit's paired sector can itself land next to another sensed
    // anomaly, so check the log contains this message rather than assuming
    // it's last (see the equivalent gate-redirect test above).
    expect(result.current.state.log.some((line) => /Conduit resonance pulls the ship through/.test(line))).toBe(true)
  })
})

describe('toggleWarp', () => {
  it('engages, then disengages', () => {
    const { result } = makeGalaxy()

    act(() => result.current.toggleWarp())
    expect(result.current.state.warpEngaged).toBe(true)
    expect(result.current.state.energy.reserve).toBe(STARTING_ENERGY - WARP_ENGAGE_COST)
    expect(result.current.state.log.at(-1)).toBe('Warp drive engaged.')

    act(() => result.current.toggleWarp())
    expect(result.current.state.warpEngaged).toBe(false)
    expect(result.current.state.log.at(-1)).toBe('Warp drive disengaged.')
  })

  it('refuses to engage when the warp drive is offline', () => {
    const { result } = makeGalaxy()
    vi.spyOn(Math, 'random').mockReturnValue(0) // SHIP_SYSTEMS[0] === 'warpDrive'
    act(() => {
      result.current.resolveEncounter(100, 0, 0, STARTING_TORPEDOES, 0)
    })
    expect(result.current.state.subsystems.warpDrive).toBe(0)

    act(() => result.current.toggleWarp())

    expect(result.current.state.warpEngaged).toBe(false)
    expect(result.current.state.log.at(-1)).toMatch(/offline/)
  })
})

describe('allocateEnergy', () => {
  it('moves energy between reserve and a subsystem pool', () => {
    const { result } = makeGalaxy()

    act(() => result.current.allocateEnergy('shields', 40))
    expect(result.current.state.energy).toEqual({ reserve: STARTING_ENERGY - 40, shields: 40, phasers: 0 })

    act(() => result.current.allocateEnergy('shields', 10))
    expect(result.current.state.energy).toEqual({ reserve: STARTING_ENERGY - 10, shields: 10, phasers: 0 })
  })

  it("clamps to the subsystem's health-scaled ceiling", () => {
    const { result } = makeGalaxy()
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // SHIP_SYSTEMS[1] === 'shieldGenerator'
    act(() => {
      result.current.resolveEncounter(50, 0, 0, STARTING_TORPEDOES, 0)
    })
    expect(result.current.state.subsystems.shieldGenerator).toBe(50)

    act(() => result.current.allocateEnergy('shields', 100))

    expect(result.current.state.energy.shields).toBe(50)
  })
})

describe('resolveEncounter', () => {
  it('keeps a stable function identity across unrelated state changes', () => {
    // Regression test: resolveEncounter used to close over `state` directly,
    // so it needed state.energy/state.subsystems in its useCallback deps to
    // stay fresh - giving it a new identity on every energy tweak. That
    // instability propagated all the way to KillPhase's world-building
    // effect, which rebuilt its whole bitECS world (respawning hostiles at
    // new random positions) on every Engineering slider move mid-fight.
    const { result } = makeGalaxy()
    const first = result.current.resolveEncounter

    act(() => result.current.allocateEnergy('shields', 30))
    act(() => result.current.allocateEnergy('phasers', 20))

    expect(result.current.resolveEncounter).toBe(first)
  })

  it('refunds leftover energy at REFUND_EFFICIENCY and tracks kills toward the quota', () => {
    const { result } = makeGalaxy()

    act(() => {
      result.current.resolveEncounter(0, 40, 20, 7, 2)
    })

    expect(result.current.state.energy.reserve).toBe(STARTING_ENERGY + 60 * REFUND_EFFICIENCY)
    expect(result.current.state.torpedoes).toBe(7)
    expect(result.current.state.hostilesDestroyed).toBe(2)
    expect(result.current.state.log.at(-1)).toBe(`2 hostiles destroyed - 2/${HOSTILE_QUOTA} toward mission quota.`)
  })

  it('wears down exactly one subsystem by the hull damage taken', () => {
    const { result } = makeGalaxy()

    act(() => {
      result.current.resolveEncounter(30, 0, 0, STARTING_TORPEDOES, 0)
    })

    const totalHealth = Object.values(result.current.state.subsystems).reduce((a, b) => a + b, 0)
    expect(totalHealth).toBe(6 * 100 - 30)
  })
})

describe('longRangeScan / subspaceScan', () => {
  it('longRangeScan reveals neighbors at a cost that scales with drive mode', () => {
    const { result } = makeGalaxy()

    act(() => {
      result.current.longRangeScan()
    })
    expect(result.current.state.energy.reserve).toBe(STARTING_ENERGY - LRS_COST_IMPULSE)
    for (const n of result.current.neighbors) {
      expect(result.current.state.scanned.has(n)).toBe(true)
    }

    const reserveBeforeWarpScan = result.current.state.energy.reserve
    act(() => result.current.toggleWarp())
    act(() => {
      result.current.longRangeScan()
    })
    expect(result.current.state.energy.reserve).toBe(reserveBeforeWarpScan - WARP_ENGAGE_COST - LRS_COST_WARP)
  })

  it('subspaceScan costs a multiple of the long-range scan and flags a nearby anomaly', () => {
    const { result } = makeGalaxy()
    const target = result.current.neighbors[0]
    const node = result.current.galaxy.getNode(target)!
    result.current.galaxy.setNode(target, { ...node, anomaly: { kind: 'barrier' } })

    act(() => {
      result.current.subspaceScan()
    })

    expect(result.current.state.energy.reserve).toBe(STARTING_ENERGY - LRS_COST_IMPULSE * SUBSPACE_SCAN_MULTIPLIER)
    expect(result.current.state.scannedAnomalies.has(target)).toBe(true)
    expect(result.current.state.log.at(-1)).toMatch(/anomaly pinpointed in 1 sector/)
  })

  it('fails without spending energy once reserves can no longer cover the cost', () => {
    const { result } = makeGalaxy()
    const costPerScan = LRS_COST_IMPULSE * SUBSPACE_SCAN_MULTIPLIER

    while (result.current.state.energy.reserve >= costPerScan) {
      act(() => {
        result.current.subspaceScan()
      })
    }
    const reserveBefore = result.current.state.energy.reserve

    let ok: unknown
    act(() => {
      ok = result.current.subspaceScan()
    })

    expect(ok).toBe(false)
    expect(result.current.state.energy.reserve).toBe(reserveBefore)
    expect(result.current.state.log.at(-1)).toBe('Insufficient energy for a subspace scan.')
  })
})

describe('status', () => {
  it('reports victory once hostilesDestroyed reaches the quota', () => {
    const { result } = makeGalaxy()

    act(() => {
      result.current.resolveEncounter(0, 0, 0, STARTING_TORPEDOES, HOSTILE_QUOTA)
    })

    expect(result.current.status).toBe('victory')
  })

  it('reports a stranded defeat once no move can be afforded', () => {
    const { result } = makeGalaxy()

    while (result.current.state.energy.reserve >= MOVE_COST_NORMAL) {
      const target = result.current.neighbors[0]
      act(() => {
        result.current.moveTo(target)
      })
    }

    expect(result.current.state.energy.reserve).toBeLessThan(MOVE_COST_NORMAL)
    expect(result.current.status).toBe('defeat')
    expect(result.current.defeatReason).toBe('stranded')
  })
})
