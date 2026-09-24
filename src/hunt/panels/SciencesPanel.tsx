import type { NodeId } from '../../graph/UndoGraph'
import { GalaxyMap } from '../GalaxyMap'
import type { Galaxy } from '../galaxy'
import { systemAnnunciatorClass } from '../subsystems'
import { Panel } from './Panel'

export interface SciencesPanelProps {
  galaxy: Galaxy
  position: NodeId
  neighbors: NodeId[]
  known: ReadonlySet<NodeId>
  anomalyKnown: ReadonlySet<NodeId>
  sensorsHealth: number
  onSelect: (id: NodeId) => void
  onLongRangeScan: () => void
  onSubspaceScan: () => void
}

export function SciencesPanel({
  galaxy,
  position,
  neighbors,
  known,
  anomalyKnown,
  sensorsHealth,
  onSelect,
  onLongRangeScan,
  onSubspaceScan,
}: SciencesPanelProps) {
  return (
    <Panel title="Sciences" accent="sciences" className="panel--sciences">
      <GalaxyMap
        galaxy={galaxy}
        position={position}
        neighbors={neighbors}
        known={known}
        anomalyKnown={anomalyKnown}
        onSelect={onSelect}
      />
      <div className="readout-row">
        <span>Sensors</span>
        <span className={systemAnnunciatorClass(sensorsHealth)}>{Math.round(sensorsHealth)}%</span>
      </div>
      <div className="scan-controls">
        <button type="button" onClick={onLongRangeScan}>
          Long-range scan
        </button>
        <button type="button" onClick={onSubspaceScan}>
          Subspace scan
        </button>
      </div>
    </Panel>
  )
}
