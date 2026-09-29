import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8990"))
    # In cloud environments like Render, host must be 0.0.0.0
    host = os.getenv("HOST", "0.0.0.0" if os.getenv("RENDER") else "127.0.0.1")
    reload = os.getenv("RELOAD", "false" if os.getenv("RENDER") else "true").lower() in ("true", "1", "yes")

    print(f"Starting server on {host}:{port} (reload={reload})...")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)

    