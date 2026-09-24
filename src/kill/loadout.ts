/**
 * Translates the hunt phase's Engineering allocation (0-100 shield/phaser
 * levels, drawn from the ship's shared energy reserve) into the kill
 * phase's combat stats.
 *
 * Shields are a real depletable pool now, not bonus hull points: hull
 * health is fixed, and ShieldEnergy absorbs incoming damage before Health
 * does (see systems/collision.ts). Phasers work the same way in
 * reverse - PhaserEnergy is spent per shot (see PHASER_COST_PER_SHOT), so
 * a bigger allocation buys both harder hits and more of them, and running
 * it dry means the guns go silent.
 */
import {
  BASE_HULL_HEALTH,
  BASE_WEAPON_DAMAGE,
  HOSTILE_HULL_HEALTH,
  PHASER_COST_PER_SHOT,
  PHASER_DAMAGE_PER_LEVEL,
  TORPEDO_COOLDOWN_MS,
  TORPEDO_DAMAGE,
  TORPEDO_SPEED,
  TORPEDO_TTL_MS,
} from '../balance'

export {
  BASE_HULL_HEALTH,
  BASE_WEAPON_DAMAGE,
  HOSTILE_HULL_HEALTH,
  PHASER_COST_PER_SHOT,
  PHASER_DAMAGE_PER_LEVEL,
  TORPEDO_COOLDOWN_MS,
  TORPEDO_DAMAGE,
  TORPEDO_SPEED,
  TORPEDO_TTL_MS,
}

export interface ShipLoadout {
  hullHealth: number
  weaponDamage: number
  shieldEnergy: number
  phaserEnergy: number
}

export function loadoutFromEnergy(shieldLevel: number, phaserLevel: number): ShipLoadout {
  const shields = Math.max(0, shieldLevel)
  const phasers = Math.max(0, phaserLevel)
  return {
    hullHealth: BASE_HULL_HEALTH,
    weaponDamage: BASE_WEAPON_DAMAGE + phasers * PHASER_DAMAGE_PER_LEVEL,
    shieldEnergy: shields,
    phaserEnergy: phasers,
  }
}
