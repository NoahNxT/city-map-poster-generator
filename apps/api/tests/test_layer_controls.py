from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.jobs import run_generation_job
from app.main import app
from app.models import PosterRequest


def test_poster_request_defaults_include_layers() -> None:
    payload = PosterRequest.model_validate(
        {
            "city": "Paris",
            "country": "France",
        }
    )

    assert payload.includeWater is True
    assert payload.includeParks is True
    assert payload.cityFontSize is None
    assert payload.countryFontSize is None
    assert payload.textColor is None
    assert payload.labelPaddingScale == 1.0


def test_generation_job_passes_export_layer_flags_to_renderer() -> None:
    fake_redis = MagicMock()
    payload = {
        "city": "Paris",
        "country": "France",
        "theme": "terracotta",
        "allThemes": False,
        "includeWater": False,
        "includeParks": True,
        "cityFontSize": 58,
        "countryFontSize": 20,
        "textColor": "#8c4a18",
        "labelPaddingScale": 1.6,
        "distance": 12000,
        "width": 12,
        "height": 16,
        "format": "png",
    }

    with (
        patch("app.jobs.get_redis", return_value=fake_redis),
        patch("app.jobs.get_s3_client", return_value=MagicMock()),
        patch("app.jobs.theme_ids", return_value={"terracotta"}),
        patch("app.jobs.update_job_state"),
        patch("app.jobs.upload_file"),
        patch("app.jobs.render_poster") as render_mock,
    ):
        run_generation_job("job-123", payload, "127.0.0.1")

    assert render_mock.call_count == 1
    kwargs = render_mock.call_args.kwargs
    assert kwargs["include_water"] is False
    assert kwargs["include_parks"] is True
    payload_arg = render_mock.call_args.args[0]
    assert payload_arg.cityFontSize == 58
    assert payload_arg.countryFontSize == 20
    assert payload_arg.textColor == "#8c4a18"
    assert payload_arg.labelPaddingScale == 1.6


def test_preview_ignores_export_layer_toggles() -> None:
    fake_redis = MagicMock()
    fake_redis.incr.return_value = 1
    fake_redis.ttl.return_value = 120
    fake_redis.get.return_value = None

    async def run_in_threadpool_passthrough(func, *args, **kwargs):  # type: ignore[no-untyped-def]
        return func(*args, **kwargs)

    with (
        patch("app.main.get_redis", return_value=fake_redis),
        patch("app.main.get_s3_client", return_value=MagicMock()),
        patch("app.main.theme_ids", return_value={"terracotta"}),
        patch("app.main.object_exists", return_value=False),
        patch("app.main.upload_file"),
        patch("app.main.signed_url", return_value="https://example.com/preview.png"),
        patch("app.main.run_in_threadpool", side_effect=run_in_threadpool_passthrough),
        patch("app.main.settings.preview_include_water", False),
        patch("app.main.settings.preview_include_parks", False),
        patch("app.render.render_poster") as render_mock,
    ):
        client = TestClient(app)
        response = client.post(
            "/v1/preview",
            json={
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "allThemes": False,
                "includeWater": True,
                "includeParks": True,
                "distance": 12000,
                "width": 12,
                "height": 16,
                "format": "png",
            },
        )

    assert response.status_code == 200
    kwargs = render_mock.call_args.kwargs
    assert kwargs["include_water"] is False
    assert kwargs["include_parks"] is False
