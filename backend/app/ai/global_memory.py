import logging
from typing import List, Optional
from app.db import get_db

logger = logging.getLogger("app.ai.global_memory")


def get_global_conversational_context(
    user_id: Optional[str] = None,
    exclude_conv_id: Optional[str] = None,
    query: Optional[str] = None,
    max_past_chats: int = 2,
) -> str:
    """
    Retrieves concise global memory context across past conversation sessions in MongoDB,
    strictly scoped to the specified user_id. Never leaks other users' conversations.
    """
    if not user_id:
        return ""

    try:
        db = get_db()
        if db is None:
            return ""

        collection = db["conversations"]
        query_filter = {"user_id": user_id}
        if exclude_conv_id:
            query_filter["id"] = {"$ne": exclude_conv_id}

        # Fetch recent past conversations sorted by update time (project only necessary fields for minimal latency)
        cursor = collection.find(query_filter, {"_id": 0, "title": 1, "messages": 1}).sort("updated_at", -1).limit(max_past_chats)
        past_chats = list(cursor)

        if not past_chats:
            return ""

        memory_snippets = []
        for idx, chat in enumerate(past_chats, 1):
            title = chat.get("title", "Untitled Chat")
            messages = chat.get("messages", [])

            # Extract recent message turns from past conversation (up to last 3 turns)
            recent_turns = []
            for msg in messages[-3:]:
                role = "User" if msg.get("role") == "user" else "AI"
                content = (msg.get("content") or "").strip()

                # Truncate text to 120 characters for minimal token overhead
                if len(content) > 120:
                    content = content[:120] + "..."
                if content:
                    recent_turns.append(f"  - {role}: {content}")

            if recent_turns:
                chat_summary = f"• [Past Chat #{idx}: \"{title}\"]\n" + "\n".join(recent_turns)
                memory_snippets.append(chat_summary)

        if not memory_snippets:
            return ""

        global_context_header = (
            "\n\n=== GLOBAL CONVERSATIONAL MEMORY (CROSS-CHAT HISTORY) ===\n"
            "Below is memory context from the user's PREVIOUS conversation sessions in this application. "
            "If the user asks questions that relate to, refer to, or ask about earlier discussions or past chats, "
            "use this global memory context to relate and answer accurately:\n\n"
        )
        return global_context_header + "\n\n".join(memory_snippets) + "\n===========================================================\n"

    except Exception as e:
        logger.warning(f"Failed to retrieve global conversational memory: {e}")
        return ""
