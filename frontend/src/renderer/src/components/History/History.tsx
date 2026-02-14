import { useState, useEffect } from 'react'
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react'
import { fetchTrades } from '../../api/client'

type TradeType = 'BUY' | 'SELL'

interface Trade {
  id: number
  symbol: string
  name: string
  type: TradeType
  quantity: number
  price: number
  total: number
  filled_at: string
  status: 'FILLED'
  exchange: string
  currency: string
}

const MOCK_TRADES: Trade[] = [
  { id: 1, symbol: 'AAPL', name: 'Apple Inc.', type: 'BUY', quantity: 10, price: 178.20, total: 1782.00, filled_at: '2024-12-15T09:32:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 2, symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'BUY', quantity: 5, price: 485.60, total: 2428.00, filled_at: '2024-12-18T10:15:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 3, symbol: 'MSFT', name: 'Microsoft Corp.', type: 'BUY', quantity: 8, price: 362.40, total: 2899.20, filled_at: '2024-12-20T14:02:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 4, symbol: 'BTC', name: 'Bitcoin', type: 'BUY', quantity: 0.05, price: 43200.00, total: 2160.00, filled_at: '2025-01-03T11:45:00Z', status: 'FILLED', exchange: 'PAXOS', currency: 'USD' },
  { id: 5, symbol: 'TSM', name: 'Taiwan Semiconductor', type: 'BUY', quantity: 30, price: 115.00, total: 3450.00, filled_at: '2025-01-10T09:58:00Z', status: 'FILLED', exchange: 'NYSE', currency: 'USD' },
  { id: 6, symbol: 'AAPL', name: 'Apple Inc.', type: 'BUY', quantity: 40, price: 165.50, total: 6620.00, filled_at: '2025-01-22T13:30:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 7, symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'BUY', quantity: 15, price: 410.00, total: 6150.00, filled_at: '2025-01-28T10:05:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 8, symbol: 'BTC', name: 'Bitcoin', type: 'BUY', quantity: 0.10, price: 40500.00, total: 4050.00, filled_at: '2025-02-01T08:22:00Z', status: 'FILLED', exchange: 'PAXOS', currency: 'USD' },
  { id: 9, symbol: 'MSFT', name: 'Microsoft Corp.', type: 'SELL', quantity: 3, price: 385.20, total: 1155.60, filled_at: '2025-01-15T15:48:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'SELL', quantity: 5, price: 188.40, total: 942.00, filled_at: '2025-02-05T09:20:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
  { id: 11, symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'SELL', quantity: 2, price: 510.00, total: 1020.00, filled_at: '2025-02-10T11:33:00Z', status: 'FILLED', exchange: 'NASDAQ', currency: 'USD' },
]

function formatCurrency(val: number, currency = 'USD') {
  return val.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const MASK = '••••••'

interface TradeTableProps {
  trades: Trade[]
  type: TradeType
  censored: boolean
}

function TradeTable({ trades, type, censored }: TradeTableProps) {
  const mask = (val: string) => censored ? MASK : val
  const filtered = trades.filter((t) => t.type === type)
  const total = filtered.reduce((s, t) => s + t.total, 0)

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
        No {type.toLowerCase()} orders found.
      </div>
    )
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Orders</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginTop: '2px' }}>{filtered.length}</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#1e2d45' }} />
          <div>
            <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total {type === 'BUY' ? 'Invested' : 'Proceeds'}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: type === 'BUY' ? '#a78bfa' : '#10b981', marginTop: '2px' }}>{mask(formatCurrency(total))}</div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e2d45', backgroundColor: '#0f1729' }}>
              {['Symbol', 'Qty', 'Price', 'Total', 'Exchange', 'Date & Time', 'Status'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((trade) => (
              <tr
                key={trade.id}
                style={{ borderBottom: '1px solid #1a2640', transition: 'background 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a2640')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '12px 14px' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#f1f5f9' }}>{trade.symbol}</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>{trade.name}</div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{trade.quantity}</td>
                <td style={{ padding: '12px 14px', color: '#f1f5f9', fontWeight: '600' }}>{mask(formatCurrency(trade.price, trade.currency))}</td>
                <td style={{ padding: '12px 14px', color: type === 'BUY' ? '#a78bfa' : '#10b981', fontWeight: '600' }}>
                  {mask(formatCurrency(trade.total, trade.currency))}
                </td>
                <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '12px' }}>{trade.exchange}</td>
                <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '12px' }}>{formatDate(trade.filled_at)}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ backgroundColor: '#0d2918', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>
                    FILLED
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function History({ censored = false }: { censored?: boolean }) {
  const [activeTab, setActiveTab] = useState<TradeType>('BUY')
  const [trades, setTrades] = useState<Trade[]>(MOCK_TRADES)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await fetchTrades<Trade>()
      if (data && data.length > 0) setTrades(data)
    } catch {
      // keep mock data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>Trade History</h1>
        <button
          onClick={refresh}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0f1729', border: '1px solid #1e2d45', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {(['BUY', 'SELL'] as TradeType[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === t ? (t === 'BUY' ? '#3b1f6e' : '#1a2e1a') : 'transparent',
              color: activeTab === t ? (t === 'BUY' ? '#a78bfa' : '#10b981') : '#94a3b8',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.15s',
            }}
          >
            {t === 'BUY' ? <ArrowDownCircle size={15} /> : <ArrowUpCircle size={15} />}
            {t === 'BUY' ? 'Buy Orders' : 'Sell Orders'}
            <span style={{
              backgroundColor: activeTab === t ? (t === 'BUY' ? '#7c3aed' : '#10b981') : '#1e2d45',
              color: activeTab === t ? '#fff' : '#475569',
              borderRadius: '10px',
              padding: '1px 7px',
              fontSize: '11px',
            }}>
              {trades.filter((tr) => tr.type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <TradeTable trades={trades} type={activeTab} censored={censored} />
    </div>
  )
}
