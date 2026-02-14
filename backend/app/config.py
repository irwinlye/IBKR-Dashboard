from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/trading_dashboard"
    ibkr_gateway_url: str = "https://localhost:5000"
    ibkr_account_id: str = ""
    openai_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
