from fastapi import APIRouter
from ..ibkr.client import ibkr

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("/{symbol}")
def get_insights(symbol: str):
    """
    Returns market data + price history for a given symbol.
    Requires IBKR Gateway to be connected for live data.
    Returns null if not available (frontend falls back to mock data).
    """
    if not ibkr.is_authenticated():
        return None

    data = ibkr.get_market_data(symbol.upper())
    return data
