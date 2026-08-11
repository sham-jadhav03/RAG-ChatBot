from typing import List, Dict, Any
from pydantic import BaseModel

class ChatState(BaseModel):
    """State passed through LangGraph nodes"""

    # Input
    question: str
    session_id: str
    conversation_history: List[Dict[str, str]] = []

    retrieved_docs: List[Dict[str, Any]] = []

    context: str = "" 

    answer: str = ""

    # output 
    suggested_questions: List[str] = []
    sources: List[Dict[str, Any]] = []
    error: str = None