import { useCallback, useMemo, useState } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { sectorId } from './cartography'
import { createGalaxy, disengageWarp, engageWarp, type CreateGalaxyOptions } from './galaxy'
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
  const sensedDanger = sensedHostiles(galaxy, state.position)
  const alert = tacticalAlert(Boolean(currentSector?.hostile), sensedDanger.length)

  const moveTo = useCallback(
    (target: NodeId) => {
      const edge = galaxy.outgoingEdges(state.position).find((e) => e.to === target)
      if (!edge) return false
      const cost = moveCost(state.warpEngaged, edge.data?.distance ?? 1)
      if (!canAfford(state.energy.reserve, cost)) {
        appendLog('Insufficient energy to move - reserves critical.')
        return false
      }
      const sector = galaxy.getNode(target)
      setState((s) => ({
        ...s,
        position: target,
        stardate: s.stardate + stardateCost(s.warpEngaged),
        energy: { ...s.energy, reserve: s.energy.reserve - cost },
        visited: new Set(s.visited).add(target),
      }))
      appendLog(`Moved to ${sector?.name ?? target}. (-${cost} energy)`)
      if (sensedAnomalies(galaxy, target).length > 0) {
        appendLog('Subspace variance detected nearby.')
      }
      return true
    },
    [galaxy, state.position, state.warpEngaged, state.energy.reserve, appendLog],
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
    anomalyKnown: state.scannedAnomalies,
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
