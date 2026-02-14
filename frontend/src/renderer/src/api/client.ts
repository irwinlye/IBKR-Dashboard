const BASE_URL = 'http://localhost:8000'

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function put<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Portfolio ────────────────────────────────────────────────────────────────

export async function fetchPortfolio<T>(): Promise<T[] | null> {
  return get<T[]>('/api/portfolio')
}

// ── Trades ───────────────────────────────────────────────────────────────────

export async function fetchTrades<T>(): Promise<T[] | null> {
  return get<T[]>('/api/trades')
}

// ── Insights ─────────────────────────────────────────────────────────────────

export async function fetchInsights<T>(symbol: string): Promise<T | null> {
  return get<T>(`/api/insights/${encodeURIComponent(symbol)}`)
}

// ── IBKR ─────────────────────────────────────────────────────────────────────

export async function checkIBKRStatus() {
  return get<{ connected: boolean; account: string }>('/api/ibkr/status')
}

// ── AI Coach ─────────────────────────────────────────────────────────────────

export interface TradeForCoach {
  trade_type: 'good' | 'bad'
  symbol?: string
  entry_price?: number | null
  exit_price?: number | null
  pnl?: number | null
  what_went_well?: string
  why_it_worked?: string
  what_went_wrong?: string
  lesson_learned?: string
  overall_notes?: string
  trade_date?: string
}

/**
 * Streams AI coaching feedback for a trade. Returns a ReadableStream of text chunks.
 * Caller is responsible for reading and rendering the stream.
 */
export async function streamAICoachFeedback(trade: TradeForCoach): Promise<ReadableStream<string> | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/coach/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
      body: JSON.stringify(trade),
    })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    return new ReadableStream<string>({
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) { controller.close(); return }
        controller.enqueue(decoder.decode(value, { stream: true }))
      },
      cancel() { reader.cancel() },
    })
  } catch {
    return null
  }
}

// ── Diary ────────────────────────────────────────────────────────────────────

export async function getDiaryDates(): Promise<string[] | null> {
  return get<string[]>('/api/diary/dates')
}

export async function getDiaryEntry(date: string): Promise<unknown | null> {
  return get<unknown>(`/api/diary/${date}`)
}

export async function saveDiaryEntry(date: string, entry: unknown): Promise<{ saved: boolean } | null> {
  return put<{ saved: boolean }>(`/api/diary/${date}`, entry)
}
