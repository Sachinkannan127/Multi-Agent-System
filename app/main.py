from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.db import db_manager
from app.routes.chat import router as chat_router
from app.routes.upload import router as upload_router
from app.routes.rag import router as rag_router
from app.routes.agent import router as agent_router
from app.routes.router import router as intent_router_endpoint
from app.routes.langgraph import router as langgraph_router


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


@app.get("/", tags=["Landing"])
def landing_page():
    return {
        "message": "Welcome to the Multi-Agent API",
        "status": "online",
        "docs": "/docs",
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
