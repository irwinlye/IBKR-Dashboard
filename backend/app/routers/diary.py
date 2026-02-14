import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date as DateType
from ..database import get_db

router = APIRouter(prefix="/api/diary", tags=["diary"])

# ── Pydantic models ──────────────────────────────────────────────────────────

class GoodTrade(BaseModel):
    symbol: str = Field(default="", max_length=20)
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    pnl: Optional[float] = None
    what_went_well: str = Field(default="", max_length=2000)
    why_it_worked: str = Field(default="", max_length=2000)

class BadTrade(BaseModel):
    symbol: str = Field(default="", max_length=20)
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    pnl: Optional[float] = None
    what_went_wrong: str = Field(default="", max_length=2000)
    lesson_learned: str = Field(default="", max_length=2000)

class DiaryEntryUpsert(BaseModel):
    good_trades: list[GoodTrade] = []
    bad_trades: list[BadTrade] = []
    overall_notes: str = Field(default="", max_length=5000)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = dict(row)
    # JSONB comes back as str from psycopg2 in some cases
    for key in ("good_trades", "bad_trades"):
        if isinstance(d[key], str):
            d[key] = json.loads(d[key])
    d["entry_date"] = str(d["entry_date"])
    return d

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dates")
def get_entry_dates(db: Session = Depends(get_db)):
    """Return all dates that have diary entries (for calendar highlighting)."""
    result = db.execute(text("SELECT entry_date FROM diary_entries ORDER BY entry_date DESC"))
    return [str(row[0]) for row in result]


@router.get("/{entry_date}")
def get_entry(entry_date: str, db: Session = Depends(get_db)):
    """Fetch a diary entry by date (YYYY-MM-DD). Returns null if not found."""
    try:
        parsed = DateType.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    result = db.execute(
        text("SELECT * FROM diary_entries WHERE entry_date = :d"),
        {"d": parsed}
    )
    row = result.mappings().first()
    if not row:
        return None
    return _row_to_dict(dict(row))


@router.put("/{entry_date}")
def upsert_entry(entry_date: str, body: DiaryEntryUpsert, db: Session = Depends(get_db)):
    """Create or update a diary entry for a given date."""
    try:
        parsed = DateType.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    good_json = json.dumps([t.model_dump() for t in body.good_trades])
    bad_json  = json.dumps([t.model_dump() for t in body.bad_trades])

    db.execute(text("""
        INSERT INTO diary_entries (entry_date, good_trades, bad_trades, overall_notes, updated_at)
        VALUES (:d, :good::jsonb, :bad::jsonb, :notes, NOW())
        ON CONFLICT (entry_date) DO UPDATE
            SET good_trades   = EXCLUDED.good_trades,
                bad_trades    = EXCLUDED.bad_trades,
                overall_notes = EXCLUDED.overall_notes,
                updated_at    = NOW()
    """), {"d": parsed, "good": good_json, "bad": bad_json, "notes": body.overall_notes})
    db.commit()
    return {"saved": True, "date": str(parsed)}


@router.delete("/{entry_date}")
def delete_entry(entry_date: str, db: Session = Depends(get_db)):
    """Delete a diary entry for a given date."""
    try:
        parsed = DateType.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    db.execute(text("DELETE FROM diary_entries WHERE entry_date = :d"), {"d": parsed})
    db.commit()
    return {"deleted": True}
