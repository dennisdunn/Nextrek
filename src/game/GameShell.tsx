import { useCallback, useRef, useState } from 'react'
import type { NodeId } from '../graph/UndoGraph'
import { applyCombatResult } from '../hunt/galaxy'
import { HuntPhase, type BridgeTab, type Encounter } from '../hunt/HuntPhase'
import { useGalaxy } from '../hunt/useGalaxy'
import type { CombatResult, LiveCombatState } from '../kill/KillPhase'
import { HOSTILE_HULL_HEALTH } from '../kill/loadout'
import { EndScreen } from './EndScreen'

export interface GameShellProps {
  /** Starts a fresh mission - the parent remounts this component (a new galaxy, all state reset) in response. */
  onNewGame: () => void
}

/**
 * Phase-transition layer. Owns the galaxy (React/UndoGraph, strategic) and
 * the current encounter, if any, and decides when a hunt-phase move starts
 * or ends one, folding the outcome back into the galaxy either way.
 *
 * Unlike the old full-screen takeover, the hunt phase itself never
 * unmounts - Tactical is an embedded, toggle-able station inside it (see
 * HuntPhase.tsx) so Status/Engineering/Comms stay live and usable through
 * a fight. Once the mission is decided (see hunt/mission.ts), EndScreen
 * replaces it outright - there's nothing left to click through to.
 */
export function GameShell({ onNewGame }: GameShellProps) {
  const controller = useGalaxy()
  const { galaxy, state, status, moveTo, resolveEncounter } = controller
  const [encounter, setEncounter] = useState<Encounter | null>(null)
  const [activeTab, setActiveTab] = useState<BridgeTab>('sciences')
  // Updated every tick by KillPhase, out-of-band from React state - a fight
  // resolves 60 times a second and none of that needs to trigger a
  // re-render; it only has to be readable at the moment an encounter ends.
  const liveCombatRef = useRef<LiveCombatState | null>(null)

  const disengage = useCallback(
    (
      sectorId: NodeId,
      hostileHealthsAtStart: number[],
      hostileHealthsRemaining: number[],
      leftoverShieldEnergy: number,
      leftoverPhaserEnergy: number,
      hullDamageTaken: number,
      torpedoesRemaining: number,
    ) => {
      const sector = galaxy.getNode(sectorId)
      if (sector) galaxy.setNode(sectorId, applyCombatResult(sector, hostileHealthsRemaining))
      // Only hostiles that were alive at the start of THIS encounter and are
      // down now count - a pack resumed mid-fight (fled or lost earlier)
      // never double-counts one it had already downed before.
      const hostilesKilled = hostileHealthsAtStart.filter(
        (health, i) => health > 0 && hostileHealthsRemaining[i] <= 0,
      ).length
      resolveEncounter(hullDamageTaken, leftoverShieldEnergy, leftoverPhaserEnergy, torpedoesRemaining, hostilesKilled)
      liveCombatRef.current = null
      setEncounter(null)
      setActiveTab('sciences')
    },
    [galaxy, resolveEncounter],
  )

  const handleMove = useCallback(
    (target: NodeId) => {
      // moveTo returns where the ship actually ended up, which can differ
      // from `target` after a gate or conduit redirect - the hostile check
      // has to run on that real landing sector, not the one originally
      // clicked (a gate/conduit sector is itself always hostile-free).
      const landedAt = moveTo(target)
      if (!landedAt) return

      // Moving at all while an encounter is active *is* fleeing it - there's
      // no separate flee button. Whatever the fight's current state is
      // (read from the last tick KillPhase reported) is what persists.
      if (encounter) {
        const live = liveCombatRef.current
        disengage(
          encounter.sectorId,
          encounter.hostileHealths,
          live?.hostileHealthsRemaining ?? encounter.hostileHealths,
          live?.shieldEnergy ?? 0,
          live?.phaserEnergy ?? 0,
          live?.hullDamageTaken ?? 0,
          live?.torpedoesRemaining ?? state.torpedoes,
        )
      }

      const sector = galaxy.getNode(landedAt)
      if (sector?.hostile) {
        liveCombatRef.current = null
        setEncounter({
          sectorId: landedAt,
          hostileHealths: sector.hostileHealths ?? Array(sector.hostileCount).fill(HOSTILE_HULL_HEALTH),
          hasStarHazard: sector.hasStarHazard,
        })
        setActiveTab('tactical')
      }
    },
    [moveTo, galaxy, encounter, disengage, state.torpedoes],
  )

  const handleResolved = useCallback(
    (result: CombatResult) => {
      if (!encounter) return
      disengage(
        encounter.sectorId,
        encounter.hostileHealths,
        result.hostileHealthsRemaining,
        result.leftoverShieldEnergy,
        result.leftoverPhaserEnergy,
        result.hullDamageTaken,
        result.torpedoesRemaining,
      )
    },
    [encounter, disengage],
  )

  const handleLiveCombatUpdate = useCallback((state: LiveCombatState) => {
    liveCombatRef.current = state
  }, [])

  if (status !== 'active') {
    return (
      <EndScreen
        status={status}
        hostilesDestroyed={state.hostilesDestroyed}
        stardate={state.stardate}
        onNewGame={onNewGame}
      />
    )
  }

  return (
    <HuntPhase
      controller={controller}
      onMove={handleMove}
      encounter={encounter}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onCombatResolved={handleResolved}
      onLiveCombatUpdate={handleLiveCombatUpdate}
    />
  )
}
