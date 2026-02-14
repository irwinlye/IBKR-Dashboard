from fastapi import APIRouter
from ..ibkr.client import ibkr

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("")
def get_portfolio():
    """
    Returns current portfolio positions.
    Falls back to empty list if IBKR gateway is not connected.
    """
    if ibkr.is_authenticated():
        positions = ibkr.get_portfolio_positions()
        return positions
    return []
