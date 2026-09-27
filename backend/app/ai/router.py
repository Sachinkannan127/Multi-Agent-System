import os
import json
import logging
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings

logger = logging.getLogger("app.ai.router")

IntentType = Literal["rag", "toolcalling", "direct"]


class IntentClassification(BaseModel):
    intent: IntentType = Field(
        ...,
        description="Classified route intent: 'rag' for document/PDF questions, 'toolcalling' for real-time web search/scraping, or 'direct' for general LLM questions."
    )
    confidence: float = Field(..., description="Classification confidence score between 0.0 and 1.0")
    reasoning: str = Field(..., description="Short explanation for the classification decision")


ROUTER_CLASSIFICATION_PROMPT = """You are an expert AI Request Router.
Your job is to analyze the user's prompt and classify it into exactly ONE of the following 3 routes:

1. "rag": Select this route if the user is asking about uploaded PDF documents, candidate resumes, vector store content, files, or specific document content.
   Examples:
   - "What skills are listed in the resume?"
   - "Summarize the uploaded PDF document."
   - "What does the candidate say about project experience in the file?"

2. "toolcalling": Select this route if the user is asking for real-time data, web search, live news, scraping a website URL, current stock prices, weather, or recent internet events using tools (Tavily Search / ScrapeGraphAI).
   Examples:
   - "What is the latest news on AI today?"
   - "Scrape https://news.ycombinator.com and list top headlines."
   - "Search Tavily for Python 3.14 updates."
   - "What is the live stock price of Google?"

3. "direct": Select this route for basic conversational questions, general knowledge, code generation, math problems, explanations, or general chat that does NOT require document search or web scraping.
   Examples:
   - "Hi, how are you?"
   - "Explain quantum mechanics in simple terms."
   - "Write a python function to check if a string is a palindrome."
   - "What is the capital of France?"

Analyze the prompt carefully and return valid JSON with keys: "intent", "confidence", "reasoning".
User Prompt: "{prompt}"
JSON Response:"""


class SmartIntentRouter:
    """
    Classifies user prompts and routes execution to RAG, ToolCalling, or Direct LLM.
    """

    def __init__(self, classification_model: Optional[str] = None):
        self.model = classification_model or settings.DEFAULT_MODEL

    def classify_intent(self, prompt: str) -> IntentClassification:
        """
        Classifies user prompt intent into 'rag', 'toolcalling', or 'direct'.
        Includes keyword heuristic fallback for instant latency optimization.
        """
        lower_prompt = prompt.lower()

        # Heuristic fast check for explicit keyword patterns
        doc_keywords = ["pdf", "resume", "uploaded", "document", "file content", "vector store", "chunk"]
        
        import re
        realtime_patterns = [
            r"\blatest\b", r"\brecent\b", r"\bresend\b", r"\bcurrent\b", r"\bnow\b",
            r"\btoday\b", r"\bthis week\b", r"\bthis month\b", r"\bheadlines\b",
            r"\bbreaking\b", r"\bscrape\b", r"\blive\b", r"\bnews\b", r"\bsearch\b",
            r"\brealtime\b", r"\breal-time\b", r"\bupdates?\b", r"https?://",
            r"\btavily\b", r"\bscrapegraph\b"
        ]

        # Check document keywords
        if any(k in lower_prompt for k in doc_keywords):
            return IntentClassification(
                intent="rag",
                confidence=0.95,
                reasoning="Prompt contains explicit document/PDF related keywords."
            )

        # Check real-time / web scraping / temporal keywords (latest, recent, current, now, etc.)
        if any(re.search(pat, lower_prompt) for pat in realtime_patterns):
            return IntentClassification(
                intent="toolcalling",
                confidence=0.98,
                reasoning="Prompt requests real-time data, latest info, recent updates, or web search/scraping."
            )

        # Use LLM Classifier for nuanced or ambiguous prompts
        try:
            formatted_prompt = ROUTER_CLASSIFICATION_PROMPT.format(prompt=prompt)
            messages = [{"role": "user", "content": formatted_prompt}]

            # Use Gemini or Groq API Key
            if settings.GEMINI_API_KEY:
                os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
            if settings.GROQ_API_KEY:
                os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
            
            target_model = self.model
            response = litellm.completion(
                model=target_model,
                messages=messages,
                temperature=0.0,
                response_format={"type": "json_object"}
            )

            raw_text = response.choices[0].message.content.strip()
            # Clean markdown JSON block formatting if present
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            parsed_data = json.loads(raw_text.strip())
            intent_val = parsed_data.get("intent", "direct").lower()
            if intent_val not in ["rag", "toolcalling", "direct"]:
                intent_val = "direct"

            return IntentClassification(
                intent=intent_val,
                confidence=float(parsed_data.get("confidence", 0.9)),
                reasoning=parsed_data.get("reasoning", "Classified by Smart Intent LLM Router.")
            )

        except Exception as e:
            logger.warning(f"LLM Classification failed ({e}). Defaulting to 'direct' route.")
            return IntentClassification(
                intent="direct",
                confidence=0.7,
                reasoning=f"Fallback classification due to router LLM error: {str(e)}"
            )


# Global router singleton instance
intent_router = SmartIntentRouter()
