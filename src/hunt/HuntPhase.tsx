import { useCallback } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { CommsPanel } from './panels/CommsPanel'
import { EngineeringPanel } from './panels/EngineeringPanel'
import { SciencesPanel } from './panels/SciencesPanel'
import { StatusPanel } from './panels/StatusPanel'
import type { AnomalyKind, useGalaxy } from './useGalaxy'

export interface HuntPhaseProps {
  controller: ReturnType<typeof useGalaxy>
  /** Called when the player selects a reachable sector to move into. */
  onMove: (id: NodeId) => void
}

function pickOtherSector(galaxy: HuntPhaseProps['controller']['galaxy'], exclude: NodeId): NodeId {
  const others = [...galaxy.nodes.keys()].filter((id) => id !== exclude)
  return others[Math.floor(Math.random() * others.length)] ?? exclude
}

/**
 * Presentational hunt-phase screen, laid out as four bridge stations
 * (Sciences/Status/Engineering/Comms) driven entirely by `controller`.
 * Deciding what a move or an anomaly *means* (e.g. triggering combat) is
 * the phase-transition layer's job (see game/GameShell.tsx), not this
 * component's.
 */
export function HuntPhase({ controller, onMove }: HuntPhaseProps) {
  const { galaxy, state, currentSector, neighbors, known, alert, toggleWarp, allocateEnergy, triggerAnomaly } =
    controller

  const spawnAnomaly = useCallback(
    (kind: AnomalyKind) => triggerAnomaly(kind, pickOtherSector(galaxy, state.position)),
    [triggerAnomaly, galaxy, state.position],
  )

  return (
    <div className="hunt-phase">
      <SciencesPanel
        galaxy={galaxy}
        position={state.position}
        neighbors={neighbors}
        known={known}
        onSelect={onMove}
        onScanAnomaly={spawnAnomaly}
      />
      <div className="hunt-sidebar">
        <StatusPanel sectorName={currentSector?.name ?? 'Unknown sector'} stardate={state.stardate} alert={alert} />
        <EngineeringPanel
          energy={state.energy}
          warpEngaged={state.warpEngaged}
          onToggleWarp={toggleWarp}
          onAllocate={allocateEnergy}
        />
        <CommsPanel log={state.log} />
      </div>
    </div>
  )
}
