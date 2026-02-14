from fastapi import APIRouter
from ..ibkr.client import ibkr

router = APIRouter(prefix="/api/ibkr", tags=["ibkr"])


@router.get("/status")
def get_status():
    """Returns IBKR gateway connection status."""
    connected = ibkr.is_authenticated()
    account = ibkr.get_account_id() if connected else None
    return {
        "connected": connected,
        "account": account or "",
        "gateway_url": ibkr.base_url,
    }


@router.post("/logout")
def logout():
    """
    Terminates the IBKR gateway session.

    This calls IBKR's /logout endpoint which:
    - Invalidates the current session token on IBKR's server
    - Forces re-authentication via browser on next use
    - Prevents any further API calls until re-authenticated

    The local gateway process keeps running but all subsequent
    requests will return 401 until the user logs in again at
    https://localhost:5000
    """
    success = False
    try:
        with ibkr._client() as client:
            res = client.post(f"{ibkr.base_url}/v1/api/logout")
            success = res.status_code == 200
    except Exception:
        pass  # gateway may not be running

    # Clear any cached account ID so next auth check is fresh
    ibkr.account_id = ""

    return {"logged_out": True, "session_invalidated": success}
