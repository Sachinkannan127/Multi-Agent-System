import os
import sys

# Ensure backend directory is always in sys.path so 'app' is importable from anywhere
_root_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.join(_root_dir, "backend")
if os.path.exists(_backend_dir) and _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
