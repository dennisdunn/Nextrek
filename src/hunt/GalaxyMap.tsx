import { polar2rect } from '../math/convert'
import type { NodeId } from '../graph/UndoGraph'
import type { Galaxy } from './galaxy'

interface GalaxyMapProps {
  galaxy: Galaxy
  position: NodeId
  neighbors: NodeId[]
  onSelect: (id: NodeId) => void
}

const SIZE = 480
const SCALE = SIZE / 2 - 12

function toScreen(r: number, theta: number) {
  const p = polar2rect({ r: r * SCALE, theta })
  return { x: SIZE / 2 + p.x, y: SIZE / 2 - p.y }
}

function sectorPath(inner: { r: number; theta: number }, outer: { r: number; theta: number }): string {
  const p1 = toScreen(inner.r, inner.theta)
  const p2 = toScreen(outer.r, inner.theta)
  const p3 = toScreen(outer.r, outer.theta)
  const p4 = toScreen(inner.r, outer.theta)
  const outerR = outer.r * SCALE
  const innerR = inner.r * SCALE
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${outerR} ${outerR} 0 0 0 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    innerR > 0 ? `A ${innerR} ${innerR} 0 0 1 ${p1.x} ${p1.y}` : '',
    'Z',
  ].join(' ')
}

export function GalaxyMap({ galaxy, position, neighbors, onSelect }: GalaxyMapProps) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="galaxy-map"
      role="img"
      aria-label="Galaxy sensor map"
    >
      {[...galaxy.nodes.entries()].map(([id, sector]) => {
        const isHere = id === position
        const isReachable = neighbors.includes(id)
        const classes = ['sector']
        if (isHere) classes.push('sector--here')
        if (isReachable) classes.push('sector--reachable')
        if (sector.hostile) classes.push('sector--hostile')
        return (
          <path
            key={id}
            d={sectorPath(sector.arc.inner, sector.arc.outer)}
            className={classes.join(' ')}
            onClick={() => isReachable && onSelect(id)}
          >
            <title>
              {sector.name}
              {sector.hostile ? ' (hostile contact)' : ''}
            </title>
          </path>
        )
      })}
    </svg>
  )
}
