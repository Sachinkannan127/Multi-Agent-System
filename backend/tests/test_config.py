import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.core.config import settings


def test_settings_loaded():
    """Test configuration settings object."""
    assert settings.PROJECT_NAME == "Multi-Agent System"
    assert settings.VERSION == "1.0.0"
    assert settings.API_V1_STR == "/api/v1"
    assert settings.DEFAULT_MODEL is not None


def test_model_tiers_and_fallbacks():
    """Test tier mappings and fallback sequences."""
    assert "Fast" in settings.MODEL_TIERS
    assert "Slow" in settings.MODEL_TIERS
    assert "Pro" in settings.MODEL_TIERS

    assert "Fast" in settings.FALLBACK_SEQUENCES
    assert "Slow" in settings.FALLBACK_SEQUENCES
    assert "Pro" in settings.FALLBACK_SEQUENCES

    assert len(settings.FALLBACK_SEQUENCES["Fast"]) > 0
    assert len(settings.FALLBACK_SEQUENCES["Slow"]) > 0
    assert len(settings.FALLBACK_SEQUENCES["Pro"]) > 0


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
