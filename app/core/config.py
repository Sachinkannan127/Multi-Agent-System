import os
from typing import Dict, List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    PROJECT_NAME: str = "Multi-Agent System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")

    # Default LLM Model
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "groq/qwen/qwen3.8-27b")

    # Mode to Provider mapping:
    # Fast -> Groq | Slow -> Gemini | Pro -> Mistral
    MODEL_TIERS: Dict[str, str] = {
        "Fast": "groq/qwen/qwen3.8-27b",
        "Slow": "gemini/gemini-3.6-flash",
        "Pro": "mistral/mistral-small-latest",
    }

    # Ordered Fallback sequences per mode
    FALLBACK_SEQUENCES: Dict[str, List[str]] = {
        "Fast": [
            "groq/qwen/qwen3.8-27b",
            "groq/openai/gpt-oss-20b",
        ],
        "Slow": [
            "gemini/gemini-3.6-flash",
            "gemini/gemini-2.5-flash",
            "groq/qwen/qwen3.8-27b",
        ],
        "Pro": [
            "mistral/mistral-small-latest",
            "mistral/mistral-medium-latest",
            "groq/openai/gpt-oss-120b",
            "groq/qwen/qwen3.8-27b",
        ],
    }


settings = Settings()
