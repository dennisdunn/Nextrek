import type { AlertLevel } from '../mission'
import { Panel } from './Panel'

export interface StatusPanelProps {
  sectorName: string
  stardate: number
  alert: AlertLevel
}

const ALERT_LABEL: Record<AlertLevel, string> = {
  green: 'Green',
  yellow: 'Yellow',
  red: 'Red',
}

const ALERT_CAPTION: Record<AlertLevel, string | null> = {
  green: null,
  yellow: 'Hostiles detected nearby.',
  red: 'Hostile contact - this sector.',
}

export function StatusPanel({ sectorName, stardate, alert }: StatusPanelProps) {
  return (
    <Panel title="Status" accent="status">
      <dl className="readout">
        <dt>Location</dt>
        <dd>{sectorName}</dd>
        <dt>Stardate</dt>
        <dd>{stardate.toFixed(1)}</dd>
        <dt>Tactical</dt>
        <dd>
          <span className={`annunciator annunciator--${alert}`}>{ALERT_LABEL[alert]}</span>
        </dd>
      </dl>
      {ALERT_CAPTION[alert] && <p className={`alert alert--${alert}`}>{ALERT_CAPTION[alert]}</p>}
    </Panel>
  )
}
