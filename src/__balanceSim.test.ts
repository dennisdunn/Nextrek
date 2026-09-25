// Headless balance simulator - NOT part of the app or CI. Runs the real
// hunt-phase economy functions and the real kill-phase bitECS systems
// (everything except rendering and human input) with a scripted bot player,
// many times over, to compare candidate difficulty parameter sets by actual
// outcome statistics rather than guesswork. See the chat transcript this
// was written for; delete this file (or keep it as a project tool) once
// its job is done.
import { entityExists, query } from 'bitecs'
import { describe, it } from 'vitest'
import { impulseNeighbors, createGalaxy } from './hunt/galaxy'
import { missionStatus, isStranded, stardateCost, STARTING_STARDATE } from './hunt/mission'
import { canAfford, longRangeScanCost, moveCost } from './hunt/ship'
import {
  allocate,
  applySubsystemWear,
  degradedCostMultiplier,
  fullSubsystemHealth,
  refund,
  systemEfficiency,
  type EnergyPools,
  type SubsystemHealth,
} from './hunt/subsystems'
import { BASE_HULL_HEALTH, BASE_WEAPON_DAMAGE, PHASER_COST_PER_SHOT, PHASER_DAMAGE_PER_LEVEL, TORPEDO_COOLDOWN_MS, TORPEDO_DAMAGE, TORPEDO_SPEED, TORPEDO_TTL_MS } from './kill/loadout'
import { spawnHazard, spawnHostile, spawnPlayer, spawnProjectile } from './kill/spawn'
import { ageoutSystem } from './kill/systems/ageout'
import { boundarySystem } from './kill/systems/boundary'
import { collisionSystem } from './kill/systems/collision'
import { hazardSystem } from './kill/systems/hazard'
import { homingSystem } from './kill/systems/homing'
import { physicsSystem } from './kill/systems/physics'
import { pruneSystem } from './kill/systems/prune'
import { createKillWorld, type KillWorld } from './kill/world'
import { HOSTILE_WEAPON_SPEED, PLAYER_FIRE_COOLDOWN_MS, STAR_DISTANCE_FROM_CENTER } from './balance'

const WIDTH = 640
const HEIGHT = 480
const DT_MS = 50 // matches KillPhase's own MAX_FRAME_MS clamp
const MAX_FIGHT_MS = 90_000
const MAX_MISSION_STEPS = 2000

function headingTo(fromX: number, fromY: number, toX: number, toY: number): number {
  const degrees = (Math.atan2(toX - fromX, -(toY - fromY)) * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}

function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}

/**
 * A local stand-in for kill/systems/hostileAi.ts's hostileAiSystem, parameterized
 * by damage/cooldown/speed instead of reading the fixed balance.ts constants -
 * this is what actually lets a difficulty preset vary hostile aggression in
 * simulateCombat below. Kept in lockstep with the real system's firing logic.
 */
function hostileFireSystem(
  world: KillWorld,
  playerEid: number,
  damage: number,
  cooldownMs: number,
  speed: number,
): void {
  if (!entityExists(world, playerEid)) return
  const { Position, FireCooldown } = world.components

  for (const eid of query(world, [Position, FireCooldown, world.components.Hostile])) {
    FireCooldown[eid] -= world.time.delta
    if (FireCooldown[eid] > 0) continue

    const heading = headingTo(Position.x[eid], Position.y[eid], Position.x[playerEid], Position.y[playerEid])
    spawnProjectile(world, { x: Position.x[eid], y: Position.y[eid], heading, owner: eid, damage, speed })
    FireCooldown[eid] = cooldownMs
  }
}

interface CombatOutcome {
  outcome: 'victory' | 'defeat' | 'timeout'
  hostileHealthsRemaining: number[]
  hullDamageTaken: number
  leftoverShieldEnergy: number
  leftoverPhaserEnergy: number
  torpedoesRemaining: number
}

/**
 * A scripted "reasonably competent, meta-aware" player: turns toward and
 * closes on the nearest hostile, fires phasers when roughly aimed and
 * charged, fires torpedoes whenever off cooldown (torpedoes are the
 * stronger weapon - see the playtest notes), steers away from a star
 * hazard on approach, and - critically - flees (see FLEE_HULL_FRACTION)
 * once badly hurt, the same way a real player disengages by switching to
 * Sciences and moving away (GameShell.tsx's handleMove: "moving at all
 * while an encounter is active *is* fleeing it"). Without this a scripted
 * bot fights every encounter to the death and 'destroyed' rates come out
 * far higher than real play. Fixed across every trial so relative
 * comparisons between candidate parameter sets stay meaningful even
 * though this bot isn't a perfect stand-in for a real player.
 */
const FLEE_HULL_FRACTION = 0.25
function simulateCombat(opts: {
  hostileHealths: number[]
  hasStarHazard: boolean
  shieldLevel: number
  phaserLevel: number
  torpedoesAvailable: number
  hostileWeaponDamage: number
  hostileFireCooldownMs: number
}): CombatOutcome {
  const world = createKillWorld()
  const playerEid = spawnPlayer(world, {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    health: BASE_HULL_HEALTH,
    shieldEnergy: Math.max(0, opts.shieldLevel),
    phaserEnergy: Math.max(0, opts.phaserLevel),
  })
  const hostileEids = opts.hostileHealths.map((health) =>
    spawnHostile(world, { x: Math.random() * WIDTH, y: Math.random() * HEIGHT, health }),
  )
  let starPos: { x: number; y: number } | null = null
  if (opts.hasStarHazard) {
    const angle = Math.random() * Math.PI * 2
    starPos = {
      x: WIDTH / 2 + Math.cos(angle) * STAR_DISTANCE_FROM_CENTER,
      y: HEIGHT / 2 + Math.sin(angle) * STAR_DISTANCE_FROM_CENTER,
    }
    spawnHazard(world, starPos)
  }

  let elapsed = 0
  let fireCooldown = 0
  let torpedoCooldown = 0
  let torpedoesLeft = opts.torpedoesAvailable
  let leftoverShieldEnergy = Math.max(0, opts.shieldLevel)
  let leftoverPhaserEnergy = Math.max(0, opts.phaserLevel)
  let lastHullHealth = BASE_HULL_HEALTH
  world.time.delta = DT_MS

  const weaponDamage = BASE_WEAPON_DAMAGE + Math.max(0, opts.phaserLevel) * PHASER_DAMAGE_PER_LEVEL

  function nearestAliveHostile(x: number, y: number): number | undefined {
    let best: number | undefined
    let bestDistSq = Infinity
    for (const eid of hostileEids) {
      if (!entityExists(world, eid)) continue
      const dx = world.components.Position.x[eid] - x
      const dy = world.components.Position.y[eid] - y
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = eid
      }
    }
    return best
  }

  while (elapsed < MAX_FIGHT_MS) {
    elapsed += DT_MS
    fireCooldown = Math.max(0, fireCooldown - DT_MS)
    torpedoCooldown = Math.max(0, torpedoCooldown - DT_MS)

    const playerAlive = entityExists(world, playerEid)
    if (!playerAlive) break
    const allHostilesDown = hostileEids.every((eid) => !entityExists(world, eid))
    if (allHostilesDown) break

    const px = world.components.Position.x[playerEid]
    const py = world.components.Position.y[playerEid]
    const heading = world.components.Heading[playerEid]
    const target = nearestAliveHostile(px, py)

    let input = { left: false, right: false, thrust: false, fire: false, torpedo: false }
    let desiredHeading: number | null = null
    let wantThrust = false

    // Star avoidance takes priority over engaging - a real player dodges
    // the star before worrying about aim.
    const distToStar = starPos ? Math.hypot(px - starPos.x, py - starPos.y) : Infinity
    if (starPos && distToStar < STAR_DISTANCE_FROM_CENTER * 0.9) {
      desiredHeading = headingTo(starPos.x, starPos.y, px, py) // away from the star
      wantThrust = true
    } else if (target !== undefined) {
      const tx = world.components.Position.x[target]
      const ty = world.components.Position.y[target]
      const dist = Math.hypot(tx - px, ty - py)
      desiredHeading = headingTo(px, py, tx, ty)
      wantThrust = dist > 150
    }

    if (desiredHeading !== null) {
      const diff = angleDiff(desiredHeading, heading)
      if (diff > 5) input.right = true
      else if (diff < -5) input.left = true
      input.thrust = wantThrust
    }

    // Fire phasers when roughly aimed and charged.
    if (target !== undefined && desiredHeading !== null) {
      const aimDiff = Math.abs(angleDiff(desiredHeading, heading))
      if (
        aimDiff < 20 &&
        fireCooldown === 0 &&
        world.components.PhaserEnergy[playerEid] >= PHASER_COST_PER_SHOT
      ) {
        fireCooldown = PLAYER_FIRE_COOLDOWN_MS
        world.components.PhaserEnergy[playerEid] -= PHASER_COST_PER_SHOT
        spawnProjectile(world, { x: px, y: py, heading, owner: playerEid, damage: weaponDamage })
      }
    }

    // Fire torpedoes opportunistically whenever available.
    if (target !== undefined && torpedoCooldown === 0 && torpedoesLeft > 0) {
      torpedoCooldown = TORPEDO_COOLDOWN_MS
      torpedoesLeft -= 1
      spawnProjectile(world, {
        x: px,
        y: py,
        heading,
        owner: playerEid,
        damage: TORPEDO_DAMAGE,
        speed: TORPEDO_SPEED,
        ttl: TORPEDO_TTL_MS,
        homingTarget: target,
      })
    }

    // Apply the scripted rotation/thrust the same way inputSystem would,
    // inlined here since inputSystem also reads real key state we don't have.
    const ROTATION_SPEED = 220
    const THRUST_ACCEL = 180
    const MAX_SPEED = 260
    const DRAG = 0.35
    const dt = DT_MS / 1000
    if (input.left) world.components.Heading[playerEid] -= ROTATION_SPEED * dt
    if (input.right) world.components.Heading[playerEid] += ROTATION_SPEED * dt
    world.components.Heading[playerEid] =
      ((world.components.Heading[playerEid] % 360) + 360) % 360
    if (input.thrust) {
      const rad = (world.components.Heading[playerEid] * Math.PI) / 180
      world.components.Velocity.x[playerEid] += Math.sin(rad) * THRUST_ACCEL * dt
      world.components.Velocity.y[playerEid] += -Math.cos(rad) * THRUST_ACCEL * dt
    }
    world.components.Velocity.x[playerEid] *= 1 - DRAG * dt
    world.components.Velocity.y[playerEid] *= 1 - DRAG * dt
    const speed = Math.hypot(world.components.Velocity.x[playerEid], world.components.Velocity.y[playerEid])
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed
      world.components.Velocity.x[playerEid] *= scale
      world.components.Velocity.y[playerEid] *= scale
    }

    hostileFireSystem(world, playerEid, opts.hostileWeaponDamage, opts.hostileFireCooldownMs, HOSTILE_WEAPON_SPEED)
    homingSystem(world)
    physicsSystem(world)
    boundarySystem(world, { width: WIDTH, height: HEIGHT })
    hazardSystem(world)
    collisionSystem(world)
    ageoutSystem(world)

    if (entityExists(world, playerEid)) {
      leftoverShieldEnergy = world.components.ShieldEnergy[playerEid]
      leftoverPhaserEnergy = world.components.PhaserEnergy[playerEid]
      lastHullHealth = world.components.Health[playerEid]
    }
    pruneSystem(world)

    if (entityExists(world, playerEid) && lastHullHealth / BASE_HULL_HEALTH < FLEE_HULL_FRACTION) break
  }

  const hostileHealthsRemaining = hostileEids.map((eid) =>
    entityExists(world, eid) ? Math.max(0, world.components.Health[eid]) : 0,
  )
  const hullDamageTaken = Math.max(0, BASE_HULL_HEALTH - lastHullHealth)
  const playerAlive = entityExists(world, playerEid)
  const allHostilesDown = hostileHealthsRemaining.every((h) => h <= 0)

  return {
    outcome: !playerAlive ? 'defeat' : allHostilesDown ? 'victory' : 'timeout',
    hostileHealthsRemaining: allHostilesDown ? hostileHealthsRemaining.map(() => 0) : hostileHealthsRemaining,
    hullDamageTaken,
    leftoverShieldEnergy: Math.max(0, leftoverShieldEnergy),
    leftoverPhaserEnergy: Math.max(0, leftoverPhaserEnergy),
    torpedoesRemaining: torpedoesLeft,
  }
}

interface DifficultyParams {
  hostileDensity: number
  anomalyDensity: number
  starbaseDensity: number
  starHazardDensity: number
  hostileQuota: number
  stardateBudget: number
  hostileHullHealth: number
  hostileWeaponDamage: number
  hostileFireCooldownMs: number
  maxHostilesPerSector: number
  startingEnergy: number
  startingTorpedoes: number
}

interface MissionResult {
  outcome: 'victory' | 'timeout' | 'stranded' | 'destroyed' | 'inconclusive'
  stardateUsed: number
  hostilesDestroyed: number
  fights: number
}

function simulateMission(p: DifficultyParams): MissionResult {
  const galaxy = createGalaxy({
    hostileDensity: p.hostileDensity,
    anomalyDensity: p.anomalyDensity,
    starbaseDensity: p.starbaseDensity,
    starHazardDensity: p.starHazardDensity,
  })
  let position = [...galaxy.nodes.keys()][0]
  // createGalaxy always treats {region:0,ring:0} as home by default - find it directly.
  for (const id of galaxy.nodes.keys()) {
    if (galaxy.getNode(id) && id === '0,0') position = id
  }

  let stardate = STARTING_STARDATE
  let energy: EnergyPools = { reserve: p.startingEnergy, shields: 0, phasers: 0 }
  let subsystems: SubsystemHealth = fullSubsystemHealth()
  let torpedoes = p.startingTorpedoes
  let hostilesDestroyed = 0
  let fights = 0
  const visited = new Set([position])
  const scanned = new Set<string>()

  for (let step = 0; step < MAX_MISSION_STEPS; step++) {
    const status = missionStatus(hostilesDestroyed, stardate)
    if (status === 'victory') return { outcome: 'victory', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }
    if (status === 'defeat') return { outcome: 'timeout', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }

    const totalEnergy = energy.reserve + energy.shields + energy.phasers
    const cheapestMove = MOVE_COST_NORMAL_FOR(subsystems)
    if (isStranded(totalEnergy, cheapestMove)) {
      return { outcome: 'stranded', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }
    }

    const neighbors = impulseNeighbors(position)
    if (neighbors.length === 0) return { outcome: 'inconclusive', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }

    // Scan once per newly-reached area so the bot can see what's nearby.
    const anyUnknown = neighbors.some((n) => !visited.has(n) && !scanned.has(n))
    if (anyUnknown) {
      const scanCost = Math.round(longRangeScanCost(false) * degradedCostMultiplier(subsystems.sensors))
      if (canAfford(energy.reserve, scanCost)) {
        energy = { ...energy, reserve: energy.reserve - scanCost }
        for (const n of neighbors) scanned.add(n)
      }
    }

    const known = (id: string) => visited.has(id) || scanned.has(id)
    const knownHostileNeighbor = neighbors.find((n) => known(n) && galaxy.getNode(n)?.hostile)
    const unvisitedNeighbor = neighbors.find((n) => !visited.has(n))
    const targetId = knownHostileNeighbor ?? unvisitedNeighbor ?? neighbors[Math.floor(Math.random() * neighbors.length)]

    const moveCostVal = Math.round(moveCost(false, 1) * degradedCostMultiplier(subsystems.impulseEngines))
    if (!canAfford(energy.reserve, moveCostVal)) {
      return { outcome: 'stranded', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }
    }
    energy = { ...energy, reserve: energy.reserve - moveCostVal }
    stardate += stardateCost(false)
    position = targetId
    visited.add(targetId)

    const sector = galaxy.getNode(targetId)
    if (sector?.starbase) {
      energy = { reserve: p.startingEnergy, shields: 0, phasers: 0 }
      subsystems = fullSubsystemHealth()
      torpedoes = p.startingTorpedoes
    } else if (sector?.hostile) {
      fights += 1
      // Sensible pre-fight allocation: about 40% of current reserve each to
      // shields/phasers, capped by subsystem health and by what's affordable.
      const shieldCap = 100 * systemEfficiency(subsystems.shieldGenerator)
      const phaserCap = 100 * systemEfficiency(subsystems.phaserArray)
      const shieldAlloc = Math.min(shieldCap, energy.reserve * 0.4)
      energy = allocate(energy, 'shields', shieldAlloc, shieldCap)
      const phaserAlloc = Math.min(phaserCap, energy.reserve * 0.4)
      energy = allocate(energy, 'phasers', phaserAlloc, phaserCap)

      const hostileHealths = Array.from(
        { length: 1 + Math.floor(Math.random() * p.maxHostilesPerSector) },
        () => p.hostileHullHealth,
      )
      const result = simulateCombat({
        hostileHealths,
        hasStarHazard: false,
        shieldLevel: energy.shields,
        phaserLevel: energy.phasers,
        torpedoesAvailable: torpedoes,
        hostileWeaponDamage: p.hostileWeaponDamage,
        hostileFireCooldownMs: p.hostileFireCooldownMs,
      })

      const kills = result.hostileHealthsRemaining.filter((h) => h <= 0).length
      const wear = applySubsystemWear(subsystems, result.hullDamageTaken)
      subsystems = wear.subsystems
      const refunded = refund(result.leftoverShieldEnergy, result.leftoverPhaserEnergy, energy)
      const shieldCap2 = 100 * systemEfficiency(subsystems.shieldGenerator)
      const phaserCap2 = 100 * systemEfficiency(subsystems.phaserArray)
      energy = allocate(
        allocate(refunded, 'shields', Math.min(refunded.shields, shieldCap2), shieldCap2),
        'phasers',
        Math.min(refunded.phasers, phaserCap2),
        phaserCap2,
      )
      torpedoes = result.torpedoesRemaining
      hostilesDestroyed += kills

      if (result.outcome === 'defeat') {
        return { outcome: 'destroyed', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }
      }
    }
  }
  return { outcome: 'inconclusive', stardateUsed: stardate - STARTING_STARDATE, hostilesDestroyed, fights }
}

function MOVE_COST_NORMAL_FOR(subsystems: SubsystemHealth): number {
  return Math.round(moveCost(false, 1) * degradedCostMultiplier(subsystems.impulseEngines))
}

function runTrials(p: DifficultyParams, n: number) {
  const outcomes: Record<string, number> = {}
  let totalStardate = 0
  let totalFights = 0
  let totalKills = 0
  for (let i = 0; i < n; i++) {
    const r = simulateMission(p)
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1
    totalStardate += r.stardateUsed
    totalFights += r.fights
    totalKills += r.hostilesDestroyed
  }
  return {
    outcomes,
    winRate: (outcomes.victory ?? 0) / n,
    avgStardateUsed: totalStardate / n,
    avgFights: totalFights / n,
    avgKills: totalKills / n,
  }
}

describe('balance simulation', () => {
  it(
    'sweeps candidate difficulty presets',
    () => {
      // 300 trials wasn't enough to separate these reliably - at ~7-10% win
      // rates the binomial noise (SE ~1.5pp) swamped the gap between
      // presets and the hard/normal ordering flipped between runs. 1500
      // narrows that to within ~1pp.
      const N = 1500
      const presets: Record<string, DifficultyParams> = {
        currentDefault: {
          hostileDensity: 0.12,
          anomalyDensity: 0.08,
          starbaseDensity: 0.05,
          starHazardDensity: 0.1,
          hostileQuota: 15,
          stardateBudget: 20,
          hostileHullHealth: 40,
          hostileWeaponDamage: 8,
          hostileFireCooldownMs: 1500,
          maxHostilesPerSector: 3,
          startingEnergy: 1000,
          startingTorpedoes: 10,
        },
        easyCandidate: {
          hostileDensity: 0.08,
          anomalyDensity: 0.06,
          starbaseDensity: 0.1,
          starHazardDensity: 0.05,
          hostileQuota: 10,
          stardateBudget: 30,
          hostileHullHealth: 30,
          hostileWeaponDamage: 6,
          hostileFireCooldownMs: 1800,
          maxHostilesPerSector: 2,
          startingEnergy: 1400,
          startingTorpedoes: 14,
        },
        hardCandidate: {
          hostileDensity: 0.18,
          anomalyDensity: 0.1,
          starbaseDensity: 0.04,
          starHazardDensity: 0.14,
          hostileQuota: 18,
          stardateBudget: 17,
          hostileHullHealth: 50,
          hostileWeaponDamage: 11,
          hostileFireCooldownMs: 1250,
          maxHostilesPerSector: 3,
          startingEnergy: 900,
          startingTorpedoes: 8,
        },
      }

      for (const [name, params] of Object.entries(presets)) {
        const stats = runTrials(params, N)
        console.log(`\n=== ${name} (n=${N}) ===`)
        console.log(JSON.stringify(stats, null, 2))
      }
    },
    120_000,
  )
})
