import { STARTING_ENERGY } from '../ship'
import { systemAnnunciatorClass, type EnergyPools, type Subsystem, type SubsystemHealth } from '../subsystems'
import { Panel } from './Panel'

export interface EngineeringPanelProps {
  energy: EnergyPools
  subsystems: SubsystemHealth
  /** Game-wide torpedo inventory - visible here since Tactical only exists during an active encounter. */
  torpedoes: number
  warpEngaged: boolean
  /** True during an active encounter - warp can't be used to break off a fight. */
  warpLocked: boolean
  onToggleWarp: () => void
  onAllocate: (subsystem: Subsystem, level: number) => void
}

export function EngineeringPanel({
  energy,
  subsystems,
  torpedoes,
  warpEngaged,
  warpLocked,
  onToggleWarp,
  onAllocate,
}: EngineeringPanelProps) {
  const reservePct = Math.max(0, Math.min(100, (energy.reserve / STARTING_ENERGY) * 100))
  const warpOffline = subsystems.warpDrive <= 0
  const warpDisabled = warpLocked || warpOffline
  const warpTitle = warpLocked
    ? 'Warp offline during red alert'
    : warpOffline
      ? 'Warp drive offline - repairs needed at a starbase'
      : undefined

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

      <div className="readout-row">
        <span>Torpedoes</span>
        <span>{torpedoes}</span>
      </div>

      <dl className="readout system-status">
        <dt>Warp drive</dt>
        <dd>
          <span className={systemAnnunciatorClass(subsystems.warpDrive)}>{Math.round(subsystems.warpDrive)}%</span>
        </dd>
        <dt>Shield generator</dt>
        <dd>
          <span className={systemAnnunciatorClass(subsystems.shieldGenerator)}>{Math.round(subsystems.shieldGenerator)}%</span>
        </dd>
        <dt>Phaser array</dt>
        <dd>
          <span className={systemAnnunciatorClass(subsystems.phaserArray)}>{Math.round(subsystems.phaserArray)}%</span>
        </dd>
        <dt>Impulse engines</dt>
        <dd>
          <span className={systemAnnunciatorClass(subsystems.impulseEngines)}>{Math.round(subsystems.impulseEngines)}%</span>
        </dd>
        <dt>Torpedo tubes</dt>
        <dd>
          <span className={systemAnnunciatorClass(subsystems.torpedoTubes)}>{Math.round(subsystems.torpedoTubes)}%</span>
        </dd>
      </dl>

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

      <button type="button" className="warp-toggle" onClick={onToggleWarp} disabled={warpDisabled} title={warpTitle}>
        {warpEngaged ? 'Disengage warp' : 'Engage warp'}
      </button>
    </Panel>
  )
}
