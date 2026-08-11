import asyncio
import logging
import json
from typing import Dict, Any

from app.graph.state import ChatState
from app.ingestion.embedder import get_embedder
from app.vector.chroma_client import get_vector_store
from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM singleton — initialized once, reused for every request
# ---------------------------------------------------------------------------
_llm = None


def get_llm():
    """Get or create a global ChatGoogleGenerativeAI instance."""
    global _llm
    if _llm is None:
        from langchain_google_genai import ChatGoogleGenerativeAI
        _llm = ChatGoogleGenerativeAI(
            model=config.LLM_MODEL,
            api_key=config.GEMINI_API_KEY,
            temperature=0.7,
        )
    return _llm


# ---------------------------------------------------------------------------
# Node 1 — Retrieve
# ---------------------------------------------------------------------------

async def retrieve_node(state: ChatState) -> ChatState:
    """
    Node 1: Retrieve relevant context from Chroma.

    Takes question → generates embedding → searches Chroma → returns top chunks.
    """
    try:
        logger.debug(f"Retrieve Node: {state.question[:50]}...")

        embedder = get_embedder()
        vector_store = get_vector_store()

        # Generate embedding for the question
        query_embedding = await embedder.embed_query(state.question)

        # Search Chroma using session_id as the collection name
        try:
            results = await vector_store.search(
                document_id=state.session_id,
                query_embedding=query_embedding,
                top_k=config.TOP_K_RETRIEVAL,
            )
        except Exception:
            logger.warning(f"No vectors found for session {state.session_id}")
            results = []

        state.retrieved_docs = results

        # Build context string AFTER the loop
        context_parts = []
        for i, doc in enumerate(results, 1):
            text = doc.get("text", "")
            similarity = doc.get("similarity", 0)
            context_parts.append(f"[Source {i} (confidence: {similarity:.2%})]\n{text}")

        state.context = "\n\n".join(context_parts)  # assigned once, outside loop

        state.sources = [
            {
                "documentName": f"doc_{doc.get('chunk_index', 0)}",
                "pageNumber": doc.get("page_number", None),
                "excerpt": doc.get("text", "")[:200],
                "similarity": doc.get("similarity", 0),
            }
            for doc in results
        ]

        logger.debug(f"Retrieved {len(results)} documents")
        return state

    except Exception as e:
        logger.error(f"Retrieve node error: {e}", exc_info=True)
        state.error = f"Retrieval failed: {str(e)}"
        return state


# ---------------------------------------------------------------------------
# Node 2 — Generate
# ---------------------------------------------------------------------------

async def generate_node(state: ChatState) -> ChatState:
    """
    Node 2: Generate answer using LLM.

    Takes context + question → calls Gemini → returns answer.
    """
    try:
        logger.debug(f"Generate Node: {state.question[:50]}...")

        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

        llm = get_llm()

        system_prompt = (
            "You are a helpful AI assistant that answers questions based on provided documents.\n\n"
            "Rules:\n"
            "1. Answer questions ONLY based on the provided context\n"
            "2. If context doesn't contain the answer, say \"I don't have information about that\"\n"
            "3. Cite your sources when possible\n"
            "4. Be concise but informative\n"
            "5. If the question is not related to the documents, politely decline"
        )

        # Build conversation history messages
        messages = []
        for msg in state.conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                messages.append(("user", content))
            else:
                messages.append(("assistant", content))

        # Build the current user message with context
        if state.context:
            user_message = (
                f"Context from documents:\n{state.context}\n\n"
                f"Question: {state.question}\n\n"
                f"Please answer based on the context above."
            )
        else:
            user_message = (
                f"No relevant documents found.\n\n"
                f"Question: {state.question}\n\n"
                f"Please let the user know you couldn't find relevant information."
            )
            messages = []  # Don't use history if no context

        messages.append(("user", user_message))

        # Format for LangChain
        formatted_messages = [SystemMessage(content=system_prompt)]
        for role, content in messages:
            if role == "user":
                formatted_messages.append(HumanMessage(content=content))
            else:
                formatted_messages.append(AIMessage(content=content))

        response = await llm.ainvoke(formatted_messages)
        state.answer = response.content  # fixed typo: contennt → content

        logger.debug(f"Generated answer: {state.answer[:50]}...")
        return state

    except Exception as e:
        logger.error(f"Generate node error: {e}", exc_info=True)
        state.error = f"Answer generation failed: {str(e)}"
        state.answer = "I encountered an error while generating a response. Please try again."
        return state


# ---------------------------------------------------------------------------
# Node 3 — Suggest
# ---------------------------------------------------------------------------

async def suggest_node(state: ChatState) -> ChatState:
    """
    Node 3: Generate suggested follow-up questions.

    Takes answer + context → calls LLM → returns 3-5 suggestions.
    """
    try:
        logger.debug("Suggest Node...")

        from langchain_core.messages import HumanMessage

        llm = get_llm()

        suggestion_prompt = (
            f"Based on the following Q&A, suggest 3-5 follow-up questions the user might ask.\n\n"
            f"Question: {state.question}\n"
            f"Answer: {state.answer[:500]}\n\n"
            f"Format your response as a JSON array of strings:\n"
            f'["question 1", "question 2", "question 3"]\n'
            f"Only return the JSON array, nothing else."
        )

        response = await llm.ainvoke([HumanMessage(content=suggestion_prompt)])

        try:
            suggestions = json.loads(response.content)
            if isinstance(suggestions, list):
                state.suggested_questions = suggestions[:5]  # Max 5
            else:
                state.suggested_questions = []
        except json.JSONDecodeError:
            logger.warning("Could not parse suggestions as JSON")
            state.suggested_questions = []

        logger.debug(f"Generated {len(state.suggested_questions)} suggestions")
        return state

    except Exception as e:
        logger.error(f"Suggest node error: {e}", exc_info=True)
        state.suggested_questions = []  # Graceful fallback
        return state