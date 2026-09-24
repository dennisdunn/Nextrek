import type { ReactNode } from 'react'

export type PanelAccent = 'status' | 'comms' | 'engineering' | 'sciences' | 'controls'

export interface PanelProps {
  title: string
  accent: PanelAccent
  children: ReactNode
  className?: string
  /**
   * A pair of station-select buttons rendered in place of the plain title -
   * used by the Sciences/Tactical and Status/Damage-control station slots,
   * whose header IS the toggle. The title stays in the DOM (CSS hides it)
   * rather than being omitted, so no separate title-less variant is needed.
   */
  toggle?: ReactNode
}

/** Shared frame for the bridge station panels (Status/Comms/Engineering/Sciences/Controls). */
export function Panel({ title, accent, children, className, toggle }: PanelProps) {
  return (
    <section className={['panel', `panel--${accent}`, toggle ? 'panel--has-toggle' : null, className].filter(Boolean).join(' ')}>
      <header className="panel__title">{title}</header>
      {toggle}
      <div className="panel__body">{children}</div>
    </section>
  )
}
