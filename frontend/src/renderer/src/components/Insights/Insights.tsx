import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Search, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { fetchInsights } from '../../api/client'

interface InsightsProps {
  searchQuery: string
}

interface PricePoint {
  date: string
  price: number
  volume?: number
}

interface StockInfo {
  symbol: string
  name: string
  exchange: string
  currency: string
  current_price: number
  change: number
  change_pct: number
  high_52w: number
  low_52w: number
  volume: number
  market_cap?: number
  history: PricePoint[]
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y'

const POPULAR_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'BTC', 'ETH', 'TSM']

function generateMockHistory(basePrice: number, days: number): PricePoint[] {
  const history: PricePoint[] = []
  let price = basePrice * 0.85
  const now = new Date()
  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    price = price * (1 + (Math.random() - 0.48) * 0.025)
    history.push({
      date: d.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 50000000 + 10000000),
    })
  }
  history[history.length - 1].price = basePrice
  return history
}

const MOCK_STOCKS: Record<string, StockInfo> = {
  AAPL: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD', current_price: 182.50, change: 2.30, change_pct: 1.28, high_52w: 199.62, low_52w: 163.31, volume: 52400000, market_cap: 2810000000000, history: generateMockHistory(182.50, 365) },
  NVDA: { symbol: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ', currency: 'USD', current_price: 495.80, change: 12.40, change_pct: 2.56, high_52w: 505.48, low_52w: 370.15, volume: 38200000, market_cap: 1220000000000, history: generateMockHistory(495.80, 365) },
  MSFT: { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', currency: 'USD', current_price: 378.90, change: -1.20, change_pct: -0.32, high_52w: 430.82, low_52w: 362.90, volume: 21800000, market_cap: 2810000000000, history: generateMockHistory(378.90, 365) },
  TSLA: { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', currency: 'USD', current_price: 210.40, change: -5.60, change_pct: -2.59, high_52w: 278.98, low_52w: 138.80, volume: 88400000, market_cap: 670000000000, history: generateMockHistory(210.40, 365) },
  AMZN: { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', currency: 'USD', current_price: 178.30, change: 3.10, change_pct: 1.77, high_52w: 185.10, low_52w: 118.35, volume: 35600000, market_cap: 1850000000000, history: generateMockHistory(178.30, 365) },
  GOOGL: { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', currency: 'USD', current_price: 140.20, change: 0.80, change_pct: 0.57, high_52w: 153.78, low_52w: 115.83, volume: 24100000, market_cap: 1760000000000, history: generateMockHistory(140.20, 365) },
  META: { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', currency: 'USD', current_price: 492.60, change: 8.20, change_pct: 1.69, high_52w: 531.49, low_52w: 352.91, volume: 18900000, market_cap: 1250000000000, history: generateMockHistory(492.60, 365) },
  BTC: { symbol: 'BTC', name: 'Bitcoin', exchange: 'CRYPTO', currency: 'USD', current_price: 51200, change: 1400, change_pct: 2.81, high_52w: 73835, low_52w: 38555, volume: 28400000000, history: generateMockHistory(51200, 365) },
  ETH: { symbol: 'ETH', name: 'Ethereum', exchange: 'CRYPTO', currency: 'USD', current_price: 2840, change: -45, change_pct: -1.56, high_52w: 4068, low_52w: 1503, volume: 12800000000, history: generateMockHistory(2840, 365) },
  TSM: { symbol: 'TSM', name: 'Taiwan Semiconductor', exchange: 'NYSE', currency: 'USD', current_price: 128.40, change: 1.85, change_pct: 1.46, high_52w: 145.08, low_52w: 82.83, volume: 14200000, history: generateMockHistory(128.40, 365) },
}

const RANGE_DAYS: Record<TimeRange, number> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }

function formatNum(val: number) {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`
  return val.toLocaleString()
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}>
        <div style={{ color: '#475569', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontWeight: '700', color: '#a78bfa' }}>${payload[0].value.toFixed(2)}</div>
      </div>
    )
  }
  return null
}

export default function Insights({ searchQuery }: InsightsProps) {
  const [inputValue, setInputValue] = useState(searchQuery || '')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [stockData, setStockData] = useState<StockInfo | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('3M')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStock = useCallback(async (symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    if (!upper) return
    setLoading(true)
    setError(null)
    setSelectedSymbol(upper)
    try {
      const data = await fetchInsights<StockInfo>(upper)
      if (data) {
        setStockData(data)
      } else {
        const mock = MOCK_STOCKS[upper]
        if (mock) {
          setStockData(mock)
        } else {
          setError(`Symbol "${upper}" not found. Connect IBKR Gateway for live data.`)
          setStockData(null)
        }
      }
    } catch {
      const mock = MOCK_STOCKS[upper]
      if (mock) setStockData(mock)
      else {
        setError(`Symbol "${upper}" not found. Connect IBKR Gateway for live data.`)
        setStockData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      setInputValue(searchQuery.toUpperCase())
      loadStock(searchQuery)
    }
  }, [searchQuery, loadStock])

  const filteredHistory = stockData
    ? stockData.history.slice(-RANGE_DAYS[timeRange])
    : []

  const isPositive = stockData ? stockData.change_pct >= 0 : true
  const priceColor = isPositive ? '#10b981' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f1f5f9' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Insights</h1>
        <p style={{ fontSize: '13px', color: '#475569' }}>Search any stock, crypto, or ETF to view price trends and key data.</p>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '10px', padding: '10px 14px', flex: 1, maxWidth: '400px' }}>
          <Search size={16} color="#475569" />
          <input
            type="text"
            placeholder="Enter symbol (e.g. AAPL, BTC, TSM)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') loadStock(inputValue) }}
            style={{ background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '14px', width: '100%' }}
          />
        </div>
        <button
          onClick={() => loadStock(inputValue)}
          style={{ padding: '10px 20px', backgroundColor: '#7c3aed', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
        >
          Search
        </button>
      </div>

      {/* Popular Symbols */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {POPULAR_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => { setInputValue(s); loadStock(s) }}
            style={{
              padding: '5px 12px',
              backgroundColor: selectedSymbol === s ? '#3b1f6e' : '#131e30',
              border: `1px solid ${selectedSymbol === s ? '#7c3aed' : '#1e2d45'}`,
              borderRadius: '20px',
              color: selectedSymbol === s ? '#a78bfa' : '#94a3b8',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1f1010', border: '1px solid #ef4444', borderRadius: '10px', padding: '12px 16px', color: '#ef4444', fontSize: '13px' }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>Loading data...</div>
      )}

      {/* Stock Data */}
      {!loading && stockData && (
        <>
          {/* Stock Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', padding: '20px 24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#f1f5f9' }}>{stockData.symbol}</span>
                <span style={{ backgroundColor: '#0f1729', border: '1px solid #1e2d45', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>{stockData.exchange}</span>
              </div>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>{stockData.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>
                ${stockData.current_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', color: priceColor, fontSize: '15px', fontWeight: '600' }}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {isPositive ? '+' : ''}{stockData.change.toFixed(2)} ({isPositive ? '+' : ''}{stockData.change_pct.toFixed(2)}%)
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: '52W High', value: `$${stockData.high_52w.toLocaleString()}` },
              { label: '52W Low', value: `$${stockData.low_52w.toLocaleString()}` },
              { label: 'Volume', value: formatNum(stockData.volume) },
              { label: 'Market Cap', value: stockData.market_cap ? formatNum(stockData.market_cap) : 'N/A' },
            ].map((stat) => (
              <div key={stat.label} style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{stat.label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ backgroundColor: '#131e30', border: '1px solid #1e2d45', borderRadius: '12px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price History</h2>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0f1729', border: '1px solid #1e2d45', borderRadius: '8px', padding: '3px' }}>
                {(Object.keys(RANGE_DAYS) as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: timeRange === r ? '#3b1f6e' : 'transparent',
                      color: timeRange === r ? '#a78bfa' : '#475569',
                      fontSize: '12px',
                      fontWeight: '600',
                      transition: 'all 0.15s',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={filteredHistory} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={priceColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v)
                    return timeRange === '1W' ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                  width={70}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={priceColor}
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: priceColor, stroke: '#0b1120', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !stockData && !error && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#475569' }}>
          <TrendingUp size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px', color: '#94a3b8' }}>Search for a symbol to get started</div>
          <div style={{ fontSize: '13px' }}>Enter a ticker above or click one of the popular symbols</div>
        </div>
      )}
    </div>
  )
}
