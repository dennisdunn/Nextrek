import { useCallback, useState } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { HuntPhase } from '../hunt/HuntPhase'
import { useGalaxy } from '../hunt/useGalaxy'
import { KillPhase, type CombatResult } from '../kill/KillPhase'

interface CombatEncounter {
  sectorId: NodeId
  sectorName: string
}

/**
 * Phase-transition layer. Owns the galaxy (React/UndoGraph, strategic)
 * and decides when a hunt-phase move hands off to the kill phase
 * (bitECS/canvas, tactical), then folds the outcome back into the galaxy
 * and returns control to the hunt phase.
 */
export function GameShell() {
  const controller = useGalaxy()
  const { galaxy, moveTo, refundEnergy } = controller
  const [encounter, setEncounter] = useState<CombatEncounter | null>(null)

  const handleMove = useCallback(
    (target: NodeId) => {
      // moveTo returns where the ship actually ended up, which can differ
      // from `target` after a gate or conduit redirect - the hostile check
      // has to run on that real landing sector, not the one originally
      // clicked (a gate/conduit sector is itself always hostile-free).
      const landedAt = moveTo(target)
      if (!landedAt) return
      const sector = galaxy.getNode(landedAt)
      if (sector?.hostile) {
        setEncounter({ sectorId: landedAt, sectorName: sector.name })
      }
    },
    [moveTo, galaxy],
  )

  const handleResolved = useCallback(
    (result: CombatResult) => {
      setEncounter((current) => {
        if (current && result.outcome === 'victory') {
          const sector = galaxy.getNode(current.sectorId)
          if (sector) galaxy.setNode(current.sectorId, { ...sector, hostile: false })
        }
        return null
      })
      // Whatever shield/phaser energy survived the fight goes back to the
      // reserve (at a lossy exchange rate) now that combat is over.
      refundEnergy(result.leftoverShieldEnergy, result.leftoverPhaserEnergy)
    },
    [galaxy, refundEnergy],
  )

  if (encounter) {
    return (
      <KillPhase
        sectorName={encounter.sectorName}
        shieldLevel={controller.state.energy.shields}
        phaserLevel={controller.state.energy.phasers}
        onResolved={handleResolved}
      />
    )
  }

  return <HuntPhase controller={controller} onMove={handleMove} />
}
