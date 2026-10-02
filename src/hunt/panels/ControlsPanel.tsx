import { useEffect } from 'react'

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
 * The one place every player-initiated action lives - rendered as the
 * Sciences frame's sidebar buttons (Protokuda's `pk-items`/`pk-button`, see
 * HuntPhase.tsx) rather than a panel of its own. Each button's `data-code`
 * shows its keyboard shortcut in the corner.
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
    <>
      <button
        type="button"
        className="pk-button btn-sci"
        data-code="L"
        onClick={onLongRangeScan}
        title="Long-range scan (L)"
      >
        LRS
      </button>
      <button
        type="button"
        className="pk-button btn-sci"
        data-code="S"
        onClick={onSubspaceScan}
        title="Subspace scan (S)"
      >
        Subspace
      </button>
      <button
        type="button"
        className="pk-button btn-eng"
        data-code={warpEngaged ? 'I' : 'W'}
        onClick={onToggleWarp}
        disabled={warpDisabled}
        title={warpTitle ?? (warpEngaged ? 'Impulse (I)' : 'Warp (W)')}
      >
        {warpEngaged ? 'Impulse' : 'Warp'}
      </button>
    </>
  )
}
