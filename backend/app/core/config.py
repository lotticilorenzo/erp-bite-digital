from functools import lru_cache
from typing import Any

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_TRUE_VALUES = {"1", "true", "yes", "on", "debug", "dev", "development", "local"}
_FALSE_VALUES = {"0", "false", "no", "off", "release", "prod", "production", "staging", ""}


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Bite ERP"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    CORS_ALLOW_CREDENTIALS: bool = True
    TRUSTED_HOSTS: str = ""
    ENABLE_HSTS: bool = False
    ENABLE_API_DOCS: bool | None = None
    BOOTSTRAP_ADMIN_ENABLED: bool = False
    BOOTSTRAP_ADMIN_EMAIL: EmailStr = "admin@bite.com"
    BOOTSTRAP_ADMIN_PASSWORD: str = ""
    BOOTSTRAP_ADMIN_NOME: str = "Admin"
    BOOTSTRAP_ADMIN_COGNOME: str = "Bite"
    AUTO_CREATE_MISSING_TABLES: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://bite:bite_secret@db:5432/bite_erp"

    # JWT
    JWT_SECRET: str = ""
    SECRET_KEY: str = "CAMBIA_QUESTA_CHIAVE_IN_PRODUZIONE"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 ora (ridotto da 8h per sicurezza)

    # Frontend
    FRONTEND_BASE_URL: str = "http://localhost"  # Override in .env in produzione

    # Fatture in Cloud
    FIC_API_KEY: str = ""
    FIC_BASE_URL: str = "https://api.fattureincloud.it/v2"
    FIC_OAUTH_CLIENT_ID: str = ""
    FIC_OAUTH_CLIENT_SECRET: str = ""
    FIC_OAUTH_REDIRECT_URI: str = ""
    FIC_COMPANY_ID: str = ""
    FIC_ACCESS_TOKEN: str = ""
    FIC_REFRESH_TOKEN: str = ""
    FIC_SYNC_SCHEDULE_ENABLED: bool = True
    FIC_SYNC_HOUR: int = 2
    FIC_SYNC_MINUTE: int = 0
    FIC_SYNC_TIMEZONE: str = "Europe/Rome"

    # ClickUp
    CLICKUP_API_TOKEN: str = ""
    CLICKUP_BASE_URL: str = "https://api.clickup.com/api/v2"
    CLICKUP_TEAM_ID: str = ""

    # Mail
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_PORT: int = 587
    MAIL_SERVER: str = ""
    MAIL_TLS: bool = True
    MAIL_SSL: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator(
        "DEBUG",
        "CORS_ALLOW_CREDENTIALS",
        "ENABLE_HSTS",
        "BOOTSTRAP_ADMIN_ENABLED",
        "AUTO_CREATE_MISSING_TABLES",
        "FIC_SYNC_SCHEDULE_ENABLED",
        "MAIL_TLS",
        "MAIL_SSL",
        "ENABLE_API_DOCS",
        mode="before",
    )
    @classmethod
    def _coerce_bool(cls, value: Any) -> Any:
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        raw = str(value).strip().lower()
        if raw in _TRUE_VALUES:
            return True
        if raw in _FALSE_VALUES:
            return False
        return value

    @staticmethod
    def _parse_csv_list(raw_value: str) -> list[str]:
        items: list[str] = []
        for raw_item in raw_value.split(","):
            item = raw_item.strip()
            if item and item not in items:
                items.append(item)
        return items

    @property
    def cors_origins_list(self) -> list[str]:
        return self._parse_csv_list(self.CORS_ORIGINS)

    @property
    def trusted_hosts_list(self) -> list[str]:
        return self._parse_csv_list(self.TRUSTED_HOSTS)

    @property
    def api_docs_enabled(self) -> bool:
        if self.ENABLE_API_DOCS is None:
            return self.DEBUG
        return bool(self.ENABLE_API_DOCS)

    @property
    def is_production(self) -> bool:
        return str(self.APP_ENV).strip().lower() in {"prod", "production"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
