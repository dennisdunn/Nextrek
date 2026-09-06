import type { ReactNode } from 'react'

export type PanelAccent = 'status' | 'comms' | 'engineering' | 'sciences'

export interface PanelProps {
  title: string
  accent: PanelAccent
  children: ReactNode
  className?: string
}

/** Shared frame for the bridge station panels (Status/Comms/Engineering/Sciences). */
export function Panel({ title, accent, children, className }: PanelProps) {
  return (
    <section className={['panel', `panel--${accent}`, className].filter(Boolean).join(' ')}>
      <header className="panel__title">{title}</header>
      <div className="panel__body">{children}</div>
    </section>
  )
}
