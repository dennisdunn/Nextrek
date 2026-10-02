import type { ReactNode } from 'react'

export type PanelAccent = 'status' | 'comms' | 'engineering' | 'sciences' | 'controls'

/**
 * Which Protokuda frame shape to draw (see protokuda's frame.css): `std` has
 * top, bottom, and elbow-side edges, `partial` drops the top edge. `mirror`
 * puts the elbow on the right, for the panels in the right-hand sidebar.
 */
export type PanelFrame = 'std' | 'partial'

export interface PanelProps {
  title: string
  accent: PanelAccent
  children: ReactNode
  className?: string
  frame?: PanelFrame
  mirror?: boolean
  /** Pulses the frame in the alert color (Protokuda's `pk-alert`). */
  alert?: boolean
  /**
   * A pair of station-select buttons rendered in place of the plain title -
   * used by the Sciences/Tactical and Status/Damage-control station slots,
   * whose nameplate IS the toggle. The title still labels the section for
   * assistive tech via aria-label.
   */
  toggle?: ReactNode
  /** Buttons for the frame's left-edge sidebar (Protokuda's `pk-sidebar`/`pk-items`). */
  items?: ReactNode
}

/** Shared frame for the bridge station panels (Status/Comms/Engineering/Sciences). */
export function Panel({
  title,
  accent,
  children,
  className,
  frame = 'std',
  mirror = false,
  alert = false,
  toggle,
  items,
}: PanelProps) {
  const classes = [
    'panel',
    `panel--${accent}`,
    'pk-frame',
    `pk-${frame}`,
    mirror ? 'pk-mirror' : null,
    items ? 'pk-sidebar' : null,
    alert ? 'pk-alert' : null,
    className,
  ]
  return (
    <section className={classes.filter(Boolean).join(' ')} aria-label={title}>
      <header className="pk-title">{toggle ?? title}</header>
      {items && <div className="pk-items">{items}</div>}
      <div className="pk-content panel__body">{children}</div>
    </section>
  )
}
