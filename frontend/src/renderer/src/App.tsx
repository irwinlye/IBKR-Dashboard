import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Portfolio from './components/Portfolio/Portfolio'
import History from './components/History/History'
import Insights from './components/Insights/Insights'
import Diary from './components/Diary/Diary'

export type Tab = 'portfolio' | 'history' | 'insights' | 'diary'

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')
  const [searchQuery, setSearchQuery] = useState('')
  const [censored, setCensored] = useState(false)
  const [appName, setAppName] = useState<string>(
    () => localStorage.getItem('appName') ?? 'TradeDesk'
  )

  const handleSetAppName = (name: string) => {
    const trimmed = name.trim() || 'TradeDesk'
    setAppName(trimmed)
    localStorage.setItem('appName', trimmed)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0b1120', overflow: 'hidden' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        censored={censored}
        setCensored={setCensored}
        appName={appName}
        setAppName={handleSetAppName}
      />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {activeTab === 'portfolio' && <Portfolio censored={censored} />}
        {activeTab === 'history' && <History censored={censored} />}
        {activeTab === 'insights' && <Insights searchQuery={searchQuery} />}
        {activeTab === 'diary' && <Diary />}
      </main>
    </div>
  )
}

export default App
