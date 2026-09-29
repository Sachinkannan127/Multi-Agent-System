import os
import sys

# Extend package search path to include backend/app
_backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_backend_app = os.path.join(_backend_dir, "app")
__path__ = [_backend_app]
