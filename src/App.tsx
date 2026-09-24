import { useCallback, useState } from 'react'
import { GameShell } from './game/GameShell'
import './App.css'

function App() {
  // Bumping this remounts GameShell from scratch - a fresh galaxy and fresh
  // React state throughout, the simplest correct way to start a new
  // mission without hand-rolling a reset path through every piece of state.
  const [gameKey, setGameKey] = useState(0)
  const handleNewGame = useCallback(() => setGameKey((key) => key + 1), [])

  return (
    <div id="app">
      <GameShell key={gameKey} onNewGame={handleNewGame} />
    </div>
  )
}

export default App
