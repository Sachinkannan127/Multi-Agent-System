import os
from typing import Dict, List
from dotenv import load_dotenv

# Load environment variables from .env file (check current directory and backend directory)
load_dotenv(override=True)
_backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.exists(_backend_env):
    load_dotenv(_backend_env, override=False)



class Settings:
    PROJECT_NAME: str = "Multi-Agent System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    SGAI_API_KEY: str = os.getenv("SGAI_API_KEY", "")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    # Clerk Authentication
    CLERK_PUBLISHABLE_KEY: str = os.getenv("CLERK_PUBLISHABLE_KEY", os.getenv("VITE_CLERK_PUBLISHABLE_KEY", ""))
    CLERK_SECRET_KEY: str = os.getenv("CLERK_SECRET_KEY", "")

    # MongoDB Vector Store Configuration
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "multiagent_db")
    MONGODB_COLLECTION_NAME: str = os.getenv("MONGODB_COLLECTION_NAME", "vector_chunks")
    VECTOR_INDEX_NAME: str = os.getenv("VECTOR_INDEX_NAME", "vector_index")

    # Default LLM Model (Groq)
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "groq/openai/gpt-oss-20b")

    # Mode to Provider mapping:
    # Fast -> Groq | Slow -> Groq | Pro -> Groq
    MODEL_TIERS: Dict[str, str] = {
        "Fast": "groq/openai/gpt-oss-20b",
        "Slow": "groq/openai/gpt-oss-20b",
        "Pro": "groq/openai/gpt-oss-20b",
    }

    # Ordered Fallback sequences per mode
    FALLBACK_SEQUENCES: Dict[str, List[str]] = {
        "Fast": [
            "groq/openai/gpt-oss-20b",
            "gemini/gemini-3.8-flash",
            "gemini/gemini-3.5-flash",
        ],
        "Slow": [
            "groq/openai/gpt-oss-20b",
            "gemini/gemini-3.8-flash",
            "gemini/gemini-3.5-flash",
        ],
        "Pro": [
            "groq/openai/gpt-oss-20b",
            "gemini/gemini-3.8-flash",
            "gemini/gemini-3.5-flash",
        ],
    }



settings = Settings()
