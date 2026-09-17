import { describe, expect, it } from 'vitest'
import { pickGateDestination } from './anomalyEffects'

const IDS = ['home', 'gate', 'near1', 'near2', 'anomaly', 'far1', 'far2']

function options(overrides: Partial<Parameters<typeof pickGateDestination>[1]> = {}) {
  return {
    home: 'home',
    departedFrom: 'near1',
    nearbyDeparted: ['near1', 'near2', 'gate'],
    hasAnomaly: (id: string) => id === 'gate' || id === 'anomaly',
    ...overrides,
  }
}

describe('pickGateDestination', () => {
  it('never picks home', () => {
    for (let i = 0; i < IDS.length; i++) {
      const rng = () => i / IDS.length
      expect(pickGateDestination(IDS, options(), rng)).not.toBe('home')
    }
  })

  it('never picks the sector the ship departed from', () => {
    for (let i = 0; i < IDS.length; i++) {
      const rng = () => i / IDS.length
      expect(pickGateDestination(IDS, options(), rng)).not.toBe('near1')
    }
  })

  it('never picks a sector adjacent to where the ship departed from', () => {
    for (let i = 0; i < IDS.length; i++) {
      const rng = () => i / IDS.length
      const result = pickGateDestination(IDS, options(), rng)
      expect(result).not.toBe('near2')
    }
  })

  it('never picks another anomaly sector, including the gate itself', () => {
    for (let i = 0; i < IDS.length; i++) {
      const rng = () => i / IDS.length
      const result = pickGateDestination(IDS, options(), rng)
      expect(result).not.toBe('gate')
      expect(result).not.toBe('anomaly')
    }
  })

  it('only ever returns a legitimate far sector', () => {
    const rng = () => 0
    expect(pickGateDestination(IDS, options(), rng)).toBe('far1')
  })

  it('returns undefined when nothing qualifies', () => {
    const tiny = ['home', 'gate']
    const result = pickGateDestination(
      tiny,
      { home: 'home', departedFrom: 'gate', nearbyDeparted: [], hasAnomaly: (id) => id === 'gate' },
      () => 0,
    )
    expect(result).toBeUndefined()
  })
})
