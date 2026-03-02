from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from app.models import OutputFormat, PosterRequest

VENDOR_ROOT = Path(__file__).parent / "vendor" / "maptoposter"
CACHE_ROOT = Path("/tmp/map-cache")
CACHE_ROOT.mkdir(parents=True, exist_ok=True)

_maptoposter: Any = None
_load_fonts: Any = None
PREVIEW_CACHE_VERSION = "v4"


def _init_renderer() -> tuple[Any, Any]:
    global _maptoposter, _load_fonts
    if _maptoposter is not None and _load_fonts is not None:
        return _maptoposter, _load_fonts

    from app.vendor.maptoposter import create_map_poster as maptoposter
    from app.vendor.maptoposter.font_management import load_fonts

    # Configure vendored script to use absolute paths inside service runtime.
    maptoposter.THEMES_DIR = str(VENDOR_ROOT / "themes")
    maptoposter.FONTS_DIR = str(VENDOR_ROOT / "fonts")
    maptoposter.CACHE_DIR_PATH = str(CACHE_ROOT)
    maptoposter.CACHE_DIR = CACHE_ROOT
    maptoposter.CACHE_DIR.mkdir(exist_ok=True)

    _maptoposter = maptoposter
    _load_fonts = load_fonts
    return _maptoposter, _load_fonts


def preview_cache_key(payload: PosterRequest) -> str:
    as_dict = payload.model_dump(mode="json")
    as_dict["format"] = "png"
    as_dict["allThemes"] = False
    as_dict["_previewVersion"] = PREVIEW_CACHE_VERSION
    digest = hashlib.sha256(json.dumps(as_dict, sort_keys=True).encode("utf-8")).hexdigest()
    return f"preview:{digest}"


def resolve_coordinates(payload: PosterRequest) -> tuple[float, float]:
    from lat_lon_parser import parse

    maptoposter, _ = _init_renderer()
    if payload.latitude and payload.longitude:
        lat = parse(payload.latitude)
        lon = parse(payload.longitude)
        return float(lat), float(lon)

    coords = maptoposter.get_coordinates(payload.city, payload.country)
    return float(coords[0]), float(coords[1])


def build_file_name(payload: PosterRequest, theme: str, fmt: OutputFormat) -> str:
    city_slug = payload.city.strip().lower().replace(" ", "_")
    return f"{city_slug}_{theme}.{fmt.value}"


def render_poster(
    payload: PosterRequest,
    *,
    theme_name: str,
    output_path: Path,
    output_format: OutputFormat,
    raster_dpi: int | None = None,
    network_type: str | None = None,
    include_water: bool = True,
    include_parks: bool = True,
    include_labels: bool = True,
    include_attribution: bool = True,
) -> None:
    maptoposter, load_fonts = _init_renderer()
    coords = resolve_coordinates(payload)
    maptoposter.THEME = maptoposter.load_theme(theme_name)

    custom_fonts = None
    if payload.fontFamily:
        custom_fonts = load_fonts(payload.fontFamily)

    maptoposter.create_poster(
        payload.city,
        payload.country,
        coords,
        payload.distance,
        str(output_path),
        output_format.value,
        width=float(payload.width),
        height=float(payload.height),
        country_label=payload.countryLabel,
        display_city=payload.displayCity,
        display_country=payload.displayCountry,
        fonts=custom_fonts,
        raster_dpi=raster_dpi,
        network_type=network_type or "all",
        include_water=include_water,
        include_parks=include_parks,
        include_labels=include_labels,
        include_attribution=include_attribution,
        city_font_size=payload.cityFontSize,
        country_font_size=payload.countryFontSize,
        text_color=payload.textColor,
        label_padding_scale=payload.labelPaddingScale,
    )
