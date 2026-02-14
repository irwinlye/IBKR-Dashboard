from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

engine = create_engine(settings.database_url, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they don't exist."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                name VARCHAR(100),
                trade_type VARCHAR(4) NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
                quantity DECIMAL(18, 8) NOT NULL,
                price DECIMAL(18, 4) NOT NULL,
                total DECIMAL(18, 4) NOT NULL,
                filled_at TIMESTAMPTZ NOT NULL,
                status VARCHAR(10) DEFAULT 'FILLED',
                exchange VARCHAR(20),
                currency VARCHAR(10) DEFAULT 'USD',
                ibkr_order_id VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                name VARCHAR(100),
                quantity DECIMAL(18, 8) NOT NULL,
                avg_cost DECIMAL(18, 4) NOT NULL,
                current_price DECIMAL(18, 4),
                market_value DECIMAL(18, 4),
                unrealized_pnl DECIMAL(18, 4),
                unrealized_pnl_pct DECIMAL(10, 4),
                portfolio_pct DECIMAL(10, 4),
                snapshot_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS diary_entries (
                id SERIAL PRIMARY KEY,
                entry_date DATE NOT NULL UNIQUE,
                good_trades JSONB NOT NULL DEFAULT '[]',
                bad_trades JSONB NOT NULL DEFAULT '[]',
                overall_notes TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        conn.commit()
