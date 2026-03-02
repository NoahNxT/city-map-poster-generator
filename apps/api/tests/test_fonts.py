from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import FontSuggestion


def test_fonts_endpoint_returns_suggestions() -> None:
    redis = MagicMock()
    redis.incr.return_value = 1
    redis.ttl.return_value = 60

    with (
        patch("app.main.get_redis", return_value=redis),
        patch(
            "app.main.search_fonts",
            new=AsyncMock(
                return_value=[
                    FontSuggestion(
                        family="Roboto",
                        category="sans-serif",
                        popularity=1,
                    ),
                    FontSuggestion(
                        family="Roboto Mono",
                        category="monospace",
                        popularity=22,
                    ),
                ]
            ),
        ),
    ):
        client = TestClient(app)
        response = client.get("/v1/fonts?q=roboto&limit=5")

    assert response.status_code == 200
    payload = response.json()
    assert "suggestions" in payload
    assert len(payload["suggestions"]) == 2
    assert payload["suggestions"][0]["family"] == "Roboto"
