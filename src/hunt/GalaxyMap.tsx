import { polar2rect } from '../math/convert'
import type { NodeId } from '../graph/UndoGraph'
import type { Galaxy } from './galaxy'

interface GalaxyMapProps {
  galaxy: Galaxy
  position: NodeId
  neighbors: NodeId[]
  /** Sectors with real sensor data (visited or currently adjacent) - everything else renders as unknown. */
  known: ReadonlySet<NodeId>
  onSelect: (id: NodeId) => void
}

const SIZE = 480
const MAX_DRAW_RADIUS = SIZE / 2 - 12

function toScreen(r: number, theta: number, scale: number) {
  const p = polar2rect({ r: r * scale, theta })
  return { x: SIZE / 2 + p.x, y: SIZE / 2 - p.y }
}

function sectorPath(inner: { r: number; theta: number }, outer: { r: number; theta: number }, scale: number): string {
  const p1 = toScreen(inner.r, inner.theta, scale)
  const p2 = toScreen(outer.r, inner.theta, scale)
  const p3 = toScreen(outer.r, outer.theta, scale)
  const p4 = toScreen(inner.r, outer.theta, scale)
  const outerR = outer.r * scale
  const innerR = inner.r * scale
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${outerR} ${outerR} 0 0 0 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    innerR > 0 ? `A ${innerR} ${innerR} 0 0 1 ${p1.x} ${p1.y}` : '',
    'Z',
  ].join(' ')
}

export function GalaxyMap({ galaxy, position, neighbors, known, onSelect }: GalaxyMapProps) {
  const sectors = [...galaxy.nodes.entries()]
  // Scale to whatever the outermost ring actually is, so the map stays
  // correctly proportioned regardless of how many rings there are.
  const maxRadius = sectors.reduce((max, [, sector]) => Math.max(max, sector.arc.outer.r), 1)
  const scale = MAX_DRAW_RADIUS / maxRadius

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="galaxy-map"
      role="img"
      aria-label="Galaxy sensor map"
    >
      {sectors.map(([id, sector]) => {
        const isHere = id === position
        const isReachable = neighbors.includes(id)
        const isKnown = known.has(id)
        const isHostile = isKnown && sector.hostile
        const classes = ['sector']
        if (isHere) classes.push('sector--here')
        if (isReachable) classes.push('sector--reachable')
        if (isHostile) classes.push('sector--hostile')
        if (!isKnown) classes.push('sector--unknown')
        return (
          <path
            key={id}
            d={sectorPath(sector.arc.inner, sector.arc.outer, scale)}
            className={classes.join(' ')}
            onClick={() => isReachable && onSelect(id)}
          >
            <title>
              {sector.name}
              {isHostile ? ' (hostile contact)' : !isKnown ? ' (unscanned)' : ''}
            </title>
          </path>
        )
      })}
    </svg>
  )
}
