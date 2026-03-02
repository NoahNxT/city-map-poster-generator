from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


def test_health_ok() -> None:
    with patch("app.main.get_redis") as mock_get_redis:
        redis = MagicMock()
        redis.ping.return_value = True
        mock_get_redis.return_value = redis

        client = TestClient(app)
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
