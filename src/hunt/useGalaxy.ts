import { useCallback, useMemo, useState } from 'react'
import { chamber, conduit, gate, well } from '../graph/anomalies'
import type { NodeId } from '../graph/UndoGraph'
import { sectorId } from './cartography'
import { createGalaxy, disengageWarp, engageWarp, type CreateGalaxyOptions } from './galaxy'
import { stardateCost, STARTING_STARDATE, tacticalAlert } from './mission'
import { knownSectors, sensedHostiles } from './sensors'
import { canAfford, moveCost, STARTING_ENERGY, WARP_ENGAGE_COST } from './ship'
import { allocate, refund, type EnergyPools, type Subsystem } from './subsystems'

export type AnomalyKind = 'chamber' | 'well' | 'conduit' | 'gate'

export interface HuntState {
  position: NodeId
  warpEngaged: boolean
  stardate: number
  energy: EnergyPools
  visited: Set<NodeId>
  log: string[]
}

/**
 * React glue around the UndoGraph-backed galaxy. The graph is mutable and
 * lives outside React state; a version counter forces a re-render whenever
 * a mutation (move, warp, anomaly, undo) changes what the graph reports.
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
    log: ['Sensors online. Awaiting orders.'],
  })

  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const appendLog = useCallback(
    (message: string) => setState((s) => ({ ...s, log: [...s.log.slice(-19), message] })),
    [],
  )

  const currentSector = galaxy.getNode(state.position)
  const neighbors = galaxy.neighbors(state.position)
  const known = knownSectors(galaxy, state.position, state.visited)
  const sensedDanger = sensedHostiles(galaxy, state.position)
  const alert = tacticalAlert(Boolean(currentSector?.hostile), sensedDanger.length)

  const moveTo = useCallback(
    (target: NodeId) => {
      if (!galaxy.neighbors(state.position).includes(target)) return false
      const cost = moveCost(state.warpEngaged)
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

  const refundEnergy = useCallback(() => {
    if (state.energy.shields === 0 && state.energy.phasers === 0) return
    setState((s) => ({ ...s, energy: refund(s.energy) }))
    appendLog('Shields and phasers stood down - power rerouted to the main reserve.')
  }, [state.energy.shields, state.energy.phasers, appendLog])

  const triggerAnomaly = useCallback(
    (kind: AnomalyKind, target: NodeId) => {
      switch (kind) {
        case 'chamber':
          chamber(galaxy, state.position, target)
          appendLog(`Subspace chamber detected near ${target}.`)
          break
        case 'well':
          well(galaxy, target)
          appendLog(`Subspace well collapsing all exits from ${target}.`)
          break
        case 'conduit':
          conduit(galaxy, state.position, target)
          appendLog(`Subspace conduit linked to ${target}.`)
          break
        case 'gate':
          gate(galaxy, state.position, target)
          appendLog(`Subspace gate opened to ${target}.`)
          break
      }
      bump()
    },
    [galaxy, state.position, appendLog, bump],
  )

  const undoAnomaly = useCallback(() => {
    const reverted = galaxy.undo()
    if (reverted) appendLog('An anomaly has collapsed on its own.')
    bump()
    return reverted
  }, [galaxy, appendLog, bump])

  return {
    galaxy,
    state,
    currentSector,
    neighbors,
    known,
    sensedDanger,
    alert,
    moveTo,
    toggleWarp,
    allocateEnergy,
    refundEnergy,
    triggerAnomaly,
    undoAnomaly,
  }
}
