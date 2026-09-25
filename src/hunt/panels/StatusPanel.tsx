import { stardateRemaining, type AlertLevel, type MissionConfig } from '../mission'

export interface StatusPanelProps {
  sectorName: string
  stardate: number
  hostilesDestroyed: number
  alert: AlertLevel
  /** The active difficulty's quota/budget - see balance.ts's DIFFICULTY_PRESETS. */
  missionConfig: MissionConfig
}

const ALERT_LABEL: Record<AlertLevel, string> = {
  green: 'Green',
  yellow: 'Yellow',
  red: 'Red',
}

/** Body content for the Status view - hosted inside the merged Status/Damage-control panel in HuntPhase.tsx. */
export function StatusPanel({ sectorName, stardate, hostilesDestroyed, alert, missionConfig }: StatusPanelProps) {
  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Location</span>
          <span className="stat__value">{sectorName}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Stardate</span>
          <span className="stat__value">{stardate.toFixed(1)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Mission clock</span>
          <span className="stat__value">{stardateRemaining(stardate, missionConfig).toFixed(1)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Hostiles destroyed</span>
          <span className="stat__value">
            {hostilesDestroyed} / {missionConfig.hostileQuota}
          </span>
        </div>
      </div>
      <div className="tactical-row">
        <span>Tactical</span>
        <span className={`annunciator annunciator--${alert}`}>{ALERT_LABEL[alert]}</span>
      </div>
    </>
  )
}
