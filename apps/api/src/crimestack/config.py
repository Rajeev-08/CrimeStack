from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite:///./crimestack.db"
    token_secret: str = "development-only-change-this-token-secret-32"
    signing_secret: str = "development-only-change-this-signing-secret-32"
    signing_key_id: str = "v1"
    previous_signing_keys: dict[str, str] = {}
    bootstrap_secret: str = "local-bootstrap-change-me"
    access_token_minutes: int = 30
    max_upload_bytes: int = 10_000_000
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60
    llm_api_key: str = ""
    llm_model: str = ""

    @model_validator(mode="after")
    def production(self):
        if self.environment == "production":
            for key in ("token_secret", "signing_secret", "bootstrap_secret"):
                value = getattr(self, key)
                if len(value) < 32 or "development" in value or "change-me" in value:
                    raise ValueError(f"Production requires a strong {key}")
            if not self.database_url.startswith("postgresql"):
                raise ValueError("Production requires PostgreSQL")
        if self.token_secret == self.signing_secret:
            raise ValueError("Token and signing secrets must be distinct")
        return self


@lru_cache
def settings():
    return Settings()
