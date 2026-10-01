import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8990"))
    # Bind to 0.0.0.0 to accept connections from localhost (both IPv4 and IPv6) and local network
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "false" if os.getenv("RENDER") else "true").lower() in ("true", "1", "yes")

    print(f"Starting server on {host}:{port} (reload={reload})...")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)

    