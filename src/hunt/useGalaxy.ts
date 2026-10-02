import { useCallback, useMemo, useRef, useState } from 'react'
import { BARRIER_POWERUP_COOLDOWN_STARDATES, COMMS_LOG_LIMIT, DIFFICULTY_PRESETS, type Difficulty } from '../balance'
import { barrier } from '../graph/anomalies'
import type { NodeId } from '../graph/UndoGraph'
import { pickGateDestination } from './anomalyEffects'
import { sectorId } from './cartography'
import {
  createGalaxy,
  disengageWarp,
  engageWarp,
  impulseNeighbors,
  randomHomeSector,
  type CreateGalaxyOptions,
} from './galaxy'
import { isStranded, missionStatus, stardateCost, STARTING_STARDATE, tacticalAlert, type DefeatReason } from './mission'
import { knownSectors, sensedAnomalies, sensedHostiles } from './sensors'
import { canAfford, longRangeScanCost, moveCost, MOVE_COST_NORMAL, subspaceScanCost, WARP_ENGAGE_COST } from './ship'
import {
  allocate,
  applySubsystemWear,
  degradedCostMultiplier,
  fullSubsystemHealth,
  refund,
  REFUND_EFFICIENCY,
  SHIP_SYSTEM_LABEL,
  systemEfficiency,
  type EnergyPools,
  type Subsystem,
  type SubsystemHealth,
} from './subsystems'

export interface HuntState {
  position: NodeId
  warpEngaged: boolean
  stardate: number
  energy: EnergyPools
  subsystems: SubsystemHealth
  /** Game-wide torpedo inventory - a limited physical supply, not energy, restocked only at a starbase. */
  torpedoes: number
  /** Hostiles destroyed so far this mission, toward mission.ts's HOSTILE_QUOTA. */
  hostilesDestroyed: number
  /** Set once a kill-phase encounter actually ends in the player's hull reaching 0 - a third, sticky way to lose (see resolveEncounter). */
  shipDestroyed: boolean
  visited: Set<NodeId>
  /** Sectors a long-range scan has revealed - what the strategic map shows, beyond what's been visited. */
  scanned: Set<NodeId>
  /** Sectors a subspace scan has checked for an anomaly (whether or not it found one). */
  scannedAnomalies: Set<NodeId>
  /**
   * Barrier sectors whose power-up (see anomalySeeding.ts's AnomalyPlacement)
   * has been claimed, mapped to the stardate it was last drawn - tracked
   * here in React state, deliberately not on the graph node itself. A node
   * mutation pushes onto the same shared undo stack toggleWarp/
   * disengageWarp pop from (see UndoGraph.ts), and a barrier is exactly the
   * kind of sector you might still be under warp when you first enter (see
   * warpEnteredBarrier) - disengaging warp afterward would pop whatever was
   * pushed most recently, which could be this instead of the warp edge-set.
   * Keeping it out of the graph entirely sidesteps that risk rather than
   * relying on call-order luck. The timestamp lets a cache recharge after
   * BARRIER_POWERUP_COOLDOWN_STARDATES rather than being a one-shot pickup -
   * see moveTo.
   */
  collectedPowerUps: Map<NodeId, number>
  /**
   * The barrier sector the ship currently occupies, if it got in via warp -
   * null otherwise. barrier() only strips edges from whichever edge set is
   * currently live, so triggering it under warp only ever touches the warp
   * network; the impulse layer underneath was never mutated and is still
   * fully intact. Leaving re-asserts that intact layer, so it's tracked
   * here purely to log the "it healed" moment on departure.
   */
  warpEnteredBarrier: NodeId | null
  log: string[]
}

export interface UseGalaxyOptions extends CreateGalaxyOptions {
  /** Selected at mission start (see game/StartScreen.tsx) - defaults to 'normal' (today's balance.ts values). */
  difficulty?: Difficulty
}

/**
 * React glue around the UndoGraph-backed galaxy. The graph is mutable and
 * lives outside React state; a version counter forces a re-render whenever
 * a mutation (move, warp, undo) changes what the graph reports.
 */
export function useGalaxy(options?: UseGalaxyOptions) {
  // Only supplies defaults for whichever of these the caller didn't already
  // pass explicitly - a test overriding hostileDensity to 0, say, still
  // gets that 0 rather than the preset's value (?? only falls back on
  // null/undefined, and 0 is neither).
  const preset = DIFFICULTY_PRESETS[options?.difficulty ?? 'normal']
  const missionConfig = { hostileQuota: preset.hostileQuota, stardateBudget: preset.stardateBudget }

  // A caller-supplied homeSector is honored as-is (tests rely on this for a
  // deterministic start); otherwise a fresh mission starts somewhere new
  // each time. Either way, createGalaxy's own home-exclusion logic keeps
  // whichever sector this resolves to clear of hostiles/anomalies/starbases.
  // Deliberately computed once (empty deps): the galaxy and home sector are
  // fixed for this component's whole lifetime - a new mission remounts
  // GameShell from scratch (see App.tsx's gameKey) rather than reacting to
  // an options/difficulty change after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const homeSector = useMemo(() => options?.homeSector ?? randomHomeSector(options?.rng), [])
  /* eslint-disable react-hooks/exhaustive-deps */
  const galaxy = useMemo(
    () =>
      createGalaxy({
        hostileDensity: options?.hostileDensity ?? preset.hostileDensity,
        anomalyDensity: options?.anomalyDensity ?? preset.anomalyDensity,
        starbaseDensity: options?.starbaseDensity ?? preset.starbaseDensity,
        starHazardDensity: options?.starHazardDensity ?? preset.starHazardDensity,
        maxHostilesPerSector: options?.maxHostilesPerSector ?? preset.maxHostilesPerSector,
        rng: options?.rng,
        homeSector,
      }),
    [],
  )
  /* eslint-enable react-hooks/exhaustive-deps */
  const home = sectorId(homeSector.region, homeSector.ring)
  const [, setVersion] = useState(0)
  const [state, setState] = useState<HuntState>({
    position: home,
    warpEngaged: false,
    stardate: STARTING_STARDATE,
    energy: { reserve: preset.startingEnergy, shields: 0, phasers: 0 },
    subsystems: fullSubsystemHealth(),
    torpedoes: preset.startingTorpedoes,
    hostilesDestroyed: 0,
    shipDestroyed: false,
    visited: new Set([home]),
    scanned: new Set(),
    scannedAnomalies: new Set(),
    collectedPowerUps: new Map(),
    warpEnteredBarrier: null,
    log: ['Sensors online. Awaiting orders.'],
  })

  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const appendLog = useCallback(
    (message: string) => setState((s) => ({ ...s, log: [...s.log.slice(-(COMMS_LOG_LIMIT - 1)), message] })),
    [],
  )
  // Lets resolveEncounter read the latest state without closing over it
  // directly, which would force it to change identity (via useCallback's
  // deps) on every energy tweak - and KillPhase rebuilds its whole bitECS
  // world, respawning hostiles at new random positions, whenever the
  // onResolved prop it was handed changes identity mid-fight.
  const stateRef = useRef(state)
  stateRef.current = state

  // The graph's undo-depth from just before the current warp session
  // engaged (null while not engaged) - see galaxy.ts's engageWarp/
  // disengageWarp. Needs to survive between the toggleWarp call that
  // engages and the later one that disengages, without itself triggering a
  // re-render, so a ref rather than HuntState.
  const warpCheckpointRef = useRef<number | null>(null)

  const currentSector = galaxy.getNode(state.position)
  const neighbors = galaxy.neighbors(state.position)
  const known = knownSectors(state.visited, state.scanned)
  // Reaching an anomaly's own log/marker doesn't require paying for a scan -
  // stumbling into one (or being flung through it) reveals it just as well,
  // per state.visited below.
  const anomalyKnown = new Set([...state.scannedAnomalies, ...state.visited])
  const sensedDanger = sensedHostiles(galaxy, state.position)
  const alert = tacticalAlert(Boolean(currentSector?.hostile), sensedDanger.length)

  const timeQuotaStatus = missionStatus(state.hostilesDestroyed, state.stardate, missionConfig)
  // Shield/phaser energy is reclaimable back to reserve outside combat (see
  // subsystems.ts's allocate), so it's the combined total - not reserve
  // alone - that has to run dry to truly be unrecoverable. The cheapest
  // move is always a no-cost warp disengage followed by an impulse hop.
  const totalEnergy = state.energy.reserve + state.energy.shields + state.energy.phasers
  const cheapestMoveCost = MOVE_COST_NORMAL * degradedCostMultiplier(state.subsystems.impulseEngines)
  const stranded = isStranded(totalEnergy, cheapestMoveCost)
  // Ship-destroyed takes priority over the other two: it's a discrete event
  // that already happened (see resolveEncounter), not a numeric threshold
  // that could in principle resolve either way depending on when it's read.
  const status = state.shipDestroyed
    ? 'defeat'
    : timeQuotaStatus !== 'active'
      ? timeQuotaStatus
      : stranded
        ? 'defeat'
        : 'active'
  const defeatReason: DefeatReason | null =
    status !== 'defeat'
      ? null
      : state.shipDestroyed
        ? 'destroyed'
        : timeQuotaStatus === 'defeat'
          ? 'timeout'
          : 'stranded'

  const moveTo = useCallback(
    (target: NodeId): NodeId | false => {
      const edge = galaxy.outgoingEdges(state.position).find((e) => e.to === target)
      if (!edge) return false
      const baseCost = moveCost(state.warpEngaged, edge.data?.distance ?? 1)
      // Impulse engines drive sublight travel only - a warp jump's cost
      // answers to the warp drive's own health instead (see toggleWarp).
      const cost = state.warpEngaged
        ? baseCost
        : Math.round(baseCost * degradedCostMultiplier(state.subsystems.impulseEngines))
      if (!canAfford(state.energy.reserve, cost)) {
        appendLog('Insufficient energy to move - reserves critical.')
        return false
      }

      const departedFrom = state.position
      const leavingWarpEnteredBarrier = state.warpEnteredBarrier === departedFrom
      const sector = galaxy.getNode(target)
      const anomaly = sector?.anomaly
      const arrivedViaConduit = Boolean(edge.data?.viaConduit)

      // Where the ship actually ends up, once an anomaly's own effect (if
      // any) has run - may differ from `target` for a gate, or for an
      // ordinary (non-conduit-link) entry into a conduit sector. `target`
      // itself still counts as visited either way: the ship was physically
      // there, however briefly.
      let landedAt = target
      let message: string

      if (anomaly?.kind === 'barrier') {
        // Activates the instant you walk in: severs every route back into
        // it. You can still leave via any of its own outgoing edges - it
        // blocks entry, not exit - you just won't be getting back in...
        // unless this was under warp, in which case the strip only ever
        // touched the warp network, not the impulse layer underneath (see
        // HuntState.warpEnteredBarrier) - a quirk left in deliberately.
        barrier(galaxy, target)
        message = `${sector!.name} - the barrier collapses inward behind the ship. No route leads back in.`
      } else if (anomaly?.kind === 'gate') {
        // Blackhole Assisted Traversal: no choice in it, straight to a
        // random, non-anomaly sector well clear of where you just were.
        const redirect = pickGateDestination(
          [...galaxy.nodes.keys()],
          {
            home,
            departedFrom,
            nearbyDeparted: impulseNeighbors(departedFrom),
            hasAnomaly: (id) => Boolean(galaxy.getNode(id)?.anomaly),
          },
          Math.random,
        )
        if (redirect !== undefined) {
          landedAt = redirect
          const landedSector = galaxy.getNode(landedAt)
          message = `Blackhole-assisted traversal! ${sector!.name} flings the ship to ${landedSector?.name ?? landedAt}.`
        } else {
          message = `Moved to ${sector!.name}.`
        }
      } else if (anomaly?.kind === 'conduit' && !arrivedViaConduit) {
        // Walking up to a conduit sector the ordinary way just channels you
        // straight through to its paired sector instead of landing on it -
        // only arriving via the conduit link itself (from that partner) is
        // a real landing, hostile encounter included.
        landedAt = anomaly.link!
        const landedSector = galaxy.getNode(landedAt)
        message = `Conduit resonance pulls the ship through to ${landedSector?.name ?? landedAt}.`
      } else {
        message = `Moved to ${sector?.name ?? target}.`
      }

      const landedSector = galaxy.getNode(landedAt)
      const nextWarpEnteredBarrier =
        landedSector?.anomaly?.kind === 'barrier' && state.warpEngaged ? landedAt : null
      // Docking is automatic and unconditional, same as every other
      // sector-entry effect (hostile, barrier, gate, conduit) - there's no
      // reason to gate a no-cost, no-choice restoration behind a command.
      const docked = Boolean(landedSector?.starbase)
      // A barrier's power-up (if it has one) is also unconditional on entry,
      // same as docking - and mutually exclusive with it, since seeding
      // never puts a starbase and an anomaly on the same sector. Collection
      // is tracked here in HuntState rather than via galaxy.setNode: a node
      // mutation pushes onto the same shared undo stack toggleWarp/
      // disengageWarp pop from (see UndoGraph.ts), and a barrier is exactly
      // the kind of sector you might still be under warp when you first
      // enter (see warpEnteredBarrier above) - a later disengageWarp() could
      // then pop this mutation instead of the warp edge-set. Keeping
      // collection out of the graph entirely sidesteps that risk. It's a
      // rechargeable draw, not a one-shot pickup - but only reachable at all
      // a second time if this barrier was entered via warp (which heals);
      // an impulse entry seals the only route in for good, so the cooldown
      // below never gets a chance to matter there.
      const nextStardate = state.stardate + stardateCost(state.warpEngaged)
      const rawPowerUp = landedSector?.anomaly?.kind === 'barrier' ? landedSector.anomaly.powerUp : undefined
      const lastCollectedAt = state.collectedPowerUps.get(landedAt)
      const onCooldown =
        lastCollectedAt !== undefined && nextStardate - lastCollectedAt < BARRIER_POWERUP_COOLDOWN_STARDATES
      const powerUp = rawPowerUp && !onCooldown ? rawPowerUp : undefined

      setState((s) => ({
        ...s,
        position: landedAt,
        stardate: s.stardate + stardateCost(s.warpEngaged),
        energy: docked
          ? { reserve: preset.startingEnergy, shields: 0, phasers: 0 }
          : powerUp === 'energy'
            ? { ...s.energy, reserve: preset.startingEnergy }
            : { ...s.energy, reserve: s.energy.reserve - cost },
        subsystems: docked ? fullSubsystemHealth() : s.subsystems,
        torpedoes: docked || powerUp === 'torpedoes' ? preset.startingTorpedoes : s.torpedoes,
        visited: new Set(s.visited).add(target).add(landedAt),
        warpEnteredBarrier: nextWarpEnteredBarrier,
        collectedPowerUps: powerUp
          ? new Map(s.collectedPowerUps).set(landedAt, nextStardate)
          : s.collectedPowerUps,
      }))
      appendLog(message)
      if (docked) {
        appendLog(
          `Docked at ${landedSector!.name} starbase - shields, phasers, and reserves fully restored; all systems repaired; torpedo bay restocked.`,
        )
      }
      if (powerUp === 'energy') {
        appendLog('Energy cache found - reserves fully replenished.')
      } else if (powerUp === 'torpedoes') {
        appendLog('Torpedo cache found - torpedo bay restocked.')
      } else if (rawPowerUp && onCooldown) {
        appendLog("The cache here hasn't recharged yet.")
      }
      if (leavingWarpEnteredBarrier) {
        const departedName = galaxy.getNode(departedFrom)?.name ?? departedFrom
        appendLog(`${departedName} - the barrier anomaly has healed.`)
      }
      if (sensedAnomalies(galaxy, landedAt).length > 0) {
        appendLog('Subspace variance detected nearby.')
      }
      if (sensedHostiles(galaxy, landedAt).length > 0) {
        appendLog('Hostiles detected nearby.')
      }
      return landedAt
    },
    [
      galaxy,
      state.position,
      state.warpEngaged,
      state.energy.reserve,
      state.warpEnteredBarrier,
      state.subsystems.impulseEngines,
      state.collectedPowerUps,
      state.stardate,
      home,
      appendLog,
      preset,
    ],
  )

  const toggleWarp = useCallback(() => {
    if (state.warpEngaged) {
      // warpCheckpointRef is only ever null while !state.warpEngaged (set in
      // the branch below, cleared here) - the ?? 0 fallback is defensive,
      // not an expected path.
      disengageWarp(galaxy, warpCheckpointRef.current ?? 0)
      warpCheckpointRef.current = null
      setState((s) => ({ ...s, warpEngaged: false }))
      appendLog('Warp drive disengaged.')
    } else {
      if (state.subsystems.warpDrive <= 0) {
        appendLog('Warp drive is offline - repairs needed at a starbase.')
        return
      }
      const cost = Math.round(WARP_ENGAGE_COST * degradedCostMultiplier(state.subsystems.warpDrive))
      if (!canAfford(state.energy.reserve, cost)) {
        appendLog('Insufficient energy to engage warp drive.')
        return
      }
      warpCheckpointRef.current = engageWarp(galaxy)
      setState((s) => ({
        ...s,
        warpEngaged: true,
        energy: { ...s.energy, reserve: s.energy.reserve - cost },
      }))
      appendLog('Warp drive engaged.')
    }
    bump()
  }, [galaxy, state.warpEngaged, state.energy.reserve, state.subsystems.warpDrive, appendLog, bump])

  /**
   * `inCombat` (true while an encounter is active - see GameShell's
   * `encounter` state) makes a *decrease* pay the same REFUND_EFFICIENCY
   * rate that standing shields/phasers down at the end of an encounter
   * already does, instead of the normal 1:1 reserve credit. Without this,
   * dragging the Engineering slider down right before a fight resolves
   * would let the player reclaim mid-fight energy at full value - the
   * exact cost resolveEncounter's own refund is supposed to impose on
   * whatever's left unspent. Outside combat there's no such fight to time
   * against, so a decrease is still a plain, lossless reallocation.
   */
  const allocateEnergy = useCallback(
    (subsystem: Subsystem, targetLevel: number, inCombat = false) => {
      setState((s) => {
        const health = subsystem === 'shields' ? s.subsystems.shieldGenerator : s.subsystems.phaserArray
        const maxLevel = 100 * systemEfficiency(health)
        const current = s.energy[subsystem]
        const available = s.energy.reserve + current
        const next = Math.max(0, Math.min(targetLevel, available, maxLevel))
        if (inCombat && next < current) {
          const decrease = current - next
          return {
            ...s,
            energy: { ...s.energy, [subsystem]: next, reserve: s.energy.reserve + decrease * REFUND_EFFICIENCY },
          }
        }
        return { ...s, energy: allocate(s.energy, subsystem, targetLevel, maxLevel) }
      })
    },
    [],
  )

  /**
   * The keyboard shortcuts' version of allocateEnergy (see ControlsPanel.tsx's
   * H/P bindings) - adds to whatever the subsystem is currently allocated
   * instead of setting an absolute target. Reads the current level from the
   * functional setState updater rather than a closed-over `state.energy`, so
   * back-to-back presses each add on top of the other's result instead of
   * racing against a stale value. Increment-only, so it never needs the
   * lossy-decrease handling above.
   */
  const adjustEnergy = useCallback((subsystem: Subsystem, amount: number) => {
    setState((s) => {
      const health = subsystem === 'shields' ? s.subsystems.shieldGenerator : s.subsystems.phaserArray
      const maxLevel = 100 * systemEfficiency(health)
      return { ...s, energy: allocate(s.energy, subsystem, s.energy[subsystem] + amount, maxLevel) }
    })
  }, [])

  /**
   * Fold a finished (or fled) encounter back into ship state: refund
   * whatever shield/phaser energy survived, and wear down a subsystem in
   * proportion to hull damage taken. One combined update rather than two
   * separate ones - both touch `energy`, and applying them as independent
   * setState calls risked one clobbering the other's result.
   */
  const resolveEncounter = useCallback(
    (
      hullDamageTaken: number,
      leftoverShieldEnergy: number,
      leftoverPhaserEnergy: number,
      torpedoesRemaining: number,
      hostilesKilled: number,
      /** True only when this encounter ended with the player's hull reaching 0 - never for a fled or won fight. */
      shipDestroyed = false,
    ) => {
      const current = stateRef.current
      const { subsystems, damagedSystem } = applySubsystemWear(current.subsystems, hullDamageTaken)
      const refunded = refund(leftoverShieldEnergy, leftoverPhaserEnergy, current.energy)
      // A shield generator or phaser array just damaged this same encounter
      // can drop below whatever the refund left allocated to it - re-clamp
      // both pools to their (possibly reduced) caps.
      const shieldCap = 100 * systemEfficiency(subsystems.shieldGenerator)
      const phaserCap = 100 * systemEfficiency(subsystems.phaserArray)
      const energy = allocate(
        allocate(refunded, 'shields', Math.min(refunded.shields, shieldCap), shieldCap),
        'phasers',
        Math.min(refunded.phasers, phaserCap),
        phaserCap,
      )
      const hostilesDestroyed = current.hostilesDestroyed + hostilesKilled
      setState((s) => ({
        ...s,
        subsystems,
        energy,
        torpedoes: torpedoesRemaining,
        hostilesDestroyed: s.hostilesDestroyed + hostilesKilled,
        shipDestroyed: s.shipDestroyed || shipDestroyed,
      }))

      if (shipDestroyed) {
        appendLog('Hull breach - the ship is lost.')
        return
      }

      const recovered = Math.round(Math.max(0, leftoverShieldEnergy + leftoverPhaserEnergy) * REFUND_EFFICIENCY)
      appendLog(
        recovered > 0
          ? `Shields and phasers stood down - ${recovered} energy recovered to the main reserve.`
          : 'Shields and phasers were fully depleted in the engagement.',
      )
      if (hostilesKilled > 0) {
        appendLog(
          `${hostilesKilled} hostile${hostilesKilled === 1 ? '' : 's'} destroyed - ${hostilesDestroyed}/${preset.hostileQuota} toward mission quota.`,
        )
      }
      if (damagedSystem) {
        appendLog(
          `${SHIP_SYSTEM_LABEL[damagedSystem]} damaged in the engagement - down to ${Math.round(subsystems[damagedSystem])}%.`,
        )
      }
    },
    [appendLog, preset],
  )

  const longRangeScan = useCallback(() => {
    const cost = Math.round(longRangeScanCost(state.warpEngaged) * degradedCostMultiplier(state.subsystems.sensors))
    if (!canAfford(state.energy.reserve, cost)) {
      appendLog('Insufficient energy for a long-range scan.')
      return false
    }
    const targets = galaxy.neighbors(state.position)
    setState((s) => ({
      ...s,
      energy: { ...s.energy, reserve: s.energy.reserve - cost },
      scanned: new Set([...s.scanned, ...targets]),
    }))
    appendLog(
      `Long-range scan complete: ${targets.length} sector${targets.length === 1 ? '' : 's'} mapped.`,
    )
    return true
  }, [galaxy, state.position, state.warpEngaged, state.energy.reserve, state.subsystems.sensors, appendLog])

  const subspaceScan = useCallback(() => {
    const cost = Math.round(subspaceScanCost(state.warpEngaged) * degradedCostMultiplier(state.subsystems.sensors))
    if (!canAfford(state.energy.reserve, cost)) {
      appendLog('Insufficient energy for a subspace scan.')
      return false
    }
    const targets = galaxy.neighbors(state.position)
    const found = targets.filter((id) => galaxy.getNode(id)?.anomaly).length
    setState((s) => ({
      ...s,
      energy: { ...s.energy, reserve: s.energy.reserve - cost },
      scannedAnomalies: new Set([...s.scannedAnomalies, ...targets]),
    }))
    appendLog(
      found > 0
        ? `Subspace scan complete: anomaly pinpointed in ${found} sector${found === 1 ? '' : 's'}.`
        : 'Subspace scan complete: no anomalies in range.',
    )
    return true
  }, [galaxy, state.position, state.warpEngaged, state.energy.reserve, state.subsystems.sensors, appendLog])

  return {
    galaxy,
    state,
    currentSector,
    neighbors,
    known,
    anomalyKnown,
    sensedDanger,
    alert,
    status,
    defeatReason,
    /** The active difficulty's full tuning, for anything downstream that needs a value not otherwise exposed above (e.g. hostile combat stats). */
    difficultyPreset: preset,
    missionConfig,
    moveTo,
    toggleWarp,
    allocateEnergy,
    adjustEnergy,
    resolveEncounter,
    longRangeScan,
    subspaceScan,
  }
}
