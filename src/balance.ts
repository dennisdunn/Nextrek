/**
 * Every dial that shapes gameplay feel and difficulty, gathered in one
 * place so tuning the game doesn't mean hunting through a dozen files -
 * energy costs, mission length, seeding densities, combat damage, ship
 * handling, and so on.
 *
 * The functions and types that actually *use* these numbers stay in their
 * own domain modules (hunt/ship.ts, kill/loadout.ts, etc.), which import
 * from here and re-export whatever they used to define locally - nothing
 * outside this file needed to change its own imports.
 *
 * This is the one deliberate exception to hunt/ and kill/ otherwise being
 * kept independent of each other (see game/GameShell.tsx's doc comment):
 * it's plain data, not shared logic or behavior, so both sides importing
 * from it doesn't reintroduce the coupling that boundary exists to avoid.
 */

// ---------------------------------------------------------------------------
// Ship & movement (hunt/ship.ts)
// ---------------------------------------------------------------------------

export const STARTING_ENERGY = 1000
export const MOVE_COST_NORMAL = 10
export const WARP_ENGAGE_COST = 50

/** Torpedoes are a physical inventory, not energy - a limited, game-wide supply, replenished only at a starbase. */
export const STARTING_TORPEDOES = 10

// A warp jump's cost scales with how far it actually travels (in impulse-
// hop distance - see warpNetwork.ts): a flat per-jump base plus a rate per
// sector covered. That keeps a 1-sector warp hop pointless (base cost
// alone already exceeds one impulse move) while a jump near the edge of
// warp's radius is clearly worth it over several impulse hops.
export const WARP_MOVE_BASE_COST = 8
export const WARP_MOVE_COST_PER_SECTOR = 6

// Long-range sensors sweep every sector reachable in one hop under the
// current drive mode - warp's radius reaches far more sectors than
// impulse's immediate 8, so a warp scan costs proportionately more. Flat
// costs rather than "per sector scanned" so a sector at the rim or pole
// (fewer neighbors either way) doesn't get a cheaper scan by accident.
export const LRS_COST_IMPULSE = 15
export const LRS_COST_WARP = 70

/** Subspace scans are exotic-physics sensing, pricier than ordinary LRS by this multiplier. */
export const SUBSPACE_SCAN_MULTIPLIER = 2

// ---------------------------------------------------------------------------
// Mission & time (hunt/mission.ts)
// ---------------------------------------------------------------------------

export const STARTING_STARDATE = 2395.0
export const STARDATE_PER_NORMAL_MOVE = 0.1
export const STARDATE_PER_WARP_MOVE = 0.05

/**
 * Normal-mode objective: destroy this many hostiles before the mission
 * clock runs out. A fixed number rather than "every hostile the galaxy
 * happened to seed" - simpler to reason about, and doesn't force a full
 * sweep of the map to win. (Survival mode, with no clock or quota, is a
 * distinct mode to add later - not a variation of this one.)
 */
export const HOSTILE_QUOTA = 15

/** Stardates allotted for the whole mission, starting from STARTING_STARDATE. */
export const STARDATE_BUDGET = 20

// ---------------------------------------------------------------------------
// Ship subsystems (hunt/subsystems.ts)
// ---------------------------------------------------------------------------

/**
 * Fraction of leftover shield/phaser energy actually recovered when
 * combat ends. A one-way conversion loss: allocating energy "just in
 * case" and never spending it still costs you (1 - this) of it, so
 * over-committing before a fight isn't free just because it's undone
 * afterward.
 */
export const REFUND_EFFICIENCY = 0.5

/** At or below this, a system reads as critical (red) rather than merely degraded. */
export const CRITICAL_SYSTEM_THRESHOLD = 40
/** At or above this, a system reads as fully healthy (green) rather than degraded. */
export const HEALTHY_SYSTEM_THRESHOLD = 80

// ---------------------------------------------------------------------------
// Galaxy seeding (hunt/galaxy.ts)
// ---------------------------------------------------------------------------

/** A sector can hold a small pack of hostiles, not just a lone one - up to this many, fixed at seeding. */
export const MAX_HOSTILES_PER_SECTOR = 3

/** How far (in impulse hops) a single warp jump can reach. */
export const WARP_RADIUS = 3

/** Fraction of non-home sectors seeded with a hostile. */
export const HOSTILE_DENSITY = 0.12
/** Fraction of non-home sectors seeded with a subspace anomaly. */
export const ANOMALY_DENSITY = 0.08
/** Fraction of eligible (non-home, non-hostile, non-anomaly) sectors seeded with a starbase. */
export const STARBASE_DENSITY = 0.05
/** Fraction of hostile sectors (not otherwise complicated by an anomaly) that also get a star hazard. */
export const STAR_HAZARD_DENSITY = 0.1

// ---------------------------------------------------------------------------
// Combat loadout (kill/loadout.ts)
// ---------------------------------------------------------------------------

export const BASE_HULL_HEALTH = 100

export const BASE_WEAPON_DAMAGE = 10
export const PHASER_DAMAGE_PER_LEVEL = 0.3
export const PHASER_COST_PER_SHOT = 5

/** Default hull health for a hostile that's never been engaged before (see galaxy.ts's SectorData.hostileHealth). */
export const HOSTILE_HULL_HEALTH = 40

// Torpedoes: a scarce, locked-on secondary weapon - much harder-hitting
// than a phaser bolt, slower, and on its own cooldown, in exchange for
// drawing down a game-wide inventory instead of shield/phaser energy.
export const TORPEDO_DAMAGE = 60
export const TORPEDO_SPEED = 180
export const TORPEDO_TTL_MS = 3000
export const TORPEDO_COOLDOWN_MS = 1500

// ---------------------------------------------------------------------------
// Kill-phase systems (kill/KillPhase.tsx, kill/systems/*.ts)
// ---------------------------------------------------------------------------

/** How often the player's own phasers can fire, once triggered and off cooldown. */
export const PLAYER_FIRE_COOLDOWN_MS = 250

// How far from the arena's center a star hazard sits - comfortably clear
// of the player's center-spawn point so the fight never starts already
// inside the hazard.
export const STAR_DISTANCE_FROM_CENTER = 160

/** Continuous hull damage per second of contact - close to a full-health ship's hull in under 2 seconds. Bypasses shields; a star isn't weapon fire. */
export const STAR_DAMAGE_PER_SECOND = 60

/** Degrees/sec a homing torpedo can turn - fast enough to reliably curve onto its target within the arena. */
export const HOMING_TURN_RATE = 260

export const HOSTILE_FIRE_COOLDOWN_MS = 1500
export const HOSTILE_WEAPON_DAMAGE = 8
export const HOSTILE_WEAPON_SPEED = 220

// ---------------------------------------------------------------------------
// Player ship handling (kill/input.ts)
// ---------------------------------------------------------------------------

export const ROTATION_SPEED = 220 // degrees/sec
export const THRUST_ACCEL = 180 // px/sec^2
export const MAX_SPEED = 260 // px/sec
export const DRAG = 0.35 // fraction of velocity bled off per second - arcade feel, not true inertia
