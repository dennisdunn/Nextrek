import { useEffect } from 'react'
import { ENERGY_ALLOCATION_STEP } from '../../balance'
import type { Subsystem } from '../subsystems'
import { Panel } from './Panel'

export interface ControlsPanelProps {
  onLongRangeScan: () => void
  onSubspaceScan: () => void
  warpEngaged: boolean
  /** True during an active encounter - warp can't be used to break off a fight. */
  warpLocked: boolean
  warpOffline: boolean
  onToggleWarp: () => void
  /** Adds ENERGY_ALLOCATION_STEP units to a subsystem's current allocation - increment-only (Q/E), the same way combat itself only ever spends shields/phasers down. Standing a subsystem down again is the slider's job, not a keyboard shortcut. */
  onAdjustEnergy: (subsystem: Subsystem, amount: number) => void
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
  onAdjustEnergy,
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
        case 'q':
          onAdjustEnergy('shields', ENERGY_ALLOCATION_STEP)
          break
        case 'e':
          onAdjustEnergy('phasers', ENERGY_ALLOCATION_STEP)
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onLongRangeScan, onSubspaceScan, onToggleWarp, warpEngaged, warpDisabled, onAdjustEnergy])

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
      <button
        type="button"
        className="btn-eng"
        onClick={() => onAdjustEnergy('shields', ENERGY_ALLOCATION_STEP)}
        title={`Add ${ENERGY_ALLOCATION_STEP} energy to shields (Q)`}
      >
        Shields +{ENERGY_ALLOCATION_STEP}
      </button>
      <button
        type="button"
        className="btn-eng"
        onClick={() => onAdjustEnergy('phasers', ENERGY_ALLOCATION_STEP)}
        title={`Add ${ENERGY_ALLOCATION_STEP} energy to phasers (E)`}
      >
        Phasers +{ENERGY_ALLOCATION_STEP}
      </button>
      <div className="controls-spacer" />
    </Panel>
  )
}
