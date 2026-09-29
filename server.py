import os
import sys

_backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from app.main import app
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8990"))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "false").lower() in ("true", "1", "yes")
    print(f"Starting server from root on {host}:{port}...")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=reload)
