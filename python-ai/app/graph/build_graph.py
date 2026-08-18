import logging
from langgraph.graph import StateGraph
from .state import ChatState
from .Node import retrieve_node, generate_node, suggest_node

logger = logging.getLogger(__name__)


def build_rag_graph():
    """
    Build the RAG workflow graph
    Flow: input → retrieve → generate → suggest → output
    """
    try:
        logger.info("Building RAG graph...")

        # Create graph
        graph = StateGraph(ChatState)

        # Add nodes
        graph.add_node("retrieve", retrieve_node)
        graph.add_node("generate", generate_node)
        graph.add_node("suggest", suggest_node)

        # Add edges (sequential flow)
        graph.add_edge("retrieve", "generate")
        graph.add_edge("generate", "suggest")

        # Set entry and exit
        graph.set_entry_point("retrieve")
        graph.set_finish_point("suggest")

        # Compile
        compiled_graph = graph.compile()

        logger.info("Rag graph compiled successfully")
        return compiled_graph
    
    except Exception as e:
        logger.error(f"Error building graph: {e}", exc_info=True)
        raise


# Global graph instance
_graph = None


def get_rag_graph():
    """Get or create global compiled graph"""
    global _graph

    if _graph is None:
        _graph = build_rag_graph()

    return _graph


async def invoke_rag_graph(question: str, session_id: str, history: list, document_id: str = "") -> ChatState:
    """
    Run the RAG workflow
    Args:
        question: User question
        session_id: Session ID
        history: Conversation history    
        document_id: Document ID for vector collection search
    Returns:
        Final ChatState with answer + suggestions
    """

    try:
        graph = get_rag_graph()

        # Create initial state
        state = ChatState(
            question=question,
            session_id=session_id,
            document_id=document_id,
            conversation_history=history,
        )

        # Invoke graph
        logger.info(f"Invoking RAG graph for: {question[:50]}...")

        final_state = await graph.ainvoke(state)

        logger.info(f"Rag graph complete")
        return final_state

    except Exception as e:
        logger.error(f"Error invoking graph: {e}", exc_info=True)
        # Return error state
        return ChatState(
            question=question,
            session_id=session_id,
            document_id=document_id,
            answer="An error occurred processing your question",
            error=str(e),
        )
