import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { fetchPortfolio } from '../../api/client'

interface Position {
  symbol: string
  name: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  portfolio_pct: number
}

const CHART_COLORS = [
  '#7c3aed', '#a78bfa', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#84cc16', '#f97316',
]

const MOCK_POSITIONS: Position[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', quantity: 50, avg_cost: 170.00, current_price: 182.50, market_value: 9125, unrealized_pnl: 625, unrealized_pnl_pct: 7.35, portfolio_pct: 22.4 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', quantity: 20, avg_cost: 420.00, current_price: 495.80, market_value: 9916, unrealized_pnl: 1516, unrealized_pnl_pct: 18.05, portfolio_pct: 24.3 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 25, avg_cost: 350.00, current_price: 378.90, market_value: 9472.5, unrealized_pnl: 722.5, unrealized_pnl_pct: 8.25, portfolio_pct: 23.2 },
  { symbol: 'BTC', name: 'Bitcoin', quantity: 0.15, avg_cost: 42000, current_price: 51200, market_value: 7680, unrealized_pnl: 1380, unrealized_pnl_pct: 21.9, portfolio_pct: 18.8 },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', quantity: 30, avg_cost: 115.00, current_price: 128.40, market_value: 3852, unrealized_pnl: 402, unrealized_pnl_pct: 11.65, portfolio_pct: 9.4 },
  { symbol: 'CASH', name: 'Cash & Equivalents', quantity: 1, avg_cost: 770, current_price: 770, market_value: 770, unrealized_pnl: 0, unrealized_pnl_pct: 0, portfolio_pct: 1.9 },
]

function formatCurrency(val: number) {
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function formatPct(val: number) {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: Position }[] }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
        <div style={{ fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>{d.symbol}</div>
        <div style={{ color: '#94a3b8' }}>{formatCurrency(d.market_value)}</div>
        <div style={{ color: '#a78bfa' }}>{d.portfolio_pct.toFixed(1)}% of portfolio</div>
      </div>
    )
  }
  return null
}

const MASK = '••••••'

export default function Portfolio({ censored = false }: { censored?: boolean }) {
  const mask = (val: string) => censored ? MASK : val

  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0)
  const totalPnL = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0)
  const totalPnLPct = (totalPnL / (totalValue - totalPnL)) * 100

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await fetchPortfolio<Position>()
      if (data && data.length > 0) setPositions(data)
    } catch {
      // keep mock data if API unavailable
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>Portfolio</h1>
          <span style={{ fontSize: '12px', color: '#475569' }}>Last updated {lastUpdated.toLocaleTimeString()}</span>
        </div>
        <button
          onClick={refresh}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Value', value: mask(formatCurrency(totalValue)), sub: null },
          { label: 'Unrealized P&L', value: mask(formatCurrency(totalPnL)), sub: mask(formatPct(totalPnLPct)), positive: totalPnL >= 0 },
          { label: 'Positions', value: positions.filter(p => p.symbol !== 'CASH').length.toString(), sub: 'active holdings' },
        ].map((card) => (
          <div key={card.label} style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: card.positive !== undefined ? (card.positive ? '#10b981' : '#ef4444') : '#f1f5f9' }}>
              {card.value}
            </div>
            {card.sub && <div style={{ fontSize: '12px', color: card.positive !== undefined ? (card.positive ? '#10b981' : '#ef4444') : '#94a3b8', marginTop: '2px' }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Chart + Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        {/* Pie Chart */}
        <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Allocation</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={positions}
                dataKey="portfolio_pct"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
              >
                {positions.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {positions.map((p, i) => (
              <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{p.symbol}</span>
                </div>
                <span style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: '600' }}>{p.portfolio_pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Holdings Table */}
        <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', padding: '20px', overflow: 'auto' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Holdings</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['Symbol', 'Qty', 'Avg Cost', 'Current', 'Market Value', 'P&L', 'P&L %'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr
                  key={p.symbol}
                  style={{ borderBottom: '1px solid #1a2640', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a2640')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: '700', color: '#f1f5f9' }}>{p.symbol}</div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8' }}>{p.quantity}</td>
                  <td style={{ padding: '12px', color: '#94a3b8' }}>{mask(formatCurrency(p.avg_cost))}</td>
                  <td style={{ padding: '12px', color: '#f1f5f9', fontWeight: '600' }}>{mask(formatCurrency(p.current_price))}</td>
                  <td style={{ padding: '12px', color: '#f1f5f9' }}>{mask(formatCurrency(p.market_value))}</td>
                  <td style={{ padding: '12px', color: p.unrealized_pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p.unrealized_pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {mask(formatCurrency(p.unrealized_pnl))}
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: p.unrealized_pnl_pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {mask(formatPct(p.unrealized_pnl_pct))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
