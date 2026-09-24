import { KillPhase, type CombatResult, type LiveCombatState } from '../../kill/KillPhase'
import { Panel } from './Panel'

export interface TacticalPanelProps {
  encounterId: string
  hostileHealth: number
  shieldLevel: number
  phaserLevel: number
  torpedoesRemaining: number
  torpedoTubesHealth: number
  paused: boolean
  onResolved: (result: CombatResult) => void
  onLiveUpdate: (state: LiveCombatState) => void
}

export function TacticalPanel({
  encounterId,
  hostileHealth,
  shieldLevel,
  phaserLevel,
  torpedoesRemaining,
  torpedoTubesHealth,
  paused,
  onResolved,
  onLiveUpdate,
}: TacticalPanelProps) {
  return (
    <Panel title="Tactical" accent="tactical" className="panel--tactical">
      <KillPhase
        encounterId={encounterId}
        hostileHealth={hostileHealth}
        shieldLevel={shieldLevel}
        phaserLevel={phaserLevel}
        torpedoesRemaining={torpedoesRemaining}
        torpedoTubesHealth={torpedoTubesHealth}
        paused={paused}
        onResolved={onResolved}
        onLiveUpdate={onLiveUpdate}
      />
    </Panel>
  )
}
