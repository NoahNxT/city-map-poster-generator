from __future__ import annotations

from typing import Any

import httpx

from app.config import settings
from app.models import LocationSuggestion

_CITY_KEYS = (
    "city",
    "town",
    "village",
    "municipality",
    "hamlet",
    "suburb",
    "county",
    "state_district",
    "state",
)


def _extract_city(address: dict[str, Any]) -> str:
    for key in _CITY_KEYS:
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


async def search_locations(query: str, limit: int = 8) -> list[LocationSuggestion]:
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": max(1, min(limit, 10)),
    }
    headers = {
        "User-Agent": settings.nominatim_user_agent,
    }

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.get(
            settings.nominatim_search_url,
            params=params,
            headers=headers,
        )
        response.raise_for_status()

    payload = response.json()
    if not isinstance(payload, list):
        return []

    suggestions: list[LocationSuggestion] = []
    for item in payload:
        if not isinstance(item, dict):
            continue

        address = item.get("address")
        if not isinstance(address, dict):
            address = {}

        city = _extract_city(address)
        country = address.get("country", "")
        lat = item.get("lat", "")
        lon = item.get("lon", "")

        if not isinstance(country, str) or not country.strip():
            continue
        if not isinstance(lat, str) or not lat.strip():
            continue
        if not isinstance(lon, str) or not lon.strip():
            continue

        display_name = item.get("display_name", "")
        if not isinstance(display_name, str) or not display_name.strip():
            display_name = f"{city or country}, {country}"

        if not city:
            name = item.get("name")
            city = name.strip() if isinstance(name, str) and name.strip() else country.strip()

        place_id = str(item.get("place_id", ""))
        if not place_id:
            continue

        country_code = address.get("country_code")
        if not isinstance(country_code, str):
            country_code = None

        suggestions.append(
            LocationSuggestion(
                placeId=place_id,
                displayName=display_name.strip(),
                city=city,
                country=country.strip(),
                latitude=lat.strip(),
                longitude=lon.strip(),
                countryCode=country_code.upper() if country_code else None,
            )
        )

    return suggestions
