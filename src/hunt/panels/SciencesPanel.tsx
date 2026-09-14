import type { NodeId } from '../../graph/UndoGraph'
import { GalaxyMap } from '../GalaxyMap'
import type { Galaxy } from '../galaxy'
import { Panel } from './Panel'

export interface SciencesPanelProps {
  galaxy: Galaxy
  position: NodeId
  neighbors: NodeId[]
  known: ReadonlySet<NodeId>
  anomalyKnown: ReadonlySet<NodeId>
  onSelect: (id: NodeId) => void
  lrsCost: number
  subspaceCost: number
  onLongRangeScan: () => void
  onSubspaceScan: () => void
}

export function SciencesPanel({
  galaxy,
  position,
  neighbors,
  known,
  anomalyKnown,
  onSelect,
  lrsCost,
  subspaceCost,
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
      <div className="scan-controls">
        <button type="button" onClick={onLongRangeScan}>
          Long-range scan ({lrsCost})
        </button>
        <button type="button" onClick={onSubspaceScan}>
          Subspace scan ({subspaceCost})
        </button>
      </div>
    </Panel>
  )
}
