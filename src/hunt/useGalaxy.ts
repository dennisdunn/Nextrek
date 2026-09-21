import { useCallback, useMemo, useState } from 'react'
import { barrier } from '../graph/anomalies'
import type { NodeId } from '../graph/UndoGraph'
import { pickGateDestination } from './anomalyEffects'
import { sectorId } from './cartography'
import { createGalaxy, disengageWarp, engageWarp, impulseNeighbors, type CreateGalaxyOptions } from './galaxy'
import { stardateCost, STARTING_STARDATE, tacticalAlert } from './mission'
import { knownSectors, sensedAnomalies, sensedHostiles } from './sensors'
import {
  canAfford,
  longRangeScanCost,
  moveCost,
  STARTING_ENERGY,
  subspaceScanCost,
  WARP_ENGAGE_COST,
} from './ship'
import { allocate, refund, REFUND_EFFICIENCY, type EnergyPools, type Subsystem } from './subsystems'

export interface HuntState {
  position: NodeId
  warpEngaged: boolean
  stardate: number
  energy: EnergyPools
  visited: Set<NodeId>
  /** Sectors a long-range scan has revealed - what the strategic map shows, beyond what's been visited. */
  scanned: Set<NodeId>
  /** Sectors a subspace scan has checked for an anomaly (whether or not it found one). */
  scannedAnomalies: Set<NodeId>
  /**
   * The barrier sector the ship currently occupies, if it got in via warp -
   * null otherwise. barrier() only strips edges from whichever edge set is
   * currently live, so triggering it under warp only ever touches the warp
   * network; the impulse layer underneath was never mutated and is still
   * fully intact. Leaving re-asserts that intact layer, so it's tracked
   * here purely to log the "it healed" moment on departure.
   */
  warpEnteredBarrier: NodeId | null
  log: string[]
}

/**
 * React glue around the UndoGraph-backed galaxy. The graph is mutable and
 * lives outside React state; a version counter forces a re-render whenever
 * a mutation (move, warp, undo) changes what the graph reports.
 */
export function useGalaxy(options?: CreateGalaxyOptions) {
  const galaxy = useMemo(() => createGalaxy(options), [])
  const home = sectorId(options?.homeSector?.region ?? 0, options?.homeSector?.ring ?? 0)
  const [, setVersion] = useState(0)
  const [state, setState] = useState<HuntState>({
    position: home,
    warpEngaged: false,
    stardate: STARTING_STARDATE,
    energy: { reserve: STARTING_ENERGY, shields: 0, phasers: 0 },
    visited: new Set([home]),
    scanned: new Set(),
    scannedAnomalies: new Set(),
    warpEnteredBarrier: null,
    log: ['Sensors online. Awaiting orders.'],
  })

  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const appendLog = useCallback(
    (message: string) => setState((s) => ({ ...s, log: [...s.log.slice(-19), message] })),
    [],
  )

  const currentSector = galaxy.getNode(state.position)
  const neighbors = galaxy.neighbors(state.position)
  const known = knownSectors(state.visited, state.scanned)
  // Reaching an anomaly's own log/marker doesn't require paying for a scan -
  // stumbling into one (or being flung through it) reveals it just as well,
  // per state.visited below.
  const anomalyKnown = new Set([...state.scannedAnomalies, ...state.visited])
  const sensedDanger = sensedHostiles(galaxy, state.position)
  const alert = tacticalAlert(Boolean(currentSector?.hostile), sensedDanger.length)

  const moveTo = useCallback(
    (target: NodeId): NodeId | false => {
      const edge = galaxy.outgoingEdges(state.position).find((e) => e.to === target)
      if (!edge) return false
      const cost = moveCost(state.warpEngaged, edge.data?.distance ?? 1)
      if (!canAfford(state.energy.reserve, cost)) {
        appendLog('Insufficient energy to move - reserves critical.')
        return false
      }

      const departedFrom = state.position
      const leavingWarpEnteredBarrier = state.warpEnteredBarrier === departedFrom
      const sector = galaxy.getNode(target)
      const anomaly = sector?.anomaly
      const arrivedViaConduit = Boolean(edge.data?.viaConduit)

      // Where the ship actually ends up, once an anomaly's own effect (if
      // any) has run - may differ from `target` for a gate, or for an
      // ordinary (non-conduit-link) entry into a conduit sector. `target`
      // itself still counts as visited either way: the ship was physically
      // there, however briefly.
      let landedAt = target
      let message: string

      if (anomaly?.kind === 'barrier') {
        // Activates the instant you walk in: severs every route back into
        // it. You can still leave via any of its own outgoing edges - it
        // blocks entry, not exit - you just won't be getting back in...
        // unless this was under warp, in which case the strip only ever
        // touched the warp network, not the impulse layer underneath (see
        // HuntState.warpEnteredBarrier) - a quirk left in deliberately.
        barrier(galaxy, target)
        message = `${sector!.name} - the barrier collapses inward behind the ship. No route leads back in. (-${cost} energy)`
      } else if (anomaly?.kind === 'gate') {
        // Blackhole Assisted Traversal: no choice in it, straight to a
        // random, non-anomaly sector well clear of where you just were.
        const redirect = pickGateDestination(
          [...galaxy.nodes.keys()],
          {
            home,
            departedFrom,
            nearbyDeparted: impulseNeighbors(departedFrom),
            hasAnomaly: (id) => Boolean(galaxy.getNode(id)?.anomaly),
          },
          Math.random,
        )
        if (redirect !== undefined) {
          landedAt = redirect
          const landedSector = galaxy.getNode(landedAt)
          message = `Blackhole-assisted traversal! ${sector!.name} flings the ship to ${landedSector?.name ?? landedAt}. (-${cost} energy)`
        } else {
          message = `Moved to ${sector!.name}. (-${cost} energy)`
        }
      } else if (anomaly?.kind === 'conduit' && !arrivedViaConduit) {
        // Walking up to a conduit sector the ordinary way just channels you
        // straight through to its paired sector instead of landing on it -
        // only arriving via the conduit link itself (from that partner) is
        // a real landing, hostile encounter included.
        landedAt = anomaly.link!
        const landedSector = galaxy.getNode(landedAt)
        message = `Conduit resonance pulls the ship through to ${landedSector?.name ?? landedAt}. (-${cost} energy)`
      } else {
        message = `Moved to ${sector?.name ?? target}. (-${cost} energy)`
      }

      const landedSector = galaxy.getNode(landedAt)
      const nextWarpEnteredBarrier =
        landedSector?.anomaly?.kind === 'barrier' && state.warpEngaged ? landedAt : null

      setState((s) => ({
        ...s,
        position: landedAt,
        stardate: s.stardate + stardateCost(s.warpEngaged),
        energy: { ...s.energy, reserve: s.energy.reserve - cost },
        visited: new Set(s.visited).add(target).add(landedAt),
        warpEnteredBarrier: nextWarpEnteredBarrier,
      }))
      appendLog(message)
      if (leavingWarpEnteredBarrier) {
        const departedName = galaxy.getNode(departedFrom)?.name ?? departedFrom
        appendLog(`${departedName} - the barrier anomaly has healed.`)
      }
      if (sensedAnomalies(galaxy, landedAt).length > 0) {
        appendLog('Subspace variance detected nearby.')
      }
      return landedAt
    },
    [galaxy, state.position, state.warpEngaged, state.energy.reserve, state.warpEnteredBarrier, home, appendLog],
  )

  const toggleWarp = useCallback(() => {
    if (state.warpEngaged) {
      disengageWarp(galaxy)
      setState((s) => ({ ...s, warpEngaged: false }))
      appendLog('Warp drive disengaged.')
    } else {
      if (!canAfford(state.energy.reserve, WARP_ENGAGE_COST)) {
        appendLog('Insufficient energy to engage warp drive.')
        return
      }
      engageWarp(galaxy)
      setState((s) => ({
        ...s,
        warpEngaged: true,
        energy: { ...s.energy, reserve: s.energy.reserve - WARP_ENGAGE_COST },
      }))
      appendLog(`Warp drive engaged. (-${WARP_ENGAGE_COST} energy)`)
    }
    bump()
  }, [galaxy, state.warpEngaged, state.energy.reserve, appendLog, bump])

  const allocateEnergy = useCallback((subsystem: Subsystem, targetLevel: number) => {
    setState((s) => ({ ...s, energy: allocate(s.energy, subsystem, targetLevel) }))
  }, [])

  const refundEnergy = useCallback(
    (leftoverShields: number, leftoverPhasers: number) => {
      setState((s) => ({ ...s, energy: refund(leftoverShields, leftoverPhasers, s.energy) }))
      const recovered = Math.round(Math.max(0, leftoverShields + leftoverPhasers) * REFUND_EFFICIENCY)
      appendLog(
        recovered > 0
          ? `Shields and phasers stood down - ${recovered} energy recovered to the main reserve.`
          : 'Shields and phasers were fully depleted in the engagement.',
      )
    },
    [appendLog],
  )

  const longRangeScan = useCallback(() => {
    const cost = longRangeScanCost(state.warpEngaged)
    if (!canAfford(state.energy.reserve, cost)) {
      appendLog('Insufficient energy for a long-range scan.')
      return false
    }
    const targets = galaxy.neighbors(state.position)
    setState((s) => ({
      ...s,
      energy: { ...s.energy, reserve: s.energy.reserve - cost },
      scanned: new Set([...s.scanned, ...targets]),
    }))
    appendLog(
      `Long-range scan complete: ${targets.length} sector${targets.length === 1 ? '' : 's'} mapped. (-${cost} energy)`,
    )
    return true
  }, [galaxy, state.position, state.warpEngaged, state.energy.reserve, appendLog])

  const subspaceScan = useCallback(() => {
    const cost = subspaceScanCost(state.warpEngaged)
    if (!canAfford(state.energy.reserve, cost)) {
      appendLog('Insufficient energy for a subspace scan.')
      return false
    }
    const targets = galaxy.neighbors(state.position)
    const found = targets.filter((id) => galaxy.getNode(id)?.anomaly).length
    setState((s) => ({
      ...s,
      energy: { ...s.energy, reserve: s.energy.reserve - cost },
      scannedAnomalies: new Set([...s.scannedAnomalies, ...targets]),
    }))
    appendLog(
      found > 0
        ? `Subspace scan complete: anomaly pinpointed in ${found} sector${found === 1 ? '' : 's'}. (-${cost} energy)`
        : `Subspace scan complete: no anomalies in range. (-${cost} energy)`,
    )
    return true
  }, [galaxy, state.position, state.warpEngaged, state.energy.reserve, appendLog])

  return {
    galaxy,
    state,
    currentSector,
    neighbors,
    known,
    anomalyKnown,
    sensedDanger,
    alert,
    moveTo,
    toggleWarp,
    allocateEnergy,
    refundEnergy,
    longRangeScan,
    subspaceScan,
  }
}
