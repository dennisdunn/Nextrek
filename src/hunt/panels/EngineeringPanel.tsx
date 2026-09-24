import { STARTING_ENERGY } from '../ship'
import type { EnergyPools, Subsystem, SubsystemHealth } from '../subsystems'
import { Panel } from './Panel'

export interface EngineeringPanelProps {
  energy: EnergyPools
  subsystems: SubsystemHealth
  /** Game-wide torpedo inventory - visible here since Tactical only exists during an active encounter. */
  torpedoes: number
  onAllocate: (subsystem: Subsystem, level: number) => void
}

export function EngineeringPanel({ energy, subsystems, torpedoes, onAllocate }: EngineeringPanelProps) {
  const reservePct = Math.max(0, Math.min(100, (energy.reserve / STARTING_ENERGY) * 100))

  return (
    <Panel title="Engineering" accent="engineering">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Reserve power</span>
          <span className="stat__value">{Math.round(energy.reserve)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Torpedoes</span>
          <span className="stat__value">{torpedoes}</span>
        </div>
      </div>
      <div className="bar" style={{ marginTop: -8 }}>
        <div
          className={`bar__fill${reservePct < 20 ? ' bar__fill--low' : ''}`}
          style={{ width: `${reservePct}%` }}
        />
      </div>

      <div className="slider-grid">
        <label className="slider-row">
          <span>Shields {Math.round(energy.shields)}</span>
          <input
            type="range"
            min={0}
            max={Math.floor(subsystems.shieldGenerator)}
            value={energy.shields}
            onChange={(e) => onAllocate('shields', Number(e.target.value))}
          />
        </label>

        <label className="slider-row">
          <span>Phasers {Math.round(energy.phasers)}</span>
          <input
            type="range"
            min={0}
            max={Math.floor(subsystems.phaserArray)}
            value={energy.phasers}
            onChange={(e) => onAllocate('phasers', Number(e.target.value))}
          />
        </label>
      </div>
    </Panel>
  )
}
