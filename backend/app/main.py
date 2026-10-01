import os
import sys

# Ensure backend root directory is in sys.path so app modules always resolve correctly
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Ensure stdout and stderr use UTF-8 on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db import db_manager
from app.routes.chat import router as chat_router
from app.routes.upload import router as upload_router
from app.routes.rag import router as rag_router
from app.routes.agent import router as agent_router
from app.routes.router import router as intent_router_endpoint
from app.routes.langgraph import router as langgraph_router
from app.routes.conversations import router as conversations_router
from app.routes.ocr import router as ocr_router
from app.routes.auth import router as auth_router
from app.routes.user import router as user_router
from app.routes.folders import router as folders_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB and ping
    print("Initializing MongoDB connection...")
    db_manager.connect()
    yield
    # Shutdown: Close MongoDB connection
    db_manager.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-Agent System API with Stateful LangGraph Workflow & Memory",
    version=settings.VERSION,
    lifespan=lifespan,
)

# Enable CORS for all origins and HTTP methods (handles OPTIONS preflight)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routes
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(chat_router)

app.include_router(upload_router, prefix=settings.API_V1_STR)
app.include_router(upload_router)

app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(rag_router)

app.include_router(agent_router, prefix=settings.API_V1_STR)
app.include_router(agent_router)

app.include_router(intent_router_endpoint, prefix=settings.API_V1_STR)
app.include_router(intent_router_endpoint)

app.include_router(langgraph_router, prefix=settings.API_V1_STR)
app.include_router(langgraph_router)

app.include_router(conversations_router, prefix=settings.API_V1_STR)
app.include_router(conversations_router)

app.include_router(folders_router, prefix=settings.API_V1_STR)
app.include_router(folders_router)

app.include_router(user_router, prefix=settings.API_V1_STR)
app.include_router(user_router)

app.include_router(ocr_router, prefix=settings.API_V1_STR)
app.include_router(ocr_router)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(auth_router)



@app.get("/", tags=["Landing"])
def landing_page():
    return {
        "message": "Welcome to the Multi-Agent System API",
        "status": "online",
        "version": settings.VERSION,
        "frontend": "http://localhost:5173",
        "docs": "/docs",
        "endpoints": {
            "chat": f"{settings.API_V1_STR}/chat",
            "router": f"{settings.API_V1_STR}/router/execute",
            "langgraph": f"{settings.API_V1_STR}/langgraph/chat",
            "rag": f"{settings.API_V1_STR}/rag/query",
            "upload": f"{settings.API_V1_STR}/upload",
            "agent": f"{settings.API_V1_STR}/agent/execute",
        },
    }


@app.get("/health", tags=["Health Check"])
def health_check():
    mongo_status = db_manager.ping()
    is_healthy = mongo_status.get("status") == "connected"
    return {
        "status": "healthy" if is_healthy else "degraded",
        "message": "Service is running",
        "mongodb": mongo_status,
    }


@app.get("/mongo/ping", tags=["Database"])
def mongo_ping():
    """Pings MongoDB database and returns connection status."""
    return db_manager.ping()
