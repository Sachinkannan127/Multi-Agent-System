import os
from typing import Dict, List
from dotenv import load_dotenv

# Load environment variables from .env file (override=True ensures changes in .env are picked up immediately)
load_dotenv(override=True)



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

    # MongoDB Vector Store Configuration
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "multiagent_db")
    MONGODB_COLLECTION_NAME: str = os.getenv("MONGODB_COLLECTION_NAME", "vector_chunks")
    VECTOR_INDEX_NAME: str = os.getenv("VECTOR_INDEX_NAME", "vector_index")

    # Default LLM Model
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "groq/openai/gpt-oss-20b")

    # Mode to Provider mapping:
    # Fast -> Groq | Slow -> Gemini | Pro -> Gemini/Groq
    MODEL_TIERS: Dict[str, str] = {
        "Fast": "groq/openai/gpt-oss-20b",
        "Slow": "gemini/gemini-1.5-flash",
        "Pro": "gemini/gemini-1.5-flash",
    }

    # Ordered Fallback sequences per mode
    FALLBACK_SEQUENCES: Dict[str, List[str]] = {
        "Fast": [
            "groq/openai/gpt-oss-20b",
            "gemini/gemini-1.5-flash",
            "gemini/gemini-2.5-flash",
        ],
        "Slow": [
            "gemini/gemini-1.5-flash",
            "gemini/gemini-2.5-flash",
            "groq/openai/gpt-oss-20b",
            "groq/openai/gpt-oss-20b",
        ],
        "Pro": [
            "gemini/gemini-1.5-flash",
            "gemini/gemini-2.5-flash",
            "groq/openai/gpt-oss-20b",
        ],
    }



settings = Settings()
