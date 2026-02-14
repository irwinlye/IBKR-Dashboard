"""
IBKR Client Portal Web API client.

The Client Portal Gateway must be running locally at https://localhost:5000
Download it from: https://www.interactivebrokers.com/en/trading/ib-api.php

Authentication flow:
1. Start the gateway: `bin/run.sh` (or `bin/run.bat` on Windows)
2. Open https://localhost:5000 in your browser and log in with your IBKR credentials
3. The gateway handles session tokens - once authenticated, this client can make calls

Docs: https://www.interactivebrokers.com/api/doc.html
"""

import httpx
from typing import Optional
from ..config import settings

# Gateway uses a self-signed cert - disable SSL verification for local connection
GATEWAY_URL = settings.ibkr_gateway_url
TIMEOUT = 10.0


class IBKRClient:
    def __init__(self):
        self.base_url = GATEWAY_URL
        self.account_id = settings.ibkr_account_id

    def _client(self) -> httpx.Client:
        return httpx.Client(verify=False, timeout=TIMEOUT)

    def is_authenticated(self) -> bool:
        """Check if the gateway session is active."""
        try:
            with self._client() as client:
                res = client.get(f"{self.base_url}/v1/api/iserver/auth/status")
                if res.status_code == 200:
                    data = res.json()
                    return data.get("authenticated", False)
        except Exception:
            pass
        return False

    def get_account_id(self) -> Optional[str]:
        """Fetch the primary account ID."""
        if self.account_id:
            return self.account_id
        try:
            with self._client() as client:
                res = client.get(f"{self.base_url}/v1/api/iserver/accounts")
                if res.status_code == 200:
                    data = res.json()
                    accounts = data.get("accounts", [])
                    if accounts:
                        self.account_id = accounts[0]
                        return self.account_id
        except Exception:
            pass
        return None

    def get_portfolio_positions(self) -> list[dict]:
        """
        Fetch current portfolio positions.
        Endpoint: GET /v1/api/portfolio/{accountId}/positions/0
        Returns list of positions with conid, symbol, position, avgCost, mktValue, unrealizedPnl
        """
        account = self.get_account_id()
        if not account:
            return []
        try:
            with self._client() as client:
                res = client.get(f"{self.base_url}/v1/api/portfolio/{account}/positions/0")
                if res.status_code == 200:
                    raw = res.json()
                    return self._normalize_positions(raw)
        except Exception:
            pass
        return []

    def _normalize_positions(self, raw: list[dict]) -> list[dict]:
        """Map IBKR position fields to our internal format."""
        positions = []
        total_value = sum(abs(p.get("mktValue", 0)) for p in raw)
        for p in raw:
            mkt_value = p.get("mktValue", 0)
            avg_cost = p.get("avgCost", 0)
            qty = p.get("position", 0)
            unrealized = p.get("unrealizedPnl", 0)
            portfolio_pct = (mkt_value / total_value * 100) if total_value > 0 else 0
            positions.append({
                "symbol": p.get("ticker", p.get("symbol", "?")),
                "name": p.get("name", p.get("companyName", "")),
                "quantity": qty,
                "avg_cost": avg_cost,
                "current_price": p.get("mktPrice", 0),
                "market_value": mkt_value,
                "unrealized_pnl": unrealized,
                "unrealized_pnl_pct": (unrealized / (avg_cost * qty) * 100) if (avg_cost * qty) != 0 else 0,
                "portfolio_pct": round(portfolio_pct, 2),
            })
        return positions

    def get_filled_orders(self) -> list[dict]:
        """
        Fetch filled (executed) orders.
        Endpoint: GET /v1/api/iserver/account/trades
        Returns recent trades for the account.
        """
        try:
            with self._client() as client:
                res = client.get(f"{self.base_url}/v1/api/iserver/account/trades")
                if res.status_code == 200:
                    raw = res.json()
                    return self._normalize_trades(raw)
        except Exception:
            pass
        return []

    def _normalize_trades(self, raw: list[dict]) -> list[dict]:
        """Map IBKR trade fields to our internal format."""
        trades = []
        for i, t in enumerate(raw):
            side = t.get("side", "").upper()
            trade_type = "BUY" if side in ("BOT", "BUY", "B") else "SELL"
            qty = abs(float(t.get("size", 0)))
            price = float(t.get("price", 0))
            trades.append({
                "id": i + 1,
                "symbol": t.get("symbol", "?"),
                "name": t.get("companyName", t.get("symbol", "")),
                "type": trade_type,
                "quantity": qty,
                "price": price,
                "total": qty * price,
                "filled_at": t.get("trade_time_r", t.get("tradeTime", "")),
                "status": "FILLED",
                "exchange": t.get("exchange", ""),
                "currency": t.get("currency", "USD"),
                "ibkr_order_id": str(t.get("orderId", "")),
            })
        return trades

    def get_market_data(self, symbol: str) -> Optional[dict]:
        """
        Get snapshot market data for a symbol.
        Endpoint: GET /v1/api/iserver/marketdata/snapshot?conids={conid}&fields=...
        Note: requires resolving symbol -> conid first via /v1/api/iserver/secdef/search
        """
        conid = self._resolve_conid(symbol)
        if not conid:
            return None
        try:
            fields = "31,84,86,85,88,6509,7295,7296"  # last, bid, ask, high, low, open, 52wHigh, 52wLow
            with self._client() as client:
                res = client.get(
                    f"{self.base_url}/v1/api/iserver/marketdata/snapshot",
                    params={"conids": conid, "fields": fields}
                )
                if res.status_code == 200:
                    data = res.json()
                    if data:
                        return self._normalize_market_data(symbol, data[0])
        except Exception:
            pass
        return None

    def _resolve_conid(self, symbol: str) -> Optional[str]:
        """Resolve a symbol to its IBKR contract ID (conid)."""
        try:
            with self._client() as client:
                res = client.get(
                    f"{self.base_url}/v1/api/iserver/secdef/search",
                    params={"symbol": symbol}
                )
                if res.status_code == 200:
                    results = res.json()
                    if results:
                        return str(results[0].get("conid", ""))
        except Exception:
            pass
        return None

    def _normalize_market_data(self, symbol: str, raw: dict) -> dict:
        """Map IBKR snapshot fields to our internal format."""
        return {
            "symbol": symbol,
            "name": raw.get("companyName", symbol),
            "exchange": raw.get("exchange", ""),
            "currency": raw.get("currency", "USD"),
            "current_price": float(raw.get("31", 0) or 0),   # last price
            "change": float(raw.get("82", 0) or 0),           # change
            "change_pct": float(raw.get("83", 0) or 0),       # change %
            "high_52w": float(raw.get("7295", 0) or 0),
            "low_52w": float(raw.get("7296", 0) or 0),
            "volume": float(raw.get("87", 0) or 0),
            "market_cap": None,
            "history": [],  # historical bars require a separate endpoint
        }


# Singleton instance
ibkr = IBKRClient()
