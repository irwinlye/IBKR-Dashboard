import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Save,
  CheckCircle, AlertCircle, BookOpen, TrendingUp, TrendingDown, Download,
  Sparkles, X, Loader
} from 'lucide-react'
import { getDiaryEntry, saveDiaryEntry, getDiaryDates, fetchTrades, streamAICoachFeedback, TradeForCoach } from '../../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoodTrade {
  id: string
  symbol: string
  entry_price: string
  exit_price: string
  pnl: string
  what_went_well: string
  why_it_worked: string
}

interface BadTrade {
  id: string
  symbol: string
  entry_price: string
  exit_price: string
  pnl: string
  what_went_wrong: string
  lesson_learned: string
}

interface DiaryEntry {
  good_trades: GoodTrade[]
  bad_trades: BadTrade[]
  overall_notes: string
}

interface HistoryTrade {
  symbol: string
  trade_type: 'BUY' | 'SELL'
  quantity: number
  price: number
  total: number
  filled_at: string
}

type SaveStatus = 'saved' | 'saving' | 'error' | 'idle'

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function emptyGood(): GoodTrade {
  return { id: uid(), symbol: '', entry_price: '', exit_price: '', pnl: '', what_went_well: '', why_it_worked: '' }
}

function emptyBad(): BadTrade {
  return { id: uid(), symbol: '', entry_price: '', exit_price: '', pnl: '', what_went_wrong: '', lesson_learned: '' }
}

function emptyEntry(): DiaryEntry {
  return { good_trades: [emptyGood()], bad_trades: [emptyBad()], overall_notes: '' }
}

// Strip client-side 'id' before sending to API
function stripIds(entry: DiaryEntry) {
  return {
    good_trades: entry.good_trades.map(({ id: _id, ...rest }) => ({
      ...rest,
      entry_price: rest.entry_price ? parseFloat(rest.entry_price) : null,
      exit_price: rest.exit_price ? parseFloat(rest.exit_price) : null,
      pnl: rest.pnl ? parseFloat(rest.pnl) : null,
    })),
    bad_trades: entry.bad_trades.map(({ id: _id, ...rest }) => ({
      ...rest,
      entry_price: rest.entry_price ? parseFloat(rest.entry_price) : null,
      exit_price: rest.exit_price ? parseFloat(rest.exit_price) : null,
      pnl: rest.pnl ? parseFloat(rest.pnl) : null,
    })),
    overall_notes: entry.overall_notes,
  }
}

// Add client-side ids to API response
function hydrateIds(raw: DiaryEntry): DiaryEntry {
  return {
    good_trades: (raw.good_trades || []).map(t => ({ ...t, id: uid(), entry_price: String(t.entry_price ?? ''), exit_price: String(t.exit_price ?? ''), pnl: String(t.pnl ?? '') })),
    bad_trades: (raw.bad_trades || []).map(t => ({ ...t, id: uid(), entry_price: String(t.entry_price ?? ''), exit_price: String(t.exit_price ?? ''), pnl: String(t.pnl ?? '') })),
    overall_notes: raw.overall_notes || '',
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0d1525',
  border: '1px solid #1e2d45',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#f1f5f9',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: '80px',
  fontFamily: 'inherit',
  lineHeight: '1.5',
}

// ── Reusable field components (module-level — never re-created on re-render) ──

function FieldInput({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = '#7c3aed')}
        onBlur={e => (e.target.style.borderColor = '#1e2d45')}
      />
    </div>
  )
}

function FieldTextarea({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={textareaStyle}
        onFocus={e => (e.target.style.borderColor = '#7c3aed')}
        onBlur={e => (e.target.style.borderColor = '#1e2d45')}
      />
    </div>
  )
}

// ── AI Coach Modal ────────────────────────────────────────────────────────────

function CoachModal({ content, loading, onClose }: {
  content: string
  loading: boolean
  onClose: () => void
}) {
  // Render markdown-lite: bold (**text**), headings (### text), inline
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      // ### Heading
      if (line.startsWith('### ')) {
        return (
          <p key={i} style={{ fontWeight: '700', color: '#a78bfa', fontSize: '13px', marginTop: i === 0 ? 0 : '16px', marginBottom: '4px', letterSpacing: '0.2px' }}>
            {line.replace('### ', '')}
          </p>
        )
      }
      // Blank line
      if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />
      // Bold (**word**)
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <p key={i} style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.65', margin: '2px 0' }}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} style={{ color: '#f1f5f9', fontWeight: '600' }}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      )
    })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(4, 8, 18, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0f1729',
          border: '1px solid #2d1b69',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(124, 58, 237, 0.15)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid #1e2d45',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#a78bfa" />
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#f1f5f9' }}>AI Trade Coach</span>
            {loading && (
              <span style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Analysing...
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: '4px', borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading && content === '' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '13px', padding: '20px 0' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              Sending trade to AI coach...
            </div>
          ) : (
            <div>
              {renderMarkdown(content)}
              {loading && (
                <span style={{
                  display: 'inline-block', width: '2px', height: '14px',
                  backgroundColor: '#a78bfa', marginLeft: '2px', verticalAlign: 'middle',
                  animation: 'fadeIn 0.5s ease infinite alternate',
                }} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && content && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #1e2d45',
            display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px', backgroundColor: '#7c3aed', border: 'none',
                borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Trade card props types ─────────────────────────────────────────────────────

interface GoodTradeCardProps {
  trade: GoodTrade
  onUpdate: (id: string, field: keyof GoodTrade, value: string) => void
  onRemove: (id: string) => void
  onCoach: (trade: GoodTrade) => void
}

interface BadTradeCardProps {
  trade: BadTrade
  onUpdate: (id: string, field: keyof BadTrade, value: string) => void
  onRemove: (id: string) => void
  onCoach: (trade: BadTrade) => void
}

// ── Shared AI Coach button ────────────────────────────────────────────────────

function CoachButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '4px 10px', borderRadius: '6px', border: '1px solid #2d1b69',
        backgroundColor: '#1a0f3a', color: '#a78bfa',
        fontSize: '11px', fontWeight: '600', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2d1b69'; e.currentTarget.style.borderColor = '#7c3aed' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1a0f3a'; e.currentTarget.style.borderColor = '#2d1b69' }}
      title="Get AI coaching feedback on this trade"
    >
      <Sparkles size={11} />
      AI Feedback
    </button>
  )
}

// ── GoodTradeCard (module-level — stable component identity across re-renders) ─

function GoodTradeCard({ trade, onUpdate, onRemove, onCoach }: GoodTradeCardProps) {
  return (
    <div style={{ backgroundColor: '#0d1525', border: '1px solid #1a2e20', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CoachButton onClick={() => onCoach(trade)} />
        <button onClick={() => onRemove(trade.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: '2px', borderRadius: '4px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', paddingRight: '120px' }}>
        <FieldInput label="Symbol" value={trade.symbol} onChange={v => onUpdate(trade.id, 'symbol', v.toUpperCase())} placeholder="AAPL" />
        <FieldInput label="Entry Price" value={trade.entry_price} onChange={v => onUpdate(trade.id, 'entry_price', v)} type="number" placeholder="0.00" />
        <FieldInput label="Exit Price" value={trade.exit_price} onChange={v => onUpdate(trade.id, 'exit_price', v)} type="number" placeholder="0.00" />
        <FieldInput label="P&L ($)" value={trade.pnl} onChange={v => onUpdate(trade.id, 'pnl', v)} type="number" placeholder="+0.00" />
      </div>
      <FieldTextarea label="What went well" value={trade.what_went_well} onChange={v => onUpdate(trade.id, 'what_went_well', v)} placeholder="Describe what worked in this trade..." />
      <FieldTextarea label="Why it worked" value={trade.why_it_worked} onChange={v => onUpdate(trade.id, 'why_it_worked', v)} placeholder="The reason this trade was successful..." />
    </div>
  )
}

// ── BadTradeCard (module-level — stable component identity across re-renders) ──

function BadTradeCard({ trade, onUpdate, onRemove, onCoach }: BadTradeCardProps) {
  return (
    <div style={{ backgroundColor: '#0d1525', border: '1px solid #2e1a1a', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CoachButton onClick={() => onCoach(trade)} />
        <button onClick={() => onRemove(trade.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: '2px', borderRadius: '4px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', paddingRight: '120px' }}>
        <FieldInput label="Symbol" value={trade.symbol} onChange={v => onUpdate(trade.id, 'symbol', v.toUpperCase())} placeholder="AAPL" />
        <FieldInput label="Entry Price" value={trade.entry_price} onChange={v => onUpdate(trade.id, 'entry_price', v)} type="number" placeholder="0.00" />
        <FieldInput label="Exit Price" value={trade.exit_price} onChange={v => onUpdate(trade.id, 'exit_price', v)} type="number" placeholder="0.00" />
        <FieldInput label="P&L ($)" value={trade.pnl} onChange={v => onUpdate(trade.id, 'pnl', v)} type="number" placeholder="-0.00" />
      </div>
      <FieldTextarea label="What went wrong" value={trade.what_went_wrong} onChange={v => onUpdate(trade.id, 'what_went_wrong', v)} placeholder="Describe what went wrong..." />
      <FieldTextarea label="Lesson learned" value={trade.lesson_learned} onChange={v => onUpdate(trade.id, 'lesson_learned', v)} placeholder="What will you do differently next time?" />
    </div>
  )
}

// ── Calendar Dropdown ─────────────────────────────────────────────────────────

function CalendarDropdown({ selected, onSelect, datesWithEntries }: {
  selected: string
  onSelect: (d: string) => void
  datesWithEntries: Set<string>
}) {
  const [view, setView] = useState(() => {
    const d = new Date(selected + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const firstDay = new Date(view.year, view.month, 1).getDay()
  const monthLabel = new Date(view.year, view.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  const nextMonth = () => {
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
      backgroundColor: '#0f1729', border: '1px solid #1e2d45', borderRadius: '12px',
      padding: '16px', width: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px', borderRadius: '4px' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a2640')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px', borderRadius: '4px' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a2640')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
          <ChevronRight size={16} />
        </button>
      </div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#475569', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dateStr = `${view.year}-${String(view.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSelected = dateStr === selected
          const hasEntry = datesWithEntries.has(dateStr)
          const isToday = dateStr === today()
          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              style={{
                padding: '6px 2px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                backgroundColor: isSelected ? '#7c3aed' : 'transparent',
                color: isSelected ? '#fff' : isToday ? '#a78bfa' : '#f1f5f9',
                fontSize: '12px', fontWeight: isSelected || isToday ? '700' : '400',
                position: 'relative', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#1a2640' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {day}
              {hasEntry && !isSelected && (
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#a78bfa', margin: '1px auto 0' }} />
              )}
              {hasEntry && isSelected && (
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', margin: '1px auto 0' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Diary() {
  const [selectedDate, setSelectedDate] = useState<string>(today())
  const [entry, setEntry] = useState<DiaryEntry>(emptyEntry())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [showCalendar, setShowCalendar] = useState(false)
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachContent, setCoachContent] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Close calendar on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load dates with entries
  const refreshDates = useCallback(async () => {
    const dates = await getDiaryDates()
    if (dates) setDatesWithEntries(new Set(dates))
  }, [])

  useEffect(() => { refreshDates() }, [refreshDates])

  // Load entry when date changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSaveStatus('idle')
    getDiaryEntry(selectedDate).then(data => {
      if (cancelled) return
      setEntry(data ? hydrateIds(data as DiaryEntry) : emptyEntry())
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedDate])

  // Manual save only
  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      await saveDiaryEntry(selectedDate, stripIds(entry))
      setSaveStatus('saved')
      refreshDates()
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }, [selectedDate, entry, refreshDates])

  // Import from History: fetch all trades, filter by selected date, pre-fill cards
  const importFromHistory = useCallback(async () => {
    setImporting(true)
    try {
      const trades = await fetchTrades<HistoryTrade>()
      if (!trades || trades.length === 0) {
        setImporting(false)
        return
      }

      // Filter trades for the selected date
      const dayTrades = trades.filter(t => {
        if (!t.filled_at) return false
        return t.filled_at.split('T')[0] === selectedDate
      })

      if (dayTrades.length === 0) {
        setImporting(false)
        return
      }

      // Group by symbol: match BUY entries with SELL exits
      const bySymbol: Record<string, { buys: HistoryTrade[]; sells: HistoryTrade[] }> = {}
      for (const t of dayTrades) {
        if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { buys: [], sells: [] }
        if (t.trade_type === 'BUY') bySymbol[t.symbol].buys.push(t)
        else bySymbol[t.symbol].sells.push(t)
      }

      // Build pre-filled good trade cards for each symbol that has a SELL (completed trade)
      const newGoodCards: GoodTrade[] = []
      for (const [symbol, { buys, sells }] of Object.entries(bySymbol)) {
        if (sells.length === 0) continue
        const avgBuy = buys.length > 0
          ? buys.reduce((sum, t) => sum + t.price, 0) / buys.length
          : 0
        const avgSell = sells.reduce((sum, t) => sum + t.price, 0) / sells.length
        const totalPnl = sells.reduce((sum, t) => sum + t.total, 0) -
          buys.reduce((sum, t) => sum + t.total, 0)

        newGoodCards.push({
          id: uid(),
          symbol,
          entry_price: avgBuy > 0 ? avgBuy.toFixed(2) : '',
          exit_price: avgSell.toFixed(2),
          pnl: totalPnl.toFixed(2),
          what_went_well: '',
          why_it_worked: '',
        })
      }

      if (newGoodCards.length > 0) {
        setEntry(e => {
          // Remove empty placeholder cards if still blank, then append imported ones
          const existingGood = e.good_trades.filter(t =>
            t.symbol || t.entry_price || t.exit_price || t.pnl || t.what_went_well || t.why_it_worked
          )
          return { ...e, good_trades: [...existingGood, ...newGoodCards] }
        })
      }
    } catch {
      // silently fail
    }
    setImporting(false)
  }, [selectedDate])

  // Entry mutators (stable — defined once, passed as props to module-level card components)
  const updateGood = useCallback((id: string, field: keyof GoodTrade, value: string) => {
    setEntry(e => ({ ...e, good_trades: e.good_trades.map(t => t.id === id ? { ...t, [field]: value } : t) }))
  }, [])

  const updateBad = useCallback((id: string, field: keyof BadTrade, value: string) => {
    setEntry(e => ({ ...e, bad_trades: e.bad_trades.map(t => t.id === id ? { ...t, [field]: value } : t) }))
  }, [])

  const addGood = useCallback(() => setEntry(e => ({ ...e, good_trades: [...e.good_trades, emptyGood()] })), [])
  const addBad  = useCallback(() => setEntry(e => ({ ...e, bad_trades: [...e.bad_trades, emptyBad()] })), [])

  const removeGood = useCallback((id: string) => {
    setEntry(e => ({ ...e, good_trades: e.good_trades.filter(t => t.id !== id) }))
  }, [])

  const removeBad = useCallback((id: string) => {
    setEntry(e => ({ ...e, bad_trades: e.bad_trades.filter(t => t.id !== id) }))
  }, [])

  const openCoach = useCallback(async (trade: GoodTrade | BadTrade, type: 'good' | 'bad') => {
    setCoachContent('')
    setCoachLoading(true)
    setCoachOpen(true)

    const payload: TradeForCoach = {
      trade_type: type,
      symbol: trade.symbol || undefined,
      entry_price: trade.entry_price ? parseFloat(trade.entry_price) : null,
      exit_price: trade.exit_price ? parseFloat(trade.exit_price) : null,
      pnl: trade.pnl ? parseFloat(trade.pnl) : null,
      overall_notes: entry.overall_notes || undefined,
      trade_date: selectedDate,
      ...(type === 'good'
        ? { what_went_well: (trade as GoodTrade).what_went_well, why_it_worked: (trade as GoodTrade).why_it_worked }
        : { what_went_wrong: (trade as BadTrade).what_went_wrong, lesson_learned: (trade as BadTrade).lesson_learned }
      ),
    }

    const stream = await streamAICoachFeedback(payload)
    if (!stream) {
      setCoachContent('Could not connect to AI Coach. Make sure OPENAI_API_KEY is set in your .env file and the backend is running.')
      setCoachLoading(false)
      return
    }

    const reader = stream.getReader()
    let accumulated = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += value
        setCoachContent(accumulated)
      }
    } finally {
      setCoachLoading(false)
    }
  }, [entry.overall_notes, selectedDate])

  const handleDateSelect = (d: string) => {
    setSelectedDate(d)
    setShowCalendar(false)
  }

  const statusEl = () => {
    if (saveStatus === 'saving') return <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>Saving...</span>
    if (saveStatus === 'saved')  return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}><CheckCircle size={13} /> Saved</span>
    if (saveStatus === 'error')  return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}><AlertCircle size={13} /> Save failed</span>
    return null
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f1f5f9', height: '100%' }}>
      {coachOpen && (
        <CoachModal
          content={coachContent}
          loading={coachLoading}
          onClose={() => { setCoachOpen(false); setCoachContent(''); setCoachLoading(false) }}
        />
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} color="#a78bfa" />
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', lineHeight: '1' }}>Trade Journal</h1>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>Document your trades and build better habits</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {statusEl()}
          <button
            onClick={importFromHistory}
            disabled={importing}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              backgroundColor: 'transparent', border: '1px solid #1e2d45', borderRadius: '8px',
              color: '#94a3b8', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              opacity: importing ? 0.5 : 1, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#a78bfa' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d45'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <Download size={14} />
            {importing ? 'Importing...' : 'Import from History'}
          </button>
          <button
            onClick={doSave}
            disabled={saveStatus === 'saving'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              backgroundColor: '#7c3aed', border: 'none', borderRadius: '8px',
              color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              opacity: saveStatus === 'saving' ? 0.6 : 1, transition: 'opacity 0.15s',
            }}
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      {/* Date Picker */}
      <div ref={calendarRef} style={{ position: 'relative', width: 'fit-content' }}>
        <button
          onClick={() => setShowCalendar(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
            backgroundColor: '#131e30', border: `1px solid ${showCalendar ? '#7c3aed' : '#1e2d45'}`,
            borderRadius: '10px', color: '#f1f5f9', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            transition: 'border-color 0.15s',
          }}
        >
          <span style={{ color: '#a78bfa' }}>📅</span>
          {formatDisplay(selectedDate)}
          <ChevronRight size={14} color="#475569" style={{ transform: showCalendar ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showCalendar && (
          <CalendarDropdown selected={selectedDate} onSelect={handleDateSelect} datesWithEntries={datesWithEntries} />
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>Loading entry...</div>
      ) : (
        <>
          {/* Good + Bad columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
            {/* Good Trades */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>Good Trades</span>
                  <span style={{ fontSize: '12px', color: '#475569', backgroundColor: '#0d2918', border: '1px solid #10b981', borderRadius: '10px', padding: '1px 8px' }}>
                    {entry.good_trades.length}
                  </span>
                </div>
                <button
                  onClick={addGood}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', backgroundColor: '#0d2918', border: '1px solid #10b981', borderRadius: '6px', color: '#10b981', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  <Plus size={13} /> Add Trade
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {entry.good_trades.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569', backgroundColor: '#0d1525', borderRadius: '10px', border: '1px dashed #1e2d45', fontSize: '13px' }}>
                    <TrendingUp size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                    No good trades logged yet
                  </div>
                ) : (
                  entry.good_trades.map(t => (
                    <GoodTradeCard key={t.id} trade={t} onUpdate={updateGood} onRemove={removeGood} onCoach={t => openCoach(t, 'good')} />
                  ))
                )}
              </div>
            </div>

            {/* Bad Trades */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444' }}>Bad Trades</span>
                  <span style={{ fontSize: '12px', color: '#475569', backgroundColor: '#2d1010', border: '1px solid #ef4444', borderRadius: '10px', padding: '1px 8px' }}>
                    {entry.bad_trades.length}
                  </span>
                </div>
                <button
                  onClick={addBad}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', backgroundColor: '#2d1010', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  <Plus size={13} /> Add Trade
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {entry.bad_trades.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569', backgroundColor: '#0d1525', borderRadius: '10px', border: '1px dashed #1e2d45', fontSize: '13px' }}>
                    <TrendingDown size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                    No bad trades logged yet
                  </div>
                ) : (
                  entry.bad_trades.map(t => (
                    <BadTradeCard key={t.id} trade={t} onUpdate={updateBad} onRemove={removeBad} onCoach={t => openCoach(t, 'bad')} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Overall Notes */}
          <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', padding: '18px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
              Overall Notes for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </label>
            <textarea
              value={entry.overall_notes}
              onChange={e => setEntry(en => ({ ...en, overall_notes: e.target.value }))}
              placeholder="General thoughts on today's trading session — market conditions, mindset, areas to improve..."
              style={{ ...textareaStyle, minHeight: '100px' }}
              onFocus={e => (e.target.style.borderColor = '#7c3aed')}
              onBlur={e => (e.target.style.borderColor = '#1e2d45')}
            />
          </div>
        </>
      )}
    </div>
  )
}
