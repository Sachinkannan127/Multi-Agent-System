from fastapi import FastAPI
from app.core.config import settings
from app.routes.chat import router as chat_router
from app.routes.upload import router as upload_router
from app.routes.rag import router as rag_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-Agent System API with RAG",
    version=settings.VERSION,
)

# Register routes
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(chat_router)

app.include_router(upload_router, prefix=settings.API_V1_STR)
app.include_router(upload_router)

app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(rag_router)





@app.get("/", tags=["Landing"])
def landing_page():
    return {
        "message": "Welcome to the Multi-Agent API",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health Check"])
def health_check():
    return {
        "status": "healthy",
        "message": "Service is running normally",
    }
