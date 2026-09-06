/**
 * Translates the hunt phase's Engineering allocation (0-100 shield/phaser
 * levels, drawn from the ship's shared energy reserve) into the kill
 * phase's combat stats. Shields become bonus hull points rather than a
 * separate absorb-first pool - simpler to simulate, same strategic
 * payoff: energy spent on shields before a fight measurably helps you
 * survive it, and energy spent on phasers measurably helps you win it.
 */
export interface ShipLoadout {
  hullHealth: number
  weaponDamage: number
}

export const BASE_HULL_HEALTH = 100
export const SHIELD_HP_PER_LEVEL = 1

export const BASE_WEAPON_DAMAGE = 10
export const PHASER_DAMAGE_PER_LEVEL = 0.3

export function loadoutFromEnergy(shieldLevel: number, phaserLevel: number): ShipLoadout {
  return {
    hullHealth: BASE_HULL_HEALTH + Math.max(0, shieldLevel) * SHIELD_HP_PER_LEVEL,
    weaponDamage: BASE_WEAPON_DAMAGE + Math.max(0, phaserLevel) * PHASER_DAMAGE_PER_LEVEL,
  }
}
