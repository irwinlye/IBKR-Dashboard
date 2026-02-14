# TradeDesk

> **macOS only.** This dashboard is built and tested on macOS. Windows/Linux are not supported at this time.
<img width="1486" height="802" alt="Screenshot 2026-02-14 at 6 39 04 PM" src="https://github.com/user-attachments/assets/437c8241-ccc2-49d4-bc7b-2d44fe078a97" />

A local trading portfolio dashboard built with Electron, React, TypeScript, Python (FastAPI), and PostgreSQL. Connects to Interactive Brokers via the Client Portal Web API for live portfolio and trade data.

---

## Features

- **Portfolio** — Pie chart showing allocation by position, holdings table with unrealised P&L
- **History** — Filled buy and sell orders, separated into sub-tabs
- **Insights** — Search any stock, crypto, or ETF and view price trend charts
- **Journal** — Daily trade diary with structured Good / Bad trade entries, calendar navigation, and auto-save
- **Privacy mode** — Single button to hide all financial values
- **IBKR integration** — Connects to Interactive Brokers Client Portal Gateway for live data (requires IBKR Pro)

---

## Prerequisites

Before you begin, install the following:

| Tool | Version | Install |
|---|---|---|
| Node.js | v18+ | https://nodejs.org |
| Python | v3.11+ | https://python.org |
| Homebrew | latest | https://brew.sh |
| Java (JRE) | 8u192+ | https://java.com/en/download/ *(only needed for IBKR live data)* |

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/tradedesk.git
cd tradedesk
```

### 2. Install PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb trading_dashboard
```

### 3. Set up the backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Install dependencies
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
venv/bin/pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env if needed (defaults work out of the box)
```

### 4. Set up the frontend

```bash
cd ../frontend
npm install
```

---

## Running the app

You need **two terminals** — one for the backend, one for the frontend.

**Terminal 1 — Backend:**
```bash
cd /path/to/tradedesk
./start-backend.sh
```
The API will be available at `http://localhost:8000`.

**Terminal 2 — Frontend (Electron app):**
```bash
cd /path/to/tradedesk
./start-frontend.sh
```
The Electron window will open automatically.

---

## Connecting IBKR Live Data (optional)

The dashboard works fully with mock data by default. To connect your real IBKR account:

> **Requires an IBKR Pro account.** IBKR Lite accounts do not have API access.

### Step 1 — Download the Client Portal Gateway

Go to **https://interactivebrokers.github.io/cpwebapi** → Quickstart tab → download `clientportal.gw.zip`.

Extract it into the project root:
```bash
cd /path/to/tradedesk
unzip ~/Downloads/clientportal.gw.zip
```

### Step 2 — Start the gateway

```bash
cd clientportal.gw
bin/run.sh root/conf.yaml
```

Leave this terminal open while using the dashboard.

### Step 3 — Authenticate

Open **https://localhost:5000** in your browser. You will see a security warning — click **Advanced → Proceed**. Log in with your IBKR username and password (2FA required).

### Step 4 — Add your account ID

Edit `backend/.env`:
```
IBKR_ACCOUNT_ID=U1234567   # replace with your account number
```

Restart the backend. The sidebar will show **Connected** in green and live data will replace mock data automatically.

### Session management

- Sessions expire after **~6 minutes of inactivity** or at midnight NY time
- Re-authenticate at `https://localhost:5000` when expired
- Use the **Log out** button in the sidebar to invalidate the session (forces re-authentication)
- Never expose the backend port (8000) or gateway port (5000) outside your local machine

---

## Project structure

```
tradedesk/
├── frontend/                  # Electron + React + TypeScript
│   └── src/renderer/src/
│       ├── App.tsx
│       ├── api/client.ts      # All API calls to FastAPI
│       └── components/
│           ├── Sidebar.tsx
│           ├── Portfolio/
│           ├── History/
│           ├── Insights/
│           └── Diary/
├── backend/                   # Python FastAPI
│   ├── app/
│   │   ├── main.py            # App entry, CORS, rate limiting, security headers
│   │   ├── config.py          # Settings from .env
│   │   ├── database.py        # PostgreSQL connection + schema init
│   │   ├── ibkr/client.py     # IBKR Client Portal API wrapper
│   │   └── routers/
│   │       ├── portfolio.py
│   │       ├── trades.py
│   │       ├── insights.py
│   │       ├── ibkr.py        # Status + logout
│   │       └── diary.py       # Trade journal CRUD
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                   # ← not committed, created by you
├── start-backend.sh
├── start-frontend.sh
├── .gitignore
└── README.md
```

---

## Security notes

- The backend runs on `localhost:8000` — **never expose this port to the internet**
- CORS is restricted to localhost origins only
- Rate limiting: 120 requests/minute
- Security headers applied to all responses (X-Frame-Options, X-Content-Type-Options, etc.)
- Your `.env` file is in `.gitignore` — it will never be committed
- The IBKR gateway uses a self-signed certificate for its local HTTPS connection — SSL verification is disabled only for localhost gateway calls
- Logging out via the dashboard calls IBKR's session invalidation endpoint, requiring re-authentication before any further API access

---

## Troubleshooting

**Backend won't start — "pg_config not found"**
```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
# Then re-run: venv/bin/pip install -r requirements.txt
```

**"Database does not exist" error**
```bash
/opt/homebrew/opt/postgresql@16/bin/createdb trading_dashboard
```

**IBKR gateway shows "not connected"**
- Make sure the gateway terminal is still running
- Re-authenticate at https://localhost:5000
- Sessions expire at midnight NY time — log in again each day

**Electron window is blank**
- Make sure the backend is running first on port 8000
- Check the backend terminal for errors
