from __future__ import annotations

import json
import time

import httpx

from app.config import settings
from app.models import FontSuggestion

_FONT_CACHE: list[FontSuggestion] = []
_FONT_CACHE_EXPIRES_AT: float = 0.0

_FALLBACK_FONTS: list[FontSuggestion] = [
    FontSuggestion(family="Roboto", category="sans-serif", popularity=1),
    FontSuggestion(family="Open Sans", category="sans-serif", popularity=2),
    FontSuggestion(family="Lato", category="sans-serif", popularity=3),
    FontSuggestion(family="Montserrat", category="sans-serif", popularity=4),
    FontSuggestion(family="Poppins", category="sans-serif", popularity=5),
    FontSuggestion(family="Inter", category="sans-serif", popularity=6),
    FontSuggestion(family="Oswald", category="sans-serif", popularity=7),
    FontSuggestion(family="Raleway", category="sans-serif", popularity=8),
    FontSuggestion(family="Merriweather", category="serif", popularity=9),
    FontSuggestion(family="Playfair Display", category="serif", popularity=10),
    FontSuggestion(family="Noto Sans", category="sans-serif", popularity=11),
    FontSuggestion(family="Noto Serif", category="serif", popularity=12),
]


def _parse_metadata_payload(raw_text: str) -> list[FontSuggestion]:
    cleaned = raw_text
    if cleaned.startswith(")]}'"):
        # Google fonts metadata responses can include an XSSI prefix.
        cleaned = cleaned.split("\n", 1)[1]

    payload = json.loads(cleaned)
    raw_list = payload.get("familyMetadataList")
    if not isinstance(raw_list, list):
        return []

    suggestions: list[FontSuggestion] = []
    for index, item in enumerate(raw_list):
        if not isinstance(item, dict):
            continue

        family = item.get("family")
        if not isinstance(family, str) or not family.strip():
            continue

        category = item.get("category")
        normalized_category = category if isinstance(category, str) else None

        popularity = item.get("popularity")
        normalized_popularity: int | None
        if isinstance(popularity, int):
            normalized_popularity = popularity
        else:
            normalized_popularity = index + 1

        suggestions.append(
            FontSuggestion(
                family=family.strip(),
                category=normalized_category,
                popularity=normalized_popularity,
            )
        )

    suggestions.sort(
        key=lambda item: (
            item.popularity if item.popularity is not None else 10**9,
            item.family.lower(),
        )
    )
    return suggestions


def _parse_developer_api_payload(payload: dict) -> list[FontSuggestion]:
    items = payload.get("items")
    if not isinstance(items, list):
        return []

    suggestions: list[FontSuggestion] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue

        family = item.get("family")
        if not isinstance(family, str) or not family.strip():
            continue

        category = item.get("category")
        normalized_category = category if isinstance(category, str) else None

        suggestions.append(
            FontSuggestion(
                family=family.strip(),
                category=normalized_category,
                popularity=index + 1,
            )
        )

    return suggestions


async def _load_font_catalog_from_developer_api() -> list[FontSuggestion]:
    api_key = settings.google_fonts_api_key.strip()
    if not api_key:
        return []

    params = {
        "key": api_key,
        "sort": "popularity",
    }
    headers = {"User-Agent": settings.nominatim_user_agent}
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.get(
            settings.google_fonts_api_url,
            params=params,
            headers=headers,
        )
        response.raise_for_status()

    if not isinstance(response.json(), dict):
        return []

    return _parse_developer_api_payload(response.json())


async def _load_font_catalog_from_metadata() -> list[FontSuggestion]:
    headers = {"User-Agent": settings.nominatim_user_agent}
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.get(settings.google_fonts_metadata_url, headers=headers)
        response.raise_for_status()

    return _parse_metadata_payload(response.text)


async def _load_font_catalog() -> list[FontSuggestion]:
    global _FONT_CACHE, _FONT_CACHE_EXPIRES_AT

    now = time.time()
    if _FONT_CACHE and now < _FONT_CACHE_EXPIRES_AT:
        return _FONT_CACHE

    loaders = (
        _load_font_catalog_from_developer_api,
        _load_font_catalog_from_metadata,
    )
    for loader in loaders:
        try:
            parsed = await loader()
            if parsed:
                _FONT_CACHE = parsed
                _FONT_CACHE_EXPIRES_AT = now + settings.google_fonts_cache_ttl_seconds
                return _FONT_CACHE
        except Exception:  # noqa: BLE001
            continue

    return _FALLBACK_FONTS


def _match_fonts(
    fonts: list[FontSuggestion],
    query: str,
    limit: int,
) -> list[FontSuggestion]:
    normalized_query = query.strip().lower()
    if not normalized_query:
        return fonts[:limit]

    starts_with: list[FontSuggestion] = []
    contains: list[FontSuggestion] = []
    for font in fonts:
        normalized_family = font.family.lower()
        if normalized_family.startswith(normalized_query):
            starts_with.append(font)
        elif normalized_query in normalized_family:
            contains.append(font)

    return (starts_with + contains)[:limit]


async def search_fonts(query: str, limit: int = 12) -> list[FontSuggestion]:
    normalized_limit = max(1, min(limit, 25))
    try:
        catalog = await _load_font_catalog()
    except Exception:  # noqa: BLE001
        catalog = _FALLBACK_FONTS

    return _match_fonts(catalog, query, normalized_limit)
