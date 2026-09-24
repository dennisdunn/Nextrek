import type { NodeId } from '../graph/UndoGraph'
import type { CombatResult, LiveCombatState } from '../kill/KillPhase'
import { CommsPanel } from './panels/CommsPanel'
import { EngineeringPanel } from './panels/EngineeringPanel'
import { SciencesPanel } from './panels/SciencesPanel'
import { StatusPanel } from './panels/StatusPanel'
import { TacticalPanel } from './panels/TacticalPanel'
import type { useGalaxy } from './useGalaxy'

export type BridgeTab = 'sciences' | 'tactical'

export interface Encounter {
  sectorId: NodeId
  hostileHealths: number[]
  hasStarHazard: boolean
}

export interface HuntPhaseProps {
  controller: ReturnType<typeof useGalaxy>
  /** Called when the player selects a reachable sector to move into - also how a fight is fled. */
  onMove: (id: NodeId) => void
  /** Present for the duration of a hostile encounter; null the rest of the time. */
  encounter: Encounter | null
  activeTab: BridgeTab
  onTabChange: (tab: BridgeTab) => void
  onCombatResolved: (result: CombatResult) => void
  onLiveCombatUpdate: (state: LiveCombatState) => void
}

/**
 * Presentational hunt-phase screen, laid out as four bridge stations
 * (Sciences or Tactical/Status/Engineering/Comms) driven entirely by
 * `controller`. Deciding what a move *means* (e.g. triggering or fleeing
 * combat) is the phase-transition layer's job (see game/GameShell.tsx),
 * not this component's.
 *
 * Sciences and Tactical share one station slot, toggled by a tab bar that
 * only appears during an encounter. Both are simple conditionals rather
 * than a mount/unmount swap: Tactical has to keep running (or stay paused
 * mid-fight, not reset) while the player is looking at Sciences to pick a
 * sector to flee to, so it stays mounted and is only hidden via CSS.
 */
export function HuntPhase({
  controller,
  onMove,
  encounter,
  activeTab,
  onTabChange,
  onCombatResolved,
  onLiveCombatUpdate,
}: HuntPhaseProps) {
  const {
    galaxy,
    state,
    currentSector,
    neighbors,
    known,
    anomalyKnown,
    alert,
    toggleWarp,
    allocateEnergy,
    longRangeScan,
    subspaceScan,
  } = controller

  return (
    <div className="hunt-phase">
      <div className="main-station">
        {encounter && (
          <div className="station-tabs">
            <button
              type="button"
              className={`tab-button${activeTab === 'sciences' ? ' tab-button--active' : ''}`}
              onClick={() => onTabChange('sciences')}
            >
              Sciences
            </button>
            <button
              type="button"
              className={`tab-button${activeTab === 'tactical' ? ' tab-button--active' : ''}`}
              onClick={() => onTabChange('tactical')}
            >
              Tactical
            </button>
          </div>
        )}
        <div className="station-slot" style={{ display: activeTab === 'sciences' ? 'contents' : 'none' }}>
          <SciencesPanel
            galaxy={galaxy}
            position={state.position}
            neighbors={neighbors}
            known={known}
            anomalyKnown={anomalyKnown}
            sensorsHealth={state.subsystems.sensors}
            onSelect={onMove}
            onLongRangeScan={longRangeScan}
            onSubspaceScan={subspaceScan}
          />
        </div>
        {encounter && (
          <div className="station-slot" style={{ display: activeTab === 'tactical' ? 'contents' : 'none' }}>
            <TacticalPanel
              encounterId={encounter.sectorId}
              hostileHealths={encounter.hostileHealths}
              shieldLevel={state.energy.shields}
              phaserLevel={state.energy.phasers}
              torpedoesRemaining={state.torpedoes}
              torpedoTubesHealth={state.subsystems.torpedoTubes}
              hasStarHazard={encounter.hasStarHazard}
              paused={activeTab !== 'tactical'}
              onResolved={onCombatResolved}
              onLiveUpdate={onLiveCombatUpdate}
            />
          </div>
        )}
      </div>
      <div className="hunt-sidebar">
        <StatusPanel
          sectorName={currentSector?.name ?? 'Unknown sector'}
          stardate={state.stardate}
          hostilesDestroyed={state.hostilesDestroyed}
          alert={alert}
        />
        <EngineeringPanel
          energy={state.energy}
          subsystems={state.subsystems}
          torpedoes={state.torpedoes}
          warpEngaged={state.warpEngaged}
          warpLocked={Boolean(encounter)}
          onToggleWarp={toggleWarp}
          onAllocate={allocateEnergy}
        />
        <CommsPanel log={state.log} />
      </div>
    </div>
  )
}
