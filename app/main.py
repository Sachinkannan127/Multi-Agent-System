import os
import sys

# Ensure backend directory is in sys.path
_backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if os.path.exists(_backend_dir) and _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import the actual FastAPI application from backend/app/main.py
from backend.app.main import app
