import { useState, useRef } from 'react'
import { Search, PieChart, History, TrendingUp, Eye, EyeOff, LogOut, Pencil, Check, BookOpen } from 'lucide-react'
import type { Tab } from '../App'

interface SidebarProps {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  censored: boolean
  setCensored: (v: boolean) => void
  appName: string
  setAppName: (name: string) => void
}

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: <PieChart size={18} /> },
  { id: 'history', label: 'History', icon: <History size={18} /> },
  { id: 'insights', label: 'Insights', icon: <TrendingUp size={18} /> },
  { id: 'diary', label: 'Journal', icon: <BookOpen size={18} /> },
]

export default function Sidebar({
  activeTab, setActiveTab,
  searchQuery, setSearchQuery,
  censored, setCensored,
  appName, setAppName,
}: SidebarProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(appName)
  const [loggingOut, setLoggingOut] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const commitName = () => {
    setAppName(nameInput)
    setEditingName(false)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('http://localhost:8000/api/ibkr/logout', { method: 'POST' })
    } catch {
      // gateway may not be running, ignore
    } finally {
      setLoggingOut(false)
    }
  }

  const firstLetter = appName.charAt(0).toUpperCase()

  return (
    <aside
      style={{
        width: '220px',
        minWidth: '220px',
        height: '100vh',
        backgroundColor: '#0f1729',
        borderRight: '1px solid #1e2d45',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
        gap: '8px',
      }}
    >
      {/* Logo / App Title */}
      <div style={{ marginBottom: '20px', paddingLeft: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              minWidth: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '700',
              color: 'white',
            }}
          >
            {firstLetter}
          </div>

          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName()
                  if (e.key === 'Escape') { setEditingName(false); setNameInput(appName) }
                }}
                onBlur={commitName}
                autoFocus
                maxLength={20}
                style={{
                  background: '#131e30',
                  border: '1px solid #7c3aed',
                  borderRadius: '4px',
                  outline: 'none',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  width: '100%',
                }}
              />
              <button
                onClick={commitName}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '2px', display: 'flex' }}
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {appName}
              </span>
              <button
                onClick={() => { setNameInput(appName); setEditingName(true) }}
                title="Rename app"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px', display: 'flex', flexShrink: 0, opacity: 0.6 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#131e30',
          border: '1px solid #1e2d45',
          borderRadius: '8px',
          padding: '8px 10px',
          marginBottom: '12px',
        }}
      >
        <Search size={14} color="#475569" />
        <input
          type="text"
          placeholder="Search symbol..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            if (e.target.value.trim()) setActiveTab('insights')
          }}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#f1f5f9',
            fontSize: '13px',
            width: '100%',
          }}
        />
      </div>

      {/* Nav Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? '#3b1f6e' : 'transparent',
                color: isActive ? '#a78bfa' : '#94a3b8',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a2640'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              }}
            >
              {item.icon}
              {item.label}
              {isActive && (
                <div style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#7c3aed' }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Censor Toggle */}
        <button
          onClick={() => setCensored(!censored)}
          title={censored ? 'Show values' : 'Hide values'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: `1px solid ${censored ? '#7c3aed' : '#1e2d45'}`,
            cursor: 'pointer',
            backgroundColor: censored ? '#3b1f6e' : '#131e30',
            color: censored ? '#a78bfa' : '#94a3b8',
            fontSize: '13px',
            fontWeight: '500',
            width: '100%',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!censored) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a2640'
          }}
          onMouseLeave={(e) => {
            if (!censored) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#131e30'
          }}
        >
          {censored ? <EyeOff size={15} /> : <Eye size={15} />}
          {censored ? 'Values hidden' : 'Hide values'}
        </button>

        {/* IBKR Status */}
        <div
          style={{
            backgroundColor: '#131e30',
            border: '1px solid #1e2d45',
            borderRadius: '8px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            IBKR Gateway
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Not connected</span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #1e2d45',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: '500',
            width: '100%',
            transition: 'all 0.15s',
            opacity: loggingOut ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loggingOut) {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2d1515'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#ef4444'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'
            }
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2d45'
          }}
        >
          <LogOut size={15} />
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </aside>
  )
}
