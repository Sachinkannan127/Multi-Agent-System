import os
import sys

# Ensure backend directory is in sys.path
_root_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.join(_root_dir, "backend")
if os.path.exists(_backend_dir) and _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8990))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
