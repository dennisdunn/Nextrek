import { useCallback, useMemo, useRef, useState } from 'react'
import { COMMS_LOG_LIMIT } from '../balance'
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
import {
  HOSTILE_QUOTA,
  isStranded,
  missionStatus,
  stardateCost,
  STARTING_STARDATE,
  tacticalAlert,
  type DefeatReason,
} from './mission'
import { knownSectors, sensedAnomalies, sensedHostiles } from './sensors'
import {
  canAfford,
  longRangeScanCost,
  moveCost,
  MOVE_COST_NORMAL,
  STARTING_ENERGY,
  STARTING_TORPEDOES,
  subspaceScanCost,
  WARP_ENGAGE_COST,
} from './ship'
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
  visited: Set<NodeId>
  /** Sectors a long-range scan has revealed - what the strategic map shows, beyond what's been visited. */
  scanned: Set<NodeId>
  /** Sectors a subspace scan has checked for an anomaly (whether or not it found one). */
  scannedAnomalies: Set<NodeId>
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

/**
 * React glue around the UndoGraph-backed galaxy. The graph is mutable and
 * lives outside React state; a version counter forces a re-render whenever
 * a mutation (move, warp, undo) changes what the graph reports.
 */
export function useGalaxy(options?: CreateGalaxyOptions) {
  // A caller-supplied homeSector is honored as-is (tests rely on this for a
  // deterministic start); otherwise a fresh mission starts somewhere new
  // each time. Either way, createGalaxy's own home-exclusion logic keeps
  // whichever sector this resolves to clear of hostiles/anomalies/starbases.
  const homeSector = useMemo(() => options?.homeSector ?? randomHomeSector(options?.rng), [])
  const galaxy = useMemo(() => createGalaxy({ ...options, homeSector }), [])
  const home = sectorId(homeSector.region, homeSector.ring)
  const [, setVersion] = useState(0)
  const [state, setState] = useState<HuntState>({
    position: home,
    warpEngaged: false,
    stardate: STARTING_STARDATE,
    energy: { reserve: STARTING_ENERGY, shields: 0, phasers: 0 },
    subsystems: fullSubsystemHealth(),
    torpedoes: STARTING_TORPEDOES,
    hostilesDestroyed: 0,
    visited: new Set([home]),
    scanned: new Set(),
    scannedAnomalies: new Set(),
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

  const currentSector = galaxy.getNode(state.position)
  const neighbors = galaxy.neighbors(state.position)
  const known = knownSectors(state.visited, state.scanned)
  // Reaching an anomaly's own log/marker doesn't require paying for a scan -
  // stumbling into one (or being flung through it) reveals it just as well,
  // per state.visited below.
  const anomalyKnown = new Set([...state.scannedAnomalies, ...state.visited])
  const sensedDanger = sensedHostiles(galaxy, state.position)
  const alert = tacticalAlert(Boolean(currentSector?.hostile), sensedDanger.length)

  const timeQuotaStatus = missionStatus(state.hostilesDestroyed, state.stardate)
  // Shield/phaser energy is reclaimable back to reserve outside combat (see
  // subsystems.ts's allocate), so it's the combined total - not reserve
  // alone - that has to run dry to truly be unrecoverable. The cheapest
  // move is always a no-cost warp disengage followed by an impulse hop.
  const totalEnergy = state.energy.reserve + state.energy.shields + state.energy.phasers
  const cheapestMoveCost = MOVE_COST_NORMAL * degradedCostMultiplier(state.subsystems.impulseEngines)
  const stranded = isStranded(totalEnergy, cheapestMoveCost)
  const status = timeQuotaStatus !== 'active' ? timeQuotaStatus : stranded ? 'defeat' : 'active'
  const defeatReason: DefeatReason | null =
    status !== 'defeat' ? null : timeQuotaStatus === 'defeat' ? 'timeout' : 'stranded'

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

      setState((s) => ({
        ...s,
        position: landedAt,
        stardate: s.stardate + stardateCost(s.warpEngaged),
        energy: docked
          ? { reserve: STARTING_ENERGY, shields: 0, phasers: 0 }
          : { ...s.energy, reserve: s.energy.reserve - cost },
        subsystems: docked ? fullSubsystemHealth() : s.subsystems,
        torpedoes: docked ? STARTING_TORPEDOES : s.torpedoes,
        visited: new Set(s.visited).add(target).add(landedAt),
        warpEnteredBarrier: nextWarpEnteredBarrier,
      }))
      appendLog(message)
      if (docked) {
        appendLog(
          `Docked at ${landedSector!.name} starbase - shields, phasers, and reserves fully restored; all systems repaired; torpedo bay restocked.`,
        )
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
      home,
      appendLog,
    ],
  )

  const toggleWarp = useCallback(() => {
    if (state.warpEngaged) {
      disengageWarp(galaxy)
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
      engageWarp(galaxy)
      setState((s) => ({
        ...s,
        warpEngaged: true,
        energy: { ...s.energy, reserve: s.energy.reserve - cost },
      }))
      appendLog('Warp drive engaged.')
    }
    bump()
  }, [galaxy, state.warpEngaged, state.energy.reserve, state.subsystems.warpDrive, appendLog, bump])

  const allocateEnergy = useCallback(
    (subsystem: Subsystem, targetLevel: number) => {
      setState((s) => {
        const health = subsystem === 'shields' ? s.subsystems.shieldGenerator : s.subsystems.phaserArray
        const maxLevel = 100 * systemEfficiency(health)
        return { ...s, energy: allocate(s.energy, subsystem, targetLevel, maxLevel) }
      })
    },
    [],
  )

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
      }))

      const recovered = Math.round(Math.max(0, leftoverShieldEnergy + leftoverPhaserEnergy) * REFUND_EFFICIENCY)
      appendLog(
        recovered > 0
          ? `Shields and phasers stood down - ${recovered} energy recovered to the main reserve.`
          : 'Shields and phasers were fully depleted in the engagement.',
      )
      if (hostilesKilled > 0) {
        appendLog(
          `${hostilesKilled} hostile${hostilesKilled === 1 ? '' : 's'} destroyed - ${hostilesDestroyed}/${HOSTILE_QUOTA} toward mission quota.`,
        )
      }
      if (damagedSystem) {
        appendLog(
          `${SHIP_SYSTEM_LABEL[damagedSystem]} damaged in the engagement - down to ${Math.round(subsystems[damagedSystem])}%.`,
        )
      }
    },
    [appendLog],
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
    moveTo,
    toggleWarp,
    allocateEnergy,
    resolveEncounter,
    longRangeScan,
    subspaceScan,
  }
}
