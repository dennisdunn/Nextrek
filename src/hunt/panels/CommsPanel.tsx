import { Panel } from './Panel'

export interface CommsPanelProps {
  log: string[]
}

export function CommsPanel({ log }: CommsPanelProps) {
  return (
    <Panel title="Communications" accent="comms">
      <ul className="log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </Panel>
  )
}
