import { useCallback, useMemo, useState } from 'react'
import { chamber, conduit, gate, well } from '../graph/anomalies'
import type { NodeId } from '../graph/UndoGraph'
import { createGalaxy, disengageWarp, engageWarp, type CreateGalaxyOptions } from './galaxy'
import { sectorId } from './cartography'

export type AnomalyKind = 'chamber' | 'well' | 'conduit' | 'gate'

export interface HuntState {
  position: NodeId
  warpEngaged: boolean
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
    log: ['Sensors online. Awaiting orders.'],
  })

  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const appendLog = useCallback(
    (message: string) => setState((s) => ({ ...s, log: [...s.log.slice(-19), message] })),
    [],
  )

  const currentSector = galaxy.getNode(state.position)
  const neighbors = galaxy.neighbors(state.position)

  const moveTo = useCallback(
    (target: NodeId) => {
      if (!galaxy.neighbors(state.position).includes(target)) return false
      const sector = galaxy.getNode(target)
      setState((s) => ({ ...s, position: target }))
      appendLog(`Moved to ${sector?.name ?? target}.`)
      return true
    },
    [galaxy, state.position, appendLog],
  )

  const toggleWarp = useCallback(() => {
    if (state.warpEngaged) {
      disengageWarp(galaxy)
      appendLog('Warp drive disengaged.')
    } else {
      engageWarp(galaxy)
      appendLog('Warp drive engaged.')
    }
    setState((s) => ({ ...s, warpEngaged: !s.warpEngaged }))
    bump()
  }, [galaxy, state.warpEngaged, appendLog, bump])

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
    moveTo,
    toggleWarp,
    triggerAnomaly,
    undoAnomaly,
  }
}
