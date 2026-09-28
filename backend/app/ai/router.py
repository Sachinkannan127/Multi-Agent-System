import os
import json
import logging
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings

logger = logging.getLogger("app.ai.router")

IntentType = Literal["rag", "toolcalling", "coding", "direct"]


class IntentClassification(BaseModel):
    intent: IntentType = Field(
        ...,
        description="Classified route intent: 'rag' for document/PDF questions, 'toolcalling' for real-time web search/scraping, 'coding' for software engineering & programming, or 'direct' for general LLM questions."
    )
    confidence: float = Field(..., description="Classification confidence score between 0.0 and 1.0")
    reasoning: str = Field(..., description="Short explanation for the classification decision")


ROUTER_CLASSIFICATION_PROMPT = """You are an expert AI Request Router.
Your job is to analyze the user's prompt and classify it into exactly ONE of the following 4 routes:

1. "rag": Select this route if the user is asking about uploaded PDF documents, candidate resumes, vector store content, files, or specific document content.
   Examples:
   - "What skills are listed in the resume?"
   - "Summarize the uploaded PDF document."

2. "toolcalling": Select this route if the user is asking for real-time data, web search, live news, scraping a website URL, current stock prices, weather, or recent internet events using web tools.
   Examples:
   - "What is the latest news on AI today?"
   - "Scrape https://news.ycombinator.com and list top headlines."

3. "coding": Select this route if the user is asking to write code, debug a function, solve an algorithm, refactor code, design a database schema, or write a software script.
   Examples:
   - "Write a Python function to sort a list of dictionaries by key."
   - "Debug this JavaScript async code."
   - "Build a FastAPI endpoint for user registration."

4. "direct": Select this route for basic conversational questions, general knowledge, explanations, or general chat.
   Examples:
   - "Hi, how are you?"
   - "Explain quantum mechanics in simple terms."

Analyze the prompt carefully and return valid JSON with keys: "intent", "confidence", "reasoning".
User Prompt: "{prompt}"
JSON Response:"""


class SmartIntentRouter:
    """
    Classifies user prompts and routes execution to RAG Document Agent, Web Search Agent, Coding Agent, or Direct LLM.
    """

    def __init__(self, classification_model: Optional[str] = None):
        self.model = classification_model or settings.DEFAULT_MODEL

    def classify_intent(self, prompt: str) -> IntentClassification:
        """
        Classifies user prompt intent into 'rag', 'toolcalling', 'coding', or 'direct'.
        Includes keyword heuristic fallback for instant latency optimization.
        """
        lower_prompt = prompt.lower()
        import re

        # Heuristic fast check for explicit document keywords
        doc_keywords = ["pdf", "resume", "uploaded", "document", "file content", "vector store", "chunk"]
        if any(k in lower_prompt for k in doc_keywords):
            return IntentClassification(
                intent="rag",
                confidence=0.95,
                reasoning="Prompt contains explicit document/PDF related keywords."
            )

        # Heuristic check for coding / programming tasks
        coding_patterns = [
            r"\bcode\b", r"\bpython\b", r"\bjavascript\b", r"\btypescript\b", r"\bc\+\+\b",
            r"\bjava\b", r"\bhtml\b", r"\bcss\b", r"\bsql\b", r"\bfunction\b", r"\bdebug\b",
            r"\brefactor\b", r"\balgorithmo?\b", r"\bscript\b", r"\bapi\b", r"\bclass\b",
            r"\breact\b", r"\bfastapi\b", r"\bdocker\b", r"\bjson\b", r"\bbug\b"
        ]
        if any(re.search(pat, lower_prompt) for pat in coding_patterns):
            return IntentClassification(
                intent="coding",
                confidence=0.95,
                reasoning="Prompt requests software engineering, code generation, debugging, or script writing."
            )

        # Heuristic check for real-time web search / scraping
        realtime_patterns = [
            r"\blatest\b", r"\brecent\b", r"\bresend\b", r"\bcurrent\b", r"\bnow\b",
            r"\btoday\b", r"\bthis week\b", r"\bthis month\b", r"\bheadlines\b",
            r"\bbreaking\b", r"\bscrape\b", r"\blive\b", r"\bnews\b", r"\bsearch\b",
            r"\bweather\b", r"\bforecast\b", r"\btemperature\b", r"\baqi\b",
            r"\bhumidity\b", r"\bclimate\b", r"\brain\b", r"\bwind\b",
            r"\bstock\b", r"\bprice\b", r"\bmarket\b", r"\bscore\b",
            r"\brealtime\b", r"\breal-time\b", r"\bupdates?\b", r"https?://",
            r"\btavily\b", r"\bscrapegraph\b"
        ]
        if any(re.search(pat, lower_prompt) for pat in realtime_patterns):
            return IntentClassification(
                intent="toolcalling",
                confidence=0.98,
                reasoning="Prompt requests real-time data, weather, latest info, recent updates, or web search/scraping."
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
