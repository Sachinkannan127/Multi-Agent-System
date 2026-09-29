import os
import sys

_backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Expose app and lifespan directly for uvicorn app.main:app
from backend.app.main import app, lifespan

__all__ = ["app", "lifespan"]
