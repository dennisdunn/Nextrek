import { SHIP_SYSTEM_LABEL, systemAnnunciatorClass, type ShipSystem, type SubsystemHealth } from '../subsystems'

export interface DamageControlPanelProps {
  subsystems: SubsystemHealth
}

const SYSTEMS = Object.keys(SHIP_SYSTEM_LABEL) as ShipSystem[]

/** Body content for the Damage control view - hosted inside the merged Status/Damage-control panel in HuntPhase.tsx. */
export function DamageControlPanel({ subsystems }: DamageControlPanelProps) {
  return (
    <div className="stat-grid">
      {SYSTEMS.map((system) => (
        <div className="stat" key={system}>
          <span className="stat__label">{SHIP_SYSTEM_LABEL[system]}</span>
          <span className="stat__value">
            <span className={systemAnnunciatorClass(subsystems[system])}>{Math.round(subsystems[system])}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}
