import { useCallback } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { GalaxyMap } from './GalaxyMap'
import { STARTING_ENERGY } from './ship'
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
 * Presentational hunt-phase screen: renders the galaxy map and status
 * panel from `controller`, dispatches on user input. Deciding what a move
 * or an anomaly *means* (e.g. triggering combat) is the phase-transition
 * layer's job (see game/GameShell.tsx), not this component's.
 */
export function HuntPhase({ controller, onMove }: HuntPhaseProps) {
  const { galaxy, state, currentSector, neighbors, known, sensedDanger, toggleWarp, triggerAnomaly } =
    controller

  const spawnAnomaly = useCallback(
    (kind: AnomalyKind) => {
      triggerAnomaly(kind, pickOtherSector(galaxy, state.position))
    },
    [triggerAnomaly, galaxy, state.position],
  )

  const energyPct = Math.max(0, Math.min(100, (state.energy / STARTING_ENERGY) * 100))

  return (
    <div className="hunt-phase">
      <GalaxyMap
        galaxy={galaxy}
        position={state.position}
        neighbors={neighbors}
        known={known}
        onSelect={onMove}
      />
      <aside className="hunt-status">
        <h2>{currentSector?.name ?? 'Unknown sector'}</h2>
        {currentSector?.hostile && <p className="alert">Hostile contact!</p>}
        {!currentSector?.hostile && sensedDanger.length > 0 && (
          <p className="alert alert--caution">
            Sensors detect {sensedDanger.length} hostile{sensedDanger.length > 1 ? 's' : ''} nearby.
          </p>
        )}

        <div className="energy-readout">
          <span>Energy: {Math.round(state.energy)}</span>
          <div className="energy-bar">
            <div
              className={`energy-bar__fill${energyPct < 20 ? ' energy-bar__fill--low' : ''}`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
        </div>

        <p>
          Warp drive: <strong>{state.warpEngaged ? 'engaged' : 'disengaged'}</strong>
        </p>
        <button type="button" onClick={toggleWarp}>
          {state.warpEngaged ? 'Disengage warp' : 'Engage warp'}
        </button>

        <h3>Subspace anomalies</h3>
        <div className="anomaly-controls">
          <button type="button" onClick={() => spawnAnomaly('chamber')}>
            Chamber
          </button>
          <button type="button" onClick={() => spawnAnomaly('well')}>
            Well
          </button>
          <button type="button" onClick={() => spawnAnomaly('conduit')}>
            Conduit
          </button>
          <button type="button" onClick={() => spawnAnomaly('gate')}>
            Gate
          </button>
        </div>

        <h3>Sensor log</h3>
        <ul className="log">
          {state.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
