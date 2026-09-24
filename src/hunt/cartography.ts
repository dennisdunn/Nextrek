import type { NodeId } from '../graph/UndoGraph'
import { contains } from '../math/geometryPolar'
import type { BoundingArc, Polar } from '../math/types'

// 16 named regions at the "normal" resolution - some rings divide the
// circle more finely or more coarsely than this (see sectorsInRing), but
// every sector's name still traces back to one of these.
export const REGION_NAMES = [
  'Aldebaran',
  'Altair',
  'Antares',
  'Arcturus',
  'Betelgeuse',
  'Canopus',
  'Capella',
  'Deneb',
  'Pollux',
  'Procyon',
  'Regulus',
  'Rigel',
  'Sagittarius',
  'Sirius',
  'Spica',
  'Vega',
]

export const RING_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI']

/** Radial width of a single ring. */
export const RING_WIDTH = 1

/**
 * A non-traversable gap at the very center - not a ring, not a sector,
 * just empty space (drawn as a decorative "galactic core" circle in
 * GalaxyMap.tsx) so Ring I gets a real inner edge instead of tapering to
 * a point at the pole. A quarter of a ring's width.
 */
export const HUB_RADIUS = RING_WIDTH / 4

/** The "normal" angular resolution - what a ring divides into unless it's the innermost or in the outer half. */
export const BASE_SECTORS_PER_RING = REGION_NAMES.length

/** Ring I is this much coarser than normal - a handful of big sectors instead of slivers at the pole. */
export const INNER_RING_DIVISOR = 2

/** The outer half of the rings are this much finer than normal - there's plenty of area out there to spare. */
export const OUTER_RING_MULTIPLIER = 2

/**
 * How many angular sectors a given ring divides into. Ring 0 (innermost)
 * is coarser than the rest, since equal angular resolution at every ring
 * makes the innermost sectors tiny slivers - see sectorsInRing's own
 * derivation in the project history. The outer half of the rings - however
 * many that turns out to be, always recomputed from `totalRings` - is
 * finer, since sectors out there already have plenty of area to spare.
 * Adding more rings later never requires touching this function: the
 * "outer half" boundary just moves with it.
 */
export function sectorsInRing(ring: number, totalRings: number): number {
  if (ring === 0) return BASE_SECTORS_PER_RING / INNER_RING_DIVISOR
  const outerRingCount = Math.floor(totalRings / 2)
  const isOuterHalf = ring >= totalRings - outerRingCount
  return isOuterHalf ? BASE_SECTORS_PER_RING * OUTER_RING_MULTIPLIER : BASE_SECTORS_PER_RING
}

export interface Sector {
  name: string
  /** Angular index within this sector's own ring - 0..sectorsInRing(ring, totalRings)-1. */
  region: number
  /** Radial index, 0 (innermost) .. RING_NAMES.length-1 (outermost) */
  ring: number
  arc: BoundingArc
}

export function sectorId(region: number, ring: number): NodeId {
  return `${region},${ring}`
}

/**
 * A ring coarser than baseline spans several baseline regions per sector -
 * name it after the first one (e.g. Ring I's first sector, spanning what
 * would be Aldebaran/Altair at normal resolution, is just "Aldebaran I").
 * A ring finer than baseline has several sectors sharing one baseline
 * region's name - suffixed a, b, c... ("Vega VI-a", "Vega VI-b"). At
 * baseline resolution it's just the plain name, unsuffixed.
 */
function sectorName(region: number, ring: number, sectorsThisRing: number): string {
  const ringName = RING_NAMES[ring]
  if (sectorsThisRing === BASE_SECTORS_PER_RING) {
    return `${REGION_NAMES[region]} ${ringName}`
  }
  if (sectorsThisRing < BASE_SECTORS_PER_RING) {
    const span = BASE_SECTORS_PER_RING / sectorsThisRing
    return `${REGION_NAMES[region * span]} ${ringName}`
  }
  const span = sectorsThisRing / BASE_SECTORS_PER_RING
  const baselineIndex = Math.floor(region / span)
  const suffix = String.fromCharCode(97 + (region % span))
  return `${REGION_NAMES[baselineIndex]} ${ringName}-${suffix}`
}

/**
 * Divide the galaxy into equal-width rings beyond HUB_RADIUS (ring 0 spans
 * r=[HUB_RADIUS, HUB_RADIUS+1], ring 1 spans [HUB_RADIUS+1, HUB_RADIUS+2],
 * and so on) - a polar map shape rather than a Cartesian grid. Equal-area
 * rings (r = sqrt(ring / ringCount)) look visually confusing: they shrink
 * the inner rings to slivers near the pole to keep every ring's area the
 * same. Equal width bands read like a dartboard instead - except right at
 * the pole, where even an equal-width ring still tapers to a point, which
 * is what HUB_RADIUS carves out as a non-sector gap instead. Each ring's
 * own angular resolution comes from sectorsInRing, not a single
 * galaxy-wide constant.
 */
export function createSectors(): Sector[] {
  const totalRings = RING_NAMES.length
  const sectors: Sector[] = []
  for (let ring = 0; ring < totalRings; ring++) {
    const count = sectorsInRing(ring, totalRings)
    const regionWidth = (2 * Math.PI) / count
    const innerR = HUB_RADIUS + ring * RING_WIDTH
    const outerR = innerR + RING_WIDTH
    for (let region = 0; region < count; region++) {
      sectors.push({
        name: sectorName(region, ring, count),
        region,
        ring,
        arc: {
          inner: { r: innerR, theta: region * regionWidth },
          outer: { r: outerR, theta: (region + 1) * regionWidth },
        },
      })
    }
  }
  return sectors
}

export function getSectorByName(sectors: Sector[], name: string): Sector {
  const sector = sectors.find((s) => s.name === name)
  if (!sector) throw new Error(`invalid sector name: ${name}`)
  return sector
}

export function getSectorContaining(sectors: Sector[], point: Polar): Sector {
  const sector = sectors.find((s) => contains(s.arc, point))
  if (!sector) throw new Error('point is not contained in any sector')
  return sector
}
