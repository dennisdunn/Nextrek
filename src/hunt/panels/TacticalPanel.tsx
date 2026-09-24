import { KillPhase, type CombatResult, type LiveCombatState } from '../../kill/KillPhase'
import { Panel } from './Panel'

export interface TacticalPanelProps {
  encounterId: string
  hostileHealths: number[]
  shieldLevel: number
  phaserLevel: number
  torpedoesRemaining: number
  torpedoTubesHealth: number
  hasStarHazard: boolean
  paused: boolean
  onResolved: (result: CombatResult) => void
  onLiveUpdate: (state: LiveCombatState) => void
}

export function TacticalPanel({
  encounterId,
  hostileHealths,
  shieldLevel,
  phaserLevel,
  torpedoesRemaining,
  torpedoTubesHealth,
  hasStarHazard,
  paused,
  onResolved,
  onLiveUpdate,
}: TacticalPanelProps) {
  return (
    <Panel title="Tactical" accent="tactical" className="panel--tactical">
      <KillPhase
        encounterId={encounterId}
        hostileHealths={hostileHealths}
        shieldLevel={shieldLevel}
        phaserLevel={phaserLevel}
        torpedoesRemaining={torpedoesRemaining}
        torpedoTubesHealth={torpedoTubesHealth}
        hasStarHazard={hasStarHazard}
        paused={paused}
        onResolved={onResolved}
        onLiveUpdate={onLiveUpdate}
      />
    </Panel>
  )
}
