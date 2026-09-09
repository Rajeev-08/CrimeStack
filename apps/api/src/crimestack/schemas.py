from typing import Literal
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Strict):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)


class BootstrapRequest(Credentials):
    bootstrap_secret: str


class UserCreate(Credentials):
    role: Literal["viewer", "analyst", "supervisor", "administrator"]


class Scope(Strict):
    district: str | None = None
    category: str | None = None
    start: str | None = None
    end: str | None = None

    @field_validator("start", "end")
    @classmethod
    def valid_date(cls, value):
        if value:
            return date.fromisoformat(value).isoformat()
        return None

    @model_validator(mode="after")
    def date_order(self):
        if self.start and self.end and self.start > self.end:
            raise ValueError("Start date must be on or before end date")
        return self


class ToolCall(Strict):
    tool: Literal[
        "totals",
        "severity",
        "districts",
        "categories",
        "trends",
        "hotspots",
        "warnings",
        "network",
        "models",
        "patterns",
        "repeat_cases",
        "context",
        "prevention",
    ]
    scope: Scope = Field(default_factory=Scope)


class ChatRequest(Strict):
    question: str = Field(min_length=1, max_length=2000)
    language: Literal["en", "kn"] = "en"
    previous_tool: ToolCall | None = None
    context: Scope = Field(default_factory=Scope)


class RecordCreate(Strict):
    dataset_id: str | None = None
    data: dict


class RecordPatch(Strict):
    version: int = Field(ge=1)
    action: str
    data: dict = Field(default_factory=dict)
