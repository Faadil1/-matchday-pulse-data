import { useState, useCallback } from 'react'
import Header from './components/Header'
import AgentConsole from './components/AgentConsole'
import TransactionDashboard from './components/TransactionDashboard'
import ActionLog from './components/ActionLog'

export default function App() {
  const [phase,   setPhase  ] = useState('idle')
  const [toolLog, setToolLog] = useState([])

  const handlePhaseChange = useCallback((p) => {
    if (p === 'streaming') setToolLog([])
    setPhase(p)
  }, [])

  const addToLog = useCallback(({ name, args }) => {
    setToolLog(prev => [...prev, {
      id:        Date.now() + Math.random(),
      name,
      args,
      timestamp: new Date(),
    }])
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <TransactionDashboard phase={phase} />
        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minWidth: 0 }}>
            <AgentConsole onPhaseChange={handlePhaseChange} onToolCall={addToLog} />
          </div>
          {phase !== 'idle' && <ActionLog entries={toolLog} phase={phase} />}
        </main>
      </div>
    </div>
  )
}
