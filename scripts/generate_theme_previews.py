#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
WEB_PREVIEW_DIR = ROOT / "apps" / "web" / "public" / "theme-previews"

sys.path.insert(0, str(API_ROOT))

from app.models import OutputFormat, PosterRequest  # noqa: E402
from app.render import render_poster  # noqa: E402
from app.themes import load_themes  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate static theme preview posters for the web gallery.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(WEB_PREVIEW_DIR),
        help="Directory where preview PNG files are written.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing preview files.",
    )
    parser.add_argument(
        "--format",
        choices=[OutputFormat.png.value, OutputFormat.svg.value],
        default=OutputFormat.svg.value,
        help="Output format for generated theme previews.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    base_payload = PosterRequest(
        city="Antwerp",
        country="Belgium",
        latitude="51.2211097",
        longitude="4.3997081",
        theme="terracotta",
        allThemes=False,
        includeWater=True,
        includeParks=True,
        distance=12000,
        width=6,
        height=8,
        format=OutputFormat(args.format),
    )

    themes = load_themes()
    print(
        f"Generating {len(themes)} theme previews in {args.format.upper()} into {output_dir}"
    )
    for theme in themes:
        output_path = output_dir / f"{theme.id}.{args.format}"
        if output_path.exists() and not args.force:
            print(f"Skipping {theme.id} (already exists)")
            continue

        payload = base_payload.model_copy(update={"theme": theme.id})
        print(f"Rendering {theme.id} -> {output_path.name}")
        render_poster(
            payload,
            theme_name=theme.id,
            output_path=output_path,
            output_format=OutputFormat(args.format),
            raster_dpi=160 if args.format == OutputFormat.png.value else None,
            network_type="drive",
            include_water=True,
            include_parks=True,
            include_labels=False,
            include_attribution=False,
        )

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
