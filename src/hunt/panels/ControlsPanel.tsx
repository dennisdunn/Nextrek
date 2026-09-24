import { Panel } from './Panel'

export interface ControlsPanelProps {
  onLongRangeScan: () => void
  onSubspaceScan: () => void
  warpEngaged: boolean
  /** True during an active encounter - warp can't be used to break off a fight. */
  warpLocked: boolean
  warpOffline: boolean
  onToggleWarp: () => void
}

/**
 * The one place every player-initiated action lives, colored/bordered to
 * match the station each action belongs to (green for Sciences, purple for
 * Engineering) rather than grouped by panel the way they used to be.
 */
export function ControlsPanel({
  onLongRangeScan,
  onSubspaceScan,
  warpEngaged,
  warpLocked,
  warpOffline,
  onToggleWarp,
}: ControlsPanelProps) {
  const warpDisabled = warpLocked || warpOffline
  const warpTitle = warpLocked
    ? 'Warp offline during red alert'
    : warpOffline
      ? 'Warp drive offline - repairs needed at a starbase'
      : undefined

  return (
    <Panel title="Controls" accent="controls" className="controls-panel">
      <button type="button" className="btn-sci" onClick={onLongRangeScan}>
        LRS
      </button>
      <button type="button" className="btn-sci" onClick={onSubspaceScan}>
        Subspace
      </button>
      <hr className="controls-divider" />
      <button type="button" className="btn-eng" onClick={onToggleWarp} disabled={warpDisabled} title={warpTitle}>
        {warpEngaged ? 'Disengage' : 'Warp'}
      </button>
      <div className="controls-spacer" />
    </Panel>
  )
}
