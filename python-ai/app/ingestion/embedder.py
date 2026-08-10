import logging
from typing import List, Tuple
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.documents import Document

from config import config

logger = logging.getLogger(__name__)

class EmbeddingGenerator:
    """Generate embeddings for document chunks"""
 
    def __init__(self, model: str = None):
        """
        Initialize embedding generator
        
        Args:
            model: OpenAI embedding model name
        """
        self.model = model or config.EMBEDDING_MODEL

        try:
            logger.info(f"Initializing embeddings with model: {self.model}")

            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=self.model,
                api_key=config.GOOGLE_API_KEY,
                output_dimensionality=768,
            ) 

            logger.info(f"Embeddings initialized: {self.model}")
            
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            raise

    async def embed_documents(self, chunks: List[Document]) -> Tuple[List[List[float]], List[Document]]:
        """
        Generate embeddings for document chunks
        
        Args:
            chunks: List of Document chunks
            
        Returns:
            Tuple of (embeddings list, chunks list with metadata)
            
        Raises:
            ValueError: If embedding fails
        """
        if not chunks:
            raise ValueError("No chunks provided for embedding")

        try:
            logger.info(f"Generating embeddings for {len(chunks)} chunks...")

            # Extract text from chunks
            texts = [
                f"title: {chunk.metadata.get('source_filename', 'non')} | "
                f"text:{chunk.page_content}"
                for chunk in chunks
            ]

            # Generate embeddings
            # Note: GOOGLE GEMINI Embedding are blocking, we call them directly
            embeddings = await self.embeddings.embed_documents(texts)

            if not embeddings:
                raise ValueError("No embedding generated")

            if len(embeddings) != len(chunks):
                raise ValueError(
                    f"Embedding count mismatch: "
                    f"expected {len(chunks)}, got {len(embeddings)}"
                )

            logger.info(
                f"Generated {len(embeddings)} embeddings "
                f"(dimension: {len(embeddings[0])})"
            )

            # Add embedding metadata to chunks
            for chunk, embedding in zip(chunks, embeddings):
                chunk.metadata["embedding_model"] = self.model
                chunk.metadata["embedding_dimension"] = len(embedding)

            return embeddings, chunks

        except Exception as e:
            logger.error(f"Error generating embeddings: {e}", exc_info=True)
            raise ValueError(f"Embedding generation failed: {str(e)}")

    async def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for a single query text
        
        Args:
            query: Text query to embed
            
        Returns:
            Embedding vector
        """
        try:
            if not query or not query.strip():
                raise ValueError("Query text is empty")
            
            logger.debug(f"🔍 Embedding query: {query[:50]}...")

            embedding = self.embeddings.embed_query(query)

            logger.debug(f"✅ Query embedded (dimension: {len(embedding)})")
            
            return embedding
            
        except Exception as e:
            logger.error(f"❌ Error embedding query: {e}", exc_info=True)
            raise ValueError(f"Query embedding failed: {str(e)}")
 
 
# Global instance
_embedder = None
 
 
def get_embedder(model: str = None) -> EmbeddingGenerator:
    """Get or create global EmbeddingGenerator instance"""
    global _embedder
    
    if _embedder is None:
        _embedder = EmbeddingGenerator(model=model)
    
    return _embedder