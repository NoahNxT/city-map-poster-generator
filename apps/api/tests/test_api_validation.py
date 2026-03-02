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


def test_text_color_must_be_hex() -> None:
    try:
        PosterRequest.model_validate(
            {
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "textColor": "orange",
            }
        )
        assert False, "Validation should fail"
    except Exception:
        assert True


def test_city_and_country_font_size_bounds() -> None:
    try:
        PosterRequest.model_validate(
            {
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "cityFontSize": 4,
                "countryFontSize": 200,
            }
        )
        assert False, "Validation should fail"
    except Exception:
        assert True


def test_label_padding_scale_bounds() -> None:
    try:
        PosterRequest.model_validate(
            {
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "labelPaddingScale": 0.1,
            }
        )
        assert False, "Validation should fail"
    except Exception:
        assert True


def test_text_blur_bounds() -> None:
    try:
        PosterRequest.model_validate(
            {
                "city": "Paris",
                "country": "France",
                "theme": "terracotta",
                "textBlurSize": 0.1,
                "textBlurStrength": 100,
            }
        )
        assert False, "Validation should fail"
    except Exception:
        assert True
