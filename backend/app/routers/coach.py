from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from openai import AsyncOpenAI
from ..config import settings

router = APIRouter(prefix="/api/coach", tags=["coach"])

# ── Request model ─────────────────────────────────────────────────────────────

class TradeForCoach(BaseModel):
    trade_type: str = Field(..., description="'good' or 'bad'")
    symbol: str = Field(default="", max_length=20)
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    pnl: Optional[float] = None
    # Good trade fields
    what_went_well: str = Field(default="", max_length=2000)
    why_it_worked: str = Field(default="", max_length=2000)
    # Bad trade fields
    what_went_wrong: str = Field(default="", max_length=2000)
    lesson_learned: str = Field(default="", max_length=2000)
    # Context
    overall_notes: str = Field(default="", max_length=2000)
    trade_date: str = Field(default="", max_length=10)

# ── Prompt builder ────────────────────────────────────────────────────────────

def build_prompt(trade: TradeForCoach) -> str:
    pnl_str = f"${trade.pnl:+.2f}" if trade.pnl is not None else "not recorded"
    entry_str = f"${trade.entry_price:.2f}" if trade.entry_price is not None else "not recorded"
    exit_str = f"${trade.exit_price:.2f}" if trade.exit_price is not None else "not recorded"

    if trade.trade_type == "good":
        narrative = (
            f"What went well: {trade.what_went_well or 'not provided'}\n"
            f"Why it worked: {trade.why_it_worked or 'not provided'}"
        )
        tone = "reinforce what worked, identify any hidden risks they may have gotten lucky on, and suggest how to make this edge repeatable"
    else:
        narrative = (
            f"What went wrong: {trade.what_went_wrong or 'not provided'}\n"
            f"Lesson learned: {trade.lesson_learned or 'not provided'}"
        )
        tone = "be direct but constructive — identify the root cause of the loss, challenge whether the stated lesson actually addresses it, and give one concrete rule they can add to their trading plan"

    session_notes = f"\nSession notes: {trade.overall_notes}" if trade.overall_notes else ""

    return f"""You are an expert trading coach reviewing a trader's journal entry. Be specific, concise, and actionable. Do NOT give generic advice.

Trade details:
- Date: {trade.trade_date or 'not recorded'}
- Symbol: {trade.symbol or 'not recorded'}
- Entry: {entry_str} → Exit: {exit_str}
- P&L: {pnl_str}
- Classification: {trade.trade_type.upper()} trade
{narrative}{session_notes}

Your task: {tone}

Respond in this exact format (use markdown, keep each section to 2-4 sentences max):

### What I See
[Your objective read of what actually happened in this trade based on the numbers and the trader's notes]

### Pattern Recognition
[Any behavioral or technical pattern this trade reveals — e.g. cutting winners short, holding losers, FOMO entry, revenge trading, over-sizing, good risk management, etc.]

### The Real Lesson
[The one thing they must internalize — go deeper than what they wrote. If their stated lesson is correct, validate and sharpen it. If it misses the root cause, say so clearly.]

### Concrete Rule
[One specific, measurable rule they can add to their trading checklist tomorrow. Format: "Rule: [action] when [condition]"]

### Confidence Score
[Rate their self-awareness on this trade: X/10. One sentence explaining why.]"""

# ── Streaming endpoint ────────────────────────────────────────────────────────

@router.post("/analyse")
async def analyse_trade(trade: TradeForCoach):
    """Stream AI coaching feedback for a single trade journal entry."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key not configured. Add OPENAI_API_KEY to your .env file."
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = build_prompt(trade)

    async def token_stream():
        try:
            stream = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                max_tokens=600,
                temperature=0.7,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"\n\n[Error: {str(e)}]"

    return StreamingResponse(
        token_stream(),
        media_type="text/plain",
        headers={"X-Accel-Buffering": "no"},
    )
