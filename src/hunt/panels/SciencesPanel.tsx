import type { NodeId } from '../../graph/UndoGraph'
import { GalaxyMap } from '../GalaxyMap'
import type { Galaxy } from '../galaxy'
import type { AnomalyKind } from '../useGalaxy'
import { Panel } from './Panel'

export interface SciencesPanelProps {
  galaxy: Galaxy
  position: NodeId
  neighbors: NodeId[]
  known: ReadonlySet<NodeId>
  onSelect: (id: NodeId) => void
  onScanAnomaly: (kind: AnomalyKind) => void
}

export function SciencesPanel({
  galaxy,
  position,
  neighbors,
  known,
  onSelect,
  onScanAnomaly,
}: SciencesPanelProps) {
  return (
    <Panel title="Sciences" accent="sciences" className="panel--sciences">
      <GalaxyMap galaxy={galaxy} position={position} neighbors={neighbors} known={known} onSelect={onSelect} />
      <div className="anomaly-controls">
        <button type="button" onClick={() => onScanAnomaly('chamber')}>
          Chamber
        </button>
        <button type="button" onClick={() => onScanAnomaly('well')}>
          Well
        </button>
        <button type="button" onClick={() => onScanAnomaly('conduit')}>
          Conduit
        </button>
        <button type="button" onClick={() => onScanAnomaly('gate')}>
          Gate
        </button>
      </div>
    </Panel>
  )
}
