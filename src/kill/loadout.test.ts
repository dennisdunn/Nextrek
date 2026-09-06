import { describe, expect, it } from 'vitest'
import {
  BASE_HULL_HEALTH,
  BASE_WEAPON_DAMAGE,
  loadoutFromEnergy,
  PHASER_DAMAGE_PER_LEVEL,
  SHIELD_HP_PER_LEVEL,
} from './loadout'

describe('loadoutFromEnergy', () => {
  it('gives the base loadout with no allocation', () => {
    expect(loadoutFromEnergy(0, 0)).toEqual({
      hullHealth: BASE_HULL_HEALTH,
      weaponDamage: BASE_WEAPON_DAMAGE,
    })
  })

  it('scales hull health with shield level', () => {
    const { hullHealth } = loadoutFromEnergy(50, 0)
    expect(hullHealth).toBe(BASE_HULL_HEALTH + 50 * SHIELD_HP_PER_LEVEL)
  })

  it('scales weapon damage with phaser level', () => {
    const { weaponDamage } = loadoutFromEnergy(0, 50)
    expect(weaponDamage).toBe(BASE_WEAPON_DAMAGE + 50 * PHASER_DAMAGE_PER_LEVEL)
  })

  it('never drops below the base loadout for negative input', () => {
    expect(loadoutFromEnergy(-10, -10)).toEqual({
      hullHealth: BASE_HULL_HEALTH,
      weaponDamage: BASE_WEAPON_DAMAGE,
    })
  })

  it('full allocation on both noticeably outperforms the base loadout', () => {
    const base = loadoutFromEnergy(0, 0)
    const maxed = loadoutFromEnergy(100, 100)
    expect(maxed.hullHealth).toBeGreaterThan(base.hullHealth)
    expect(maxed.weaponDamage).toBeGreaterThan(base.weaponDamage)
  })
})
