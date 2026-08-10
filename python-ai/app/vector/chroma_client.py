import logging
from typing import List, Dict, Any, Tuple
import chromadb
from chromadb.config import Settings
from langchain_core.documents import Document

from config import config

logger = logging.getLogger(__name__)

class ChromaVectorStore:
    """Manage Chroma vector database"""
 
    def __init__(self, path: str = None):
        """
        Initialize Chroma vector database
        
        Args:
            path: Path to persistent Chroma storage
        """

        self.path = path or config.CHROMA_PATH

        try:
            logger.info(f"Initializing Chroma at: {self.path}")

            # Create persistent Chroma client
            settings = Settings(
                chroma_db_impl = "duckdb+parquet",
                persist_directory=self.path,
                anonymized_telemetry=False,
            )

            self.client = chromadb.Client(settings)

            logger.info(f"Chroma initialized at: {self.path}")

        except Exception as e:
            logger.error(f"Failed to initialize chroma: {e}")
            raise

    def get_or_create_collection(
            self, 
            collection_name: str
            ) ->chromadb.api.Collection:
        """
        Get existing collection or create new one
        
        Args:
            collection_name: Name of collection (usually document ID)
            
        Returns:
            Chroma collection object
        """

        try:
            collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw: space": "cosine"}
            )

            logger.info(f"Collection ready: {collection_name}")
            
            return collection
            
        except Exception as e:
            logger.error(f"Error creating collection: {e}")
            raise

    async def store_embeddings(
            self,
            document_id: str,
            chunks: List[Document],
            embeddings: List[List[float]],
            ) -> Dict[str, Any]:
        """
        Store document chunks and embeddings in Chroma
        
        Args:
            document_id: MongoDB document ID
            chunks: List of text chunks
            embeddings: List of embedding vectors
            
        Returns:
            Dict with storage summary
        """

        if not chunks or not embeddings:
            raise ValueError("No chunks or embeddings provided")
        
        if len(chunks) != len(embeddings):
            raise ValueError(
                f"Chunk/embedding mismatch: {len(chunks)} chunks, {len(embeddings)} embeddings"
            )
        
        try:
            logger.info(
                f"💾 Storing {len(chunks)} embeddings for document {document_id}..."
            )
            
            # Get or create collection for this document
            collection = self.get_or_create_collection(document_id)
            
            # Prepare data for storage
            ids = [f"{document_id}_{i}" for i in range(len(chunks))]
            texts = [chunk.page_content for chunk in chunks]
            metadatas = [chunk.metadata for chunk in chunks]
            
            # Store in Chroma
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
            )
            
            # Verify storage
            count = collection.count()
            logger.info(f"✅ Stored {len(chunks)} vectors (collection total: {count})")
            
            return {
                "document_id": document_id,
                "chunks_stored": len(chunks),
                "collection_total": count,
                "status": "success",
            }
            
        except Exception as e:
            logger.error(f"❌ Error storing embeddings: {e}", exc_info=True)
            raise ValueError(f"Failed to store embeddings: {str(e)}")

    async def search(
        self,
        document_id: str,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar chunks in document
        
        Args:
            document_id: MongoDB document ID
            query_embedding: Query embedding vector
            top_k: Number of results to return
            
        Returns:
            List of similar chunks with metadata
        """
        try:
            logger.debug(f"Searching document {document_id} with top_k={top_k}...")
            
            collection = self.get_or_create_collection(document_id)
            
            # Search in Chroma
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )
            
            if not results or not results["documents"]:
                logger.debug(f"No results found for document {document_id}")
                return []
            
            # Format results
            formatted_results = []
            documents = results["documents"][0]  # First (only) query
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]
            
            for doc, metadata, distance in zip(documents, metadatas, distances):
                # Convert distance to similarity (cosine distance to similarity)
                # Cosine distance range: [0, 2], convert to similarity [0, 1]
                similarity = 1 - (distance / 2)
                
                formatted_results.append({
                    "text": doc,
                    "similarity": similarity,
                    "chunk_index": metadata.get("chunk_index", -1),
                    "page_number": metadata.get("page", None),
                    "metadata": metadata,
                })
            
            logger.debug(
                f"Found {len(formatted_results)} results "
                f"(similarity: {formatted_results[0]['similarity']:.3f} - "
                f"{formatted_results[-1]['similarity']:.3f})"
            )
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error searching vectors: {e}", exc_info=True)
            raise ValueError(f"Vector search failed: {str(e)}")
 
    async def delete_collection(self, document_id: str) -> bool:
        """
        Delete collection (when document is deleted)
        
        Args:
            document_id: Document ID
            
        Returns:
            True if deleted successfully
        """
        try:
            logger.info(f"Deleting collection: {document_id}")
            
            self.client.delete_collection(name=document_id)
            
            logger.info(f"Collection deleted: {document_id}")
            
            return True
            
        except Exception as e:
            logger.warning(f"Error deleting collection: {e}")
            # Don't raise here, just warn
            return False
 
    async def get_collection_stats(self, document_id: str) -> Dict[str, Any]:
        """
        Get statistics for a collection
        
        Args:
            document_id: Document ID
            
        Returns:
            Collection statistics
        """
        try:
            collection = self.get_or_create_collection(document_id)
            
            count = collection.count()
            
            return {
                "document_id": document_id,
                "total_chunks": count,
                "collection_name": collection.name,
            }
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {"error": str(e)}
 
 
# Global instance
_vector_store = None
 
 
def get_vector_store(path: str = None) -> ChromaVectorStore:
    """Get or create global ChromaVectorStore instance"""
    global _vector_store
    
    if _vector_store is None:
        _vector_store = ChromaVectorStore(path=path)
    
    return _vector_store