import { KillPhase, type CombatResult, type LiveCombatState } from '../../kill/KillPhase'
import { Panel } from './Panel'

export interface TacticalPanelProps {
  sectorName: string
  encounterId: string
  hostileHealth: number
  shieldLevel: number
  phaserLevel: number
  paused: boolean
  onResolved: (result: CombatResult) => void
  onLiveUpdate: (state: LiveCombatState) => void
}

export function TacticalPanel({
  sectorName,
  encounterId,
  hostileHealth,
  shieldLevel,
  phaserLevel,
  paused,
  onResolved,
  onLiveUpdate,
}: TacticalPanelProps) {
  return (
    <Panel title="Tactical" accent="tactical" className="panel--tactical">
      <KillPhase
        sectorName={sectorName}
        encounterId={encounterId}
        hostileHealth={hostileHealth}
        shieldLevel={shieldLevel}
        phaserLevel={phaserLevel}
        paused={paused}
        onResolved={onResolved}
        onLiveUpdate={onLiveUpdate}
      />
    </Panel>
  )
}
