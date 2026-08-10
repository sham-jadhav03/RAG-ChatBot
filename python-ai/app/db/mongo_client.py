import logging
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId

logger = logging.getLogger(__name__)


class MongoDBClient:
    """Manage MongoDB operations for documents"""

    def __init__(self, uri: str = None):
        """
        Initialize MongoDB client
        
        Args:
            uri: MongoDB connection URI
        """
        from pymongo import MongoClient
        from config import config
        
        self.uri = uri or config.MONGO_URI
        
        try:
            logger.info(f"🔧 Connecting to MongoDB...")
            
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            
            # Test connection
            self.client.admin.command("ping")
            
            # Get database and collection
            self.db = self.client.get_database()
            self.documents_collection = self.db.get_collection("documents")
            
            logger.info(f"MongoDB connected")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def update_processing_status(
        self,
        document_id: str,
        status: str,
        details: Dict[str, Any] = None,
    ) -> bool:
        """
        Update document processing status
        
        Args:
            document_id: MongoDB document ID
            status: Status value (completed, failed, processing)
            details: Additional details (chunks_count, error, etc.)
            
        Returns:
            True if updated successfully
        """
        try:
            # Convert to ObjectId if string
            if isinstance(document_id, str):
                doc_id = ObjectId(document_id)
            else:
                doc_id = document_id
            
            update_data = {
                "processingStatus": status,
                "updatedAt": datetime.utcnow(),
            }
            
            # Add details if provided
            if details:
                update_data.update(details)
            
            logger.info(f"Updating {doc_id}: {status}")
            
            result = self.documents_collection.update_one(
                {"_id": doc_id},
                {"$set": update_data},
            )
            
            if result.matched_count == 0:
                logger.warning(f"Document not found: {doc_id}")
                return False
            
            logger.info(f"Updated {doc_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating document: {e}", exc_info=True)
            return False

    async def mark_processing_complete(
        self,
        document_id: str,
        chunks_count: int,
        tokens_count: int,
    ) -> bool:
        """
        Mark document processing as complete
        
        Args:
            document_id: Document ID
            chunks_count: Number of chunks created
            tokens_count: Estimated token count
            
        Returns:
            True if successful
        """
        details = {
            "chunksCount": chunks_count,
            "tokensCount": tokens_count,
            "vectorizedAt": datetime.utcnow(),
        }
        
        return await self.update_processing_status(
            document_id=document_id,
            status="ready",  # After vectorization, ready for queries
            details=details,
        )

    async def mark_processing_failed(
        self,
        document_id: str,
        error: str,
    ) -> bool:
        """
        Mark document processing as failed
        
        Args:
            document_id: Document ID
            error: Error message
            
        Returns:
            True if successful
        """
        details = {
            "errorMessage": error,
            "failedAt": datetime.utcnow(),
        }
        
        return await self.update_processing_status(
            document_id=document_id,
            status="failed",
            details=details,
        )

    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Get document info from MongoDB
        
        Args:
            document_id: Document ID
            
        Returns:
            Document dict or None if not found
        """
        try:
            if isinstance(document_id, str):
                doc_id = ObjectId(document_id)
            else:
                doc_id = document_id
            
            document = self.documents_collection.find_one({"_id": doc_id})
            
            return document
            
        except Exception as e:
            logger.error(f"Error getting document: {e}")
            return None

    def close(self):
        """Close MongoDB connection"""
        try:
            self.client.close()
            logger.info("MongoDB connection closed")
        except Exception as e:
            logger.warning(f"Error closing MongoDB: {e}")


# Global instance
_mongo_client = None


def get_mongo_client(uri: str = None) -> MongoDBClient:
    """Get or create global MongoDBClient instance"""
    global _mongo_client
    
    if _mongo_client is None:
        _mongo_client = MongoDBClient(uri=uri)
    
    return _mongo_client