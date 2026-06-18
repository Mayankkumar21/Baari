from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret: str
    cron_secret: str

    msg91_auth_key: str = ""
    msg91_whatsapp_integrated_number: str = ""
    msg91_whatsapp_namespace: str = ""

    # Cloudflare Turnstile (optional bot defense). When both are empty, the
    # widget is hidden and verification is skipped — same dev-mode pattern as MSG91.
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""

    app_env: str = "dev"
    clinic_tz: str = "Asia/Kolkata"


@lru_cache
def get_settings() -> Settings:
    return Settings()
