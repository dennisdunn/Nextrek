import { useState } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { KillPhase, type CombatResult, type LiveCombatState } from '../kill/KillPhase'
import { GalaxyMap } from './GalaxyMap'
import { CommsPanel } from './panels/CommsPanel'
import { ControlsPanel } from './panels/ControlsPanel'
import { DamageControlPanel } from './panels/DamageControlPanel'
import { EngineeringPanel } from './panels/EngineeringPanel'
import { Panel } from './panels/Panel'
import { StatusPanel } from './panels/StatusPanel'
import type { useGalaxy } from './useGalaxy'

export type BridgeTab = 'sciences' | 'tactical'
type SidebarTab = 'status' | 'damage'

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
 * Presentational hunt-phase screen: a Controls column, a main station
 * (Sciences or Tactical), and a sidebar (Status or Damage control, plus
 * Engineering and Comms) - all driven entirely by `controller`. Deciding
 * what a move *means* (e.g. triggering or fleeing combat) is the
 * phase-transition layer's job (see game/GameShell.tsx), not this
 * component's.
 *
 * Sciences and Tactical share one station slot, its header doubling as the
 * tab bar once an encounter starts. Both are simple conditionals rather
 * than a mount/unmount swap: Tactical has to keep running (or stay paused
 * mid-fight, not reset) while the player is looking at Sciences to pick a
 * sector to flee to, so it stays mounted and is only hidden via CSS.
 *
 * Status and Damage control share the other sidebar slot the same way,
 * toggled by their own header - but neither carries state worth preserving
 * across the switch, so that one is a plain conditional render.
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
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('status')

  return (
    <div className="hunt-phase">
      <ControlsPanel
        onLongRangeScan={longRangeScan}
        onSubspaceScan={subspaceScan}
        warpEngaged={state.warpEngaged}
        warpLocked={Boolean(encounter)}
        warpOffline={state.subsystems.warpDrive <= 0}
        onToggleWarp={toggleWarp}
      />

      <div className="main-station">
        <Panel
          title="Sciences"
          accent="sciences"
          className="panel--sciences"
          toggle={
            encounter ? (
              <div className="header-toggle header-toggle--sciences">
                <button
                  type="button"
                  className={`tab-sciences${activeTab === 'sciences' ? ' active' : ''}`}
                  onClick={() => onTabChange('sciences')}
                >
                  Sciences
                </button>
                <button
                  type="button"
                  className={`tab-tactical${activeTab === 'tactical' ? ' active' : ''}`}
                  onClick={() => onTabChange('tactical')}
                >
                  Tactical
                </button>
              </div>
            ) : undefined
          }
        >
          <div className="station-slot" style={{ display: activeTab === 'sciences' ? 'contents' : 'none' }}>
            <GalaxyMap
              galaxy={galaxy}
              position={state.position}
              neighbors={neighbors}
              known={known}
              anomalyKnown={anomalyKnown}
              onSelect={onMove}
            />
          </div>
          {encounter && (
            <div className="station-slot" style={{ display: activeTab === 'tactical' ? 'contents' : 'none' }}>
              <KillPhase
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
        </Panel>
      </div>

      <div className="hunt-sidebar">
        <Panel
          title={sidebarTab === 'status' ? 'Status' : 'Damage control'}
          accent="status"
          toggle={
            <div className="header-toggle header-toggle--status">
              <button
                type="button"
                className={`tab-status${sidebarTab === 'status' ? ' active' : ''}`}
                onClick={() => setSidebarTab('status')}
              >
                Status
              </button>
              <button
                type="button"
                className={`tab-damage${sidebarTab === 'damage' ? ' active' : ''}`}
                onClick={() => setSidebarTab('damage')}
              >
                Damage control
              </button>
            </div>
          }
        >
          {sidebarTab === 'status' ? (
            <StatusPanel
              sectorName={currentSector?.name ?? 'Unknown sector'}
              stardate={state.stardate}
              hostilesDestroyed={state.hostilesDestroyed}
              alert={alert}
            />
          ) : (
            <DamageControlPanel subsystems={state.subsystems} />
          )}
        </Panel>

        <EngineeringPanel
          energy={state.energy}
          subsystems={state.subsystems}
          torpedoes={state.torpedoes}
          onAllocate={allocateEnergy}
        />
        <CommsPanel log={state.log} />
      </div>
    </div>
  )
}
