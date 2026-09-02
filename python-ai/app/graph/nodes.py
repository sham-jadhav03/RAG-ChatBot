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
            thinking_level="low",
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

        # Search Chroma using document_id as collection name (fallback to session_id if empty)
        search_target = (
            state.document_id
            if state.document_id
            else state.session_id
        )

        try:
            results = await vector_store.search(
                document_id=search_target,
                query_embedding=query_embedding,
                top_k=config.TOP_K_RETRIEVAL,
            )
        except Exception:
            logger.warning(f"No vectors found for document/session {search_target}")
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
# Node 2 — Generate Answer + Suggestions
# ---------------------------------------------------------------------------

async def generate_node(state: ChatState) -> ChatState:
    """
    Generate the answer AND suggested follow-up questions
    using a SINGLE Gemini LLM call.
    """

    try:
        logger.debug(f"Generate Node: {state.question[:50]}...")

        from langchain_core.messages import (
            HumanMessage,
            SystemMessage,
            AIMessage,
        )

        llm = get_llm()

        # System prompt
        system_prompt = (
            "You are a helpful AI assistant that answers questions "
            "based on provided documents.\n\n"

            "Rules:\n"
            "1. Answer questions ONLY based on the provided context.\n"
            "2. If context doesn't contain the answer, say "
            "\"I don't have information about that\".\n"
            "3. Cite sources when possible.\n"
            "4. Be concise but informative.\n"
            "5. If the question is not related to the documents, "
            "politely decline.\n\n"

            "You must return ONLY valid JSON with this exact structure:\n"
            "{\n"
            '  "answer": "your answer here",\n'
            '  "suggested_questions": [\n'
            '    "follow-up question 1",\n'
            '    "follow-up question 2",\n'
            '    "follow-up question 3"\n'
            "  ]\n"
            "}\n\n"

            "The answer should be concise and useful. "
            "Generate 3 relevant follow-up questions."
        )

        # Conversation history
        messages = []

        for msg in state.conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "user":
                messages.append(("user", content))
            else:
                messages.append(("assistant", content))  

        # Current user message
        if state.context:
            user_message = (
                f"Context from documents:\n"
                f"{state.context}\n\n"
                f"Question: {state.question}\n\n"
                f"Please answer based only on the context above."
            )
        else:
            user_message = (
                "No relevant documents were found.\n\n"
                f"Question: {state.question}\n\n"
                "Please tell the user that you couldn't find "
                "relevant information."
            )

            # No point sending previous conversation when
            # there is no userful document context
            messages = []

        messages.append(("user", user_message))

        # Conver to LangChain messages

        formatted_messages = [
            SystemMessage(content=system_prompt)
        ]

        for role, content in messages:
            if role == "user":
                formatted_messages.append(
                    HumanMessage(content=content)
                )
            else:
                formatted_messages.append(
                    AIMessage(content=content)
                )

        # ONE Gemini call

        response = await llm.ainvoke(formatted_messages)

        # Normalize Gemini response content
        raw_content = response.content

        if isinstance(raw_content, str):
            content = raw_content.strip()

        elif isinstance(raw_content, list):
            text_parts = []

            for block in raw_content:
                # Gemini/LangChain content block as dict
                if isinstance(block, dict):
                    text = block.get("text", "") 

                    if isinstance(text, str):
                        text_parts.append(text)

                # Fallback for object-style content block
                elif hasattr(block, "text"):
                    text = getattr(block, "text", None)

                    if isinstance(text, str):
                        text_parts.append(text)

            content = "".join(text_parts).strip()              

        else:
            content = str(response.content).strip()

        # Parse JSON response

        try:
            content = content.strip()

            # Remove markdown code fences if Gemini return them
            if content.startswith("```"):
               lines = content.splitlines()

               # Remove opening ``` or ``` json
               if lines and lines[0].strip().startswith("```"):
                   lines = lines[1:]

               # Removing closing ```
               if lines and lines[-1].strip() == "```":
                   lines = lines[:-1]

               content = "\n".join(lines).strip()

            # Gemini may return:
            #
            # json
            # {
            #   "answer": "...",
            #   "suggested_questions": [...]
            # }
            #
            # Remove the leading "json"
            if content.lower().startswith("json"):
                content = content[4:].strip()            

            result = json.loads(content)

            # Extract answer
            answer = result.get("answer", "")

            # Extract suggestions
            suggestions = result.get(
                "suggested_questions",
                [],
            )

            # Validate answer
            if not isinstance(answer, str):
                answer = str(answer)

            # Validate suggestions
            if not isinstance(suggestions, list):
                suggestions = []

            suggestions = [
                str(question)
                for question in suggestions[:5]
                if question
            ]

            state.answer = answer.strip()
            state.suggested_questions = suggestions

        except (json.JSONDecodeError, AttributeError, TypeError) as parse_error:
            # Graceful fallback.
            # 
            # If Gemini doesn't return valid JSON, don't fail the
            # complete chat request.
            logger.warning(
                f"Could not parse combined LLM response as JSON: "
                f"{parse_error}"
            )

            state.answer = content
            state.suggested_questions = []

        logger.debug(
            f"Generated answer + "
            f"{len(state.suggested_questions)} suggestions"
        )

        return state

    except Exception as e:
        logger.error(
            f"Generate node error: {e}",
            exc_info=True,
        )

        state.error = f"Answer generation failed: {str(e)}"

        state.answer = (
            "I encountered an error while generating a response. "
            "Please try again."
        )

        state.suggested_questions = []

        return state 
                                                             