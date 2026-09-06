import { STARTING_ENERGY } from '../ship'
import type { EnergyPools, Subsystem } from '../subsystems'
import { Panel } from './Panel'

export interface EngineeringPanelProps {
  energy: EnergyPools
  warpEngaged: boolean
  onToggleWarp: () => void
  onAllocate: (subsystem: Subsystem, level: number) => void
}

export function EngineeringPanel({ energy, warpEngaged, onToggleWarp, onAllocate }: EngineeringPanelProps) {
  const reservePct = Math.max(0, Math.min(100, (energy.reserve / STARTING_ENERGY) * 100))

  return (
    <Panel title="Engineering" accent="engineering">
      <div className="readout-row">
        <span>Reserve power</span>
        <span>{Math.round(energy.reserve)}</span>
      </div>
      <div className="bar">
        <div
          className={`bar__fill${reservePct < 20 ? ' bar__fill--low' : ''}`}
          style={{ width: `${reservePct}%` }}
        />
      </div>

      <label className="slider-row">
        <span>Shields {Math.round(energy.shields)}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={energy.shields}
          onChange={(e) => onAllocate('shields', Number(e.target.value))}
        />
      </label>

      <label className="slider-row">
        <span>Phasers {Math.round(energy.phasers)}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={energy.phasers}
          onChange={(e) => onAllocate('phasers', Number(e.target.value))}
        />
      </label>

      <button type="button" onClick={onToggleWarp}>
        {warpEngaged ? 'Disengage warp' : 'Engage warp'}
      </button>
    </Panel>
  )
}
