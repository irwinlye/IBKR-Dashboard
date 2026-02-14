from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..ibkr.client import ibkr

router = APIRouter(prefix="/api/trades", tags=["trades"])


@router.get("")
def get_trades(db: Session = Depends(get_db)):
    """
    Returns filled trades.
    - If IBKR is connected: fetches live from IBKR and persists new trades to DB
    - If not connected: returns trades stored in local DB
    """
    if ibkr.is_authenticated():
        live_trades = ibkr.get_filled_orders()
        # Persist any new trades to DB
        for t in live_trades:
            db.execute(text("""
                INSERT INTO trades (symbol, name, trade_type, quantity, price, total, filled_at, status, exchange, currency, ibkr_order_id)
                VALUES (:symbol, :name, :trade_type, :quantity, :price, :total, :filled_at, :status, :exchange, :currency, :ibkr_order_id)
                ON CONFLICT DO NOTHING
            """), {
                "symbol": t["symbol"],
                "name": t["name"],
                "trade_type": t["type"],
                "quantity": t["quantity"],
                "price": t["price"],
                "total": t["total"],
                "filled_at": t["filled_at"],
                "status": t["status"],
                "exchange": t["exchange"],
                "currency": t["currency"],
                "ibkr_order_id": t.get("ibkr_order_id"),
            })
        db.commit()
        return live_trades

    # Fallback: return from local DB
    result = db.execute(text("""
        SELECT id, symbol, name, trade_type as type, quantity, price, total,
               filled_at, status, exchange, currency
        FROM trades
        ORDER BY filled_at DESC
        LIMIT 500
    """))
    rows = result.mappings().all()
    return [dict(r) for r in rows]
