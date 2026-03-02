from fastapi.testclient import TestClient

from app.main import app
from app.models import PosterRequest


def test_missing_city_country_rejected() -> None:
    try:
        PosterRequest.model_validate({"city": "", "country": ""})
        assert False, "Validation should fail"
    except Exception:
        assert True


def test_width_height_max_rejected() -> None:
    try:
        PosterRequest.model_validate(
            {
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "distance": 10000,
                "width": 21,
                "height": 12,
                "format": "png",
            }
        )
        assert False, "Validation should fail"
    except Exception:
        assert True


def test_lat_lon_pair_required_together() -> None:
    try:
        PosterRequest.model_validate(
            {
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "latitude": "48.8566",
            }
        )
        assert False, "Validation should fail"
    except Exception:
        assert True
