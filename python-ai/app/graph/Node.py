import logging
from typing import Dict, Any
from state import ChatState

from app.ingestion.embedder import get_embedder
from app.vector.chroma_client import get_vector_store
from config import config

logger = logging.getLogger(__name__)

async def retrieve_node(state: ChatState) -> ChatState:
     """
    Node 1: Retrieve relevant context from Chroma
    
    Takes question → generates embedding → searches Chroma → returns top chunks
    """
     try:
          logger.debug(f"Retrieve Node: {state.question[:50]}...")

          # Get embedder and vector store
          embedder = get_embedder()
          vectore_store = get_vector_store()

          # Generate embedding for question
          query_embedding = await embedder.embed_query(state.question)

          # Search Chroma for all documents (from session context)
          # Note: In a real app, you'd know which document to search
          # For now, we search all by trying document from session
          try:
               # Try to extract document ID from session or use generic search
               results = await vectore_store.search(
                    document_id=state.session_id,
                    query_embedding=query_embedding,
                    top_k=config.TOP_K_RETRIEVAL,
               )
          except:
               # If session ID not found in Chroma, log but continue
               logger.warning(f"No vectors found for session {state.session_id}")
               results = []
          
          # Format retrieved docs
          state.retrieved_docs = results

          # Format as context string for LLM
          context_parts = []
          for i, doc in enumerate(results, 1):
               text = doc.get("text", "")
               similarity = doc.get("similarity", 0)
               context_parts.append(f"[Source {i} (confidence: {similarity:.2%})]\n{text}")

               state.context = "\n\n".join(context_parts)

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

async def generate_node(state: ChatState) -> ChatState:
     """Node 2: Generate answer using LLM

     Takes context + question → calls OpenAI → returns answer
     """
     try:
          logger.debug(f"Generate Node: {state.question[:50]}...")

          from langchain_google_genai import ChatGoogleGenerativeAI

          # Initialize LLM
          llm = ChatGoogleGenerativeAI(
               model=config.LLM_MODEL,
               api_key=config.GEMINI_API_KEY,
               temperature=0.7,
          )

          # Build system prompt
          system_prompt = (
               "You are a helpful AI assistant that answers questions based on provided documents.\n\n"
               "Rules:\n"
               "1. Answer questions ONLY based on the provided context\n"
               "2. If context doesn't contain the answer, say \"I don't have information about that\"\n"
               "3. Cite your sources when possible\n"
               "4. Be concise but informative\n"
               "5. If the question is not related to the documents, politely decline"
          )

          # Format conversation history
          messages = []
          for msg in state.conversation_history:
               role = msg.get("role", "user")
               content = msg.get("content", "")
               if role == "user":
                    messages.append(("user", content))
               else:
                    messages.append(("assistant", content))
          # Build the current question with context
          if state.context:  
            user_message = f"""Context from documents:
                    {state.context}
                    Question: {state.question}
                    Please answer based on the context above."""
          else:
            user_message = f"""No relevant documents found. 
                    Question: {state.question}
                    Please let the user know you couldn't find relevant information."""
            messages = [] # dont use history id no context

          messages.append(("user", user_message))

          # Call LLM
          from langchain_core.messages import HumanMessage, SystemMessage

          formatted_messages = [SystemMessage(content=system_prompt)]
          for role, content in messages:
              if role == "user":
                  formatted_messages.append(HumanMessage(content=content))
              else:
                  from lanngchain_core.messages import AIMessage
                  formatted_messages.append(AIMessage(content=content))

          response = await llm.ainvoke(formatted_messages)
          state.answer = response.contennt

          logger.debug(f"Generated answer: {state.answer[:50]}...")

          return state 
          
     except Exception as e:
        logger.error(f"Generate node error: {e}", exc_info=True)
        state.error = f"Answer generation failed: {str(e)}"
        state.answer = "I encountered an error while generating a response. Please try again."
        return state

async def suggest_node(state: ChatState) -> ChatState:
    """
    Node 3: Generate suggested follow-up questions
    Takes answer + context → calls LLM → returns 3-5 suggestions
    """
    try:
        logger.debug("Suggest Node...")

        from langchain_google_genai import ChatGoogleGenerativeAI

        #Initilize LLM
        llm = ChatGoogleGenerativeAI(
            model=config.LLM_MODEL,
            api_key=config.GEMINI_API_KEY,
            temperature=0.7,
        )
        
        # Build prompt for suggestions
        suggestion_prompt = f"""Based on the following Q&A, suggest 3-5 follow-up questions that the user might ask.
            Question: {state.question}
            Answer: {state.answer[:500]}
            Format your response as a JSON array of strings:
            ["question 1", "question 2", "question 3"]
            Only return the JSON array, nothing else."""

        from langchain_core.messages import HumanMessage
        
        response = await llm.ainvoke([HumanMessage(content=suggestion_prompt)])
        
        # Parse response
        import json
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