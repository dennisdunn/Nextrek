import { useCallback, useState } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { HuntPhase } from '../hunt/HuntPhase'
import { useGalaxy } from '../hunt/useGalaxy'
import { KillPhase, type KillOutcome } from '../kill/KillPhase'

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
      if (!moveTo(target)) return
      const sector = galaxy.getNode(target)
      if (sector?.hostile) {
        setEncounter({ sectorId: target, sectorName: sector.name })
      }
    },
    [moveTo, galaxy],
  )

  const handleResolved = useCallback(
    (outcome: KillOutcome) => {
      setEncounter((current) => {
        if (current && outcome === 'victory') {
          const sector = galaxy.getNode(current.sectorId)
          if (sector) galaxy.setNode(current.sectorId, { ...sector, hostile: false })
        }
        return null
      })
      // Whatever was committed to shields/phasers for the fight goes back
      // to the reserve now that combat is over, win or lose.
      refundEnergy()
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
