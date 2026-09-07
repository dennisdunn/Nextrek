import { describe, expect, it } from 'vitest'
import { BASE_HULL_HEALTH, BASE_WEAPON_DAMAGE, loadoutFromEnergy, PHASER_DAMAGE_PER_LEVEL } from './loadout'

describe('loadoutFromEnergy', () => {
  it('gives the base loadout with no allocation - no shields, no phaser energy to fire with', () => {
    expect(loadoutFromEnergy(0, 0)).toEqual({
      hullHealth: BASE_HULL_HEALTH,
      weaponDamage: BASE_WEAPON_DAMAGE,
      shieldEnergy: 0,
      phaserEnergy: 0,
    })
  })

  it('hull health is fixed regardless of shield level - shields are a separate pool now', () => {
    expect(loadoutFromEnergy(50, 0).hullHealth).toBe(BASE_HULL_HEALTH)
    expect(loadoutFromEnergy(100, 0).hullHealth).toBe(BASE_HULL_HEALTH)
  })

  it('shield level becomes the starting shield energy pool', () => {
    expect(loadoutFromEnergy(50, 0).shieldEnergy).toBe(50)
  })

  it('phaser level becomes the starting phaser energy pool', () => {
    expect(loadoutFromEnergy(0, 50).phaserEnergy).toBe(50)
  })

  it('scales weapon damage with phaser level', () => {
    const { weaponDamage } = loadoutFromEnergy(0, 50)
    expect(weaponDamage).toBe(BASE_WEAPON_DAMAGE + 50 * PHASER_DAMAGE_PER_LEVEL)
  })

  it('never drops below the base loadout for negative input', () => {
    expect(loadoutFromEnergy(-10, -10)).toEqual({
      hullHealth: BASE_HULL_HEALTH,
      weaponDamage: BASE_WEAPON_DAMAGE,
      shieldEnergy: 0,
      phaserEnergy: 0,
    })
  })
})
