from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ChatState(BaseModel):
    """State passed through LangGraph nodes"""

    # Input
    question: str
    session_id: str
    document_id: str = ""
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)

    # Retrieval
    retrieved_docs: List[Dict[str, Any]] = Field(default_factory=list)
    context: str = ""

    # output 
    answer: str = ""
    suggested_questions: List[str] = Field(default_factory=list)
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None
