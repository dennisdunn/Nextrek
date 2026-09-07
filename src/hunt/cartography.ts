import type { NodeId } from '../graph/UndoGraph'
import type { BoundingArc, Polar } from '../math/types'
import Geometry from '../math/geometry'

// 16 angular regions x 4 radial rings = 64 sectors, echoing the 64
// quadrants of the original 1971 BASIC Star Trek.
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

export const RING_NAMES = ['I', 'II', 'III', 'IV']

export interface Sector {
  name: string
  /** Angular index, 0..REGION_NAMES.length-1 */
  region: number
  /** Radial index, 0 (innermost) .. RING_NAMES.length-1 (outermost) */
  ring: number
  arc: BoundingArc
}

export function sectorId(region: number, ring: number): NodeId {
  return `${region},${ring}`
}

/**
 * Divide the galaxy into equal-width rings (radii at integer multiples -
 * ring 0 spans r=[0,1], ring 1 spans [1,2], and so on), each split into
 * equal angular regions - a polar map shape rather than a Cartesian grid.
 * Equal-area rings (r = sqrt(ring / ringCount)) look visually confusing:
 * they shrink the inner rings to slivers near the pole to keep every
 * ring's area the same. Equal width bands read like a dartboard instead.
 */
export function createSectors(): Sector[] {
  const regionWidth = (2 * Math.PI) / REGION_NAMES.length
  const sectors: Sector[] = []
  for (let region = 0; region < REGION_NAMES.length; region++) {
    for (let ring = 0; ring < RING_NAMES.length; ring++) {
      sectors.push({
        name: `${REGION_NAMES[region]} ${RING_NAMES[ring]}`,
        region,
        ring,
        arc: {
          inner: { r: ring, theta: region * regionWidth },
          outer: { r: ring + 1, theta: (region + 1) * regionWidth },
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
  const sector = sectors.find((s) => Geometry.Polar.contains(s.arc, point))
  if (!sector) throw new Error('point is not contained in any sector')
  return sector
}
