import { useCallback, useState } from 'react'
import type { Difficulty } from './balance'
import { GameShell } from './game/GameShell'
import { StartScreen } from './game/StartScreen'
import './App.css'

function App() {
  // Bumping this remounts GameShell from scratch - a fresh galaxy and fresh
  // React state throughout, the simplest correct way to start a new
  // mission without hand-rolling a reset path through every piece of state.
  const [gameKey, setGameKey] = useState(0)
  // null until chosen on the StartScreen - "New game" clears it back to null
  // too, so restarting always asks again rather than silently repeating
  // whatever was picked last time.
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const handleNewGame = useCallback(() => {
    setGameKey((key) => key + 1)
    setDifficulty(null)
  }, [])

  return (
    <div id="app">
      {difficulty ? (
        <GameShell key={gameKey} difficulty={difficulty} onNewGame={handleNewGame} />
      ) : (
        <StartScreen onSelect={setDifficulty} />
      )}
    </div>
  )
}

export default App
