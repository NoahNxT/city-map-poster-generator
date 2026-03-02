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
