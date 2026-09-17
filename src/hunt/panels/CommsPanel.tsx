import { Panel } from './Panel'

export interface CommsPanelProps {
  log: string[]
}

const ANOMALY_MESSAGE = 'Subspace variance detected nearby.'

export function CommsPanel({ log }: CommsPanelProps) {
  return (
    <Panel title="Communications" accent="comms">
      {/*
        Rendered newest-first (with the CSS flex-direction reversed to
        match) so the log stays pinned to its latest line without any
        manual scrollTop management - see .log in App.css.
      */}
      <ul className="log">
        {log
          .map((line, i) => ({ line, i }))
          .reverse()
          .map(({ line, i }) => (
            <li key={i} className={line === ANOMALY_MESSAGE ? 'log__line--anomaly' : undefined}>
              {line}
            </li>
          ))}
      </ul>
    </Panel>
  )
}
