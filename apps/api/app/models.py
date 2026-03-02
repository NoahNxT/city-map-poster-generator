from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class OutputFormat(str, Enum):
    png = "png"
    svg = "svg"
    pdf = "pdf"


class PosterRequest(BaseModel):
    city: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)
    latitude: str | None = None
    longitude: str | None = None
    countryLabel: str | None = Field(default=None, max_length=120)
    displayCity: str | None = Field(default=None, max_length=120)
    displayCountry: str | None = Field(default=None, max_length=120)
    fontFamily: str | None = Field(default=None, max_length=80)
    theme: str = Field(default="terracotta", min_length=1, max_length=60)
    allThemes: bool = False
    includeWater: bool = True
    includeParks: bool = True
    cityFontSize: float | None = Field(default=None, ge=8, le=120)
    countryFontSize: float | None = Field(default=None, ge=6, le=80)
    textColor: str | None = Field(default=None, max_length=16)
    labelPaddingScale: float = Field(default=1.0, ge=0.5, le=3.0)
    textBlurEnabled: bool = False
    textBlurSize: float = Field(default=1.0, ge=0.6, le=2.5)
    textBlurStrength: float = Field(default=8.0, ge=0.0, le=30.0)
    distance: int = Field(default=18000, ge=1000, le=50000)
    width: float = Field(default=12, ge=1, le=20)
    height: float = Field(default=16, ge=1, le=20)
    format: OutputFormat = OutputFormat.png

    @field_validator("city", "country", "theme", mode="before")
    @classmethod
    def normalize_string(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("textColor", mode="before")
    @classmethod
    def normalize_text_color(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        trimmed = value.strip()
        if not trimmed:
            return None
        return trimmed

    @field_validator("textColor")
    @classmethod
    def validate_text_color(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) not in {4, 7} or not value.startswith("#"):
            raise ValueError("textColor must be a hex color like #abc or #aabbcc")
        valid_hex = "0123456789abcdefABCDEF"
        if not all(ch in valid_hex for ch in value[1:]):
            raise ValueError("textColor must be a valid hex color")
        return value

    @model_validator(mode="after")
    def validate_lat_lon_pair(self) -> "PosterRequest":
        has_lat = bool(self.latitude and self.latitude.strip())
        has_lon = bool(self.longitude and self.longitude.strip())
        if has_lat != has_lon:
            raise ValueError("latitude and longitude must be provided together")
        return self


class Theme(BaseModel):
    id: str
    name: str
    description: str
    colors: dict[str, str]


class LocationSuggestion(BaseModel):
    placeId: str
    displayName: str
    city: str
    country: str
    latitude: str
    longitude: str
    countryCode: str | None = None


class FontSuggestion(BaseModel):
    family: str
    category: str | None = None
    popularity: int | None = None


class Artifact(BaseModel):
    theme: str
    format: OutputFormat
    fileName: str
    key: str


class JobStatus(str, Enum):
    queued = "queued"
    downloading = "downloading"
    rendering = "rendering"
    packaging = "packaging"
    complete = "complete"
    failed = "failed"


class JobState(BaseModel):
    jobId: str
    status: JobStatus
    progress: int = Field(default=0, ge=0, le=100)
    steps: list[str] = Field(default_factory=list)
    artifacts: list[Artifact] = Field(default_factory=list)
    zipKey: str | None = None
    error: str | None = None
    createdAt: str
    updatedAt: str

    @staticmethod
    def new(job_id: str) -> "JobState":
        now = datetime.now(timezone.utc).isoformat()
        return JobState(
            jobId=job_id,
            status=JobStatus.queued,
            progress=0,
            steps=["Queued"],
            createdAt=now,
            updatedAt=now,
        )
