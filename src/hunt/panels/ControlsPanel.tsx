import { useEffect } from 'react'
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

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

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

  // L/S always scan; W/I only act in the direction they name (engage/return
  // to impulse) so a stray press outside that state is a no-op rather than
  // an unwanted toggle. Modifier keys and repeats are left alone so this
  // never fights a browser shortcut (e.g. Ctrl+W) or key-repeat-spams a scan.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && FORM_TAGS.has(target.tagName)) return

      switch (e.key.toLowerCase()) {
        case 'l':
          onLongRangeScan()
          break
        case 's':
          onSubspaceScan()
          break
        case 'w':
          if (!warpEngaged && !warpDisabled) onToggleWarp()
          break
        case 'i':
          if (warpEngaged && !warpDisabled) onToggleWarp()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onLongRangeScan, onSubspaceScan, onToggleWarp, warpEngaged, warpDisabled])

  return (
    <Panel title="Controls" accent="controls" className="controls-panel">
      <button type="button" className="btn-sci" onClick={onLongRangeScan} title="Long-range scan (L)">
        LRS
      </button>
      <button type="button" className="btn-sci" onClick={onSubspaceScan} title="Subspace scan (S)">
        Subspace
      </button>
      <hr className="controls-divider" />
      <button
        type="button"
        className="btn-eng"
        onClick={onToggleWarp}
        disabled={warpDisabled}
        title={warpTitle ?? (warpEngaged ? 'Impulse (I)' : 'Warp (W)')}
      >
        {warpEngaged ? 'Impulse' : 'Warp'}
      </button>
      <div className="controls-spacer" />
    </Panel>
  )
}
