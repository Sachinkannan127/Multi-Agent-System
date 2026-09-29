import os
import sys

# Automatically add backend directory to sys.path so 'app.main' resolves
# even if uvicorn is started from the project root directory
_backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if os.path.isdir(_backend_dir) and _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
