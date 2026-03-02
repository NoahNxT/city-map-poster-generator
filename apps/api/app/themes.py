import json
from pathlib import Path

from app.models import Theme

THEMES_DIR = Path(__file__).parent / "vendor" / "maptoposter" / "themes"


def load_themes() -> list[Theme]:
    themes: list[Theme] = []
    for path in sorted(THEMES_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        colors = {
            key: value
            for key, value in data.items()
            if key
            not in {
                "name",
                "description",
            }
            and isinstance(value, str)
        }
        themes.append(
            Theme(
                id=path.stem,
                name=data.get("name", path.stem),
                description=data.get("description", ""),
                colors=colors,
            )
        )
    return themes


def theme_ids() -> set[str]:
    return {theme.id for theme in load_themes()}
