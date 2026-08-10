import logging
import os
from typing import List, Tuple
from pathlib import Path

from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

logger = logging.getLogger(__name__)

class PDFProcessor:
    """Load PDF files and split into chunks"""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize PDF processor with chunking parameters

        Args:
            chunk_size: Number of characters per chunk
            chunk_overlap: Number of overlapping characters between chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Initialize text splitter
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
            length_function=len,
        )

        logger.info(
            f"PDFProcessor initialized: chunk_size={chunk_size}, overlap={chunk_overlap}"
        )

    async def load_pdf(self, file_path: str) -> List[Document]:
        """
        Load PDF file and extract text

        Args:
            file_path: Path to PDF file

        Returns:
            List of Document objects with text content

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file is not a valid PDF
        """
        try:
            # Check file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"PDF file not found: {file_path}")

            # Check file is readable
            if not os.access(file_path, os.R_OK):
                raise PermissionError(f"Cannot read PDF file: {file_path}")

            # Get file size
            file_size = os.path.getsize(file_path)
            logger.info(
                f"Loading PDF: {file_path} ({file_size / 1024 / 1024:.2f} MB)"
            )

            # Load pdf
            loader = PyPDFLoader(file_path)
            documents = loader.load()

            if not documents:
                raise ValueError(f"PDF has no content: {file_path}")

            logger.info(f"Loaded {len(documents)} pages from PDF")

            # Add metadata: original file path
            for doc in documents:
                doc.metadata["source_file"] = file_path
                doc.metadata["source_filename"] = Path(file_path).name

            return documents

        except FileNotFoundError as e:
            logger.error(f"File not found: {e}")
            raise
        except PermissionError as e:
            logger.error(f"Permission denied: {e}")
            raise
        except ValueError as e:
            logger.error(f"Invalid PDF: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading PDF: {e}", exc_info=True)
            raise ValueError(f"Failed to load PDF: {str(e)}")

    async def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """
        Split documents into chunks

        Args:
            documents: List of Document objects

        Returns:
            List of chunked Document objects
        """
        try:
            logger.info(f"Chunking {len(documents)} documents...")

            chunks = self.splitter.split_documents(documents)

            logger.info(f"Created {len(chunks)} chunks")

            # Add chunk metadata
            for i, chunk in enumerate(chunks):
                chunk.metadata["chunk_index"] = i
                chunk.metadata["chunk_size"] = len(chunk.page_content)

            return chunks

        except Exception as e:
            logger.error(f"Error chunking documents: {e}", exc_info=True)
            raise

    async def process_pdf(self, file_path: str) -> Tuple[List[Document], int]:
        """
        Complete pipeline: load PDF and chunk text

        Args:
            file_path: Path to PDF file

        Returns:
            Tuple of (chunks list, total token count estimate)
        """
        try:
            # Load pdf
            documents = await self.load_pdf(file_path)

            # Chunk documents
            chunks = await self.chunk_documents(documents)

            # Estimate total token (rough: 1 token = 4 characters)
            total_chars = sum(len(chunk.page_content) for chunk in chunks)
            estimated_tokens = total_chars // 4

            logger.info(
                f"PDF processing complete: {len(chunks)} chunks, ~{estimated_tokens} tokens"
            )

            return chunks, estimated_tokens

        except Exception as e:
            logger.error(f"PDF processing failed: {e}", exc_info=True)
            raise

# Global instance
_processor = None

def get_processor(chunk_size: int = 1000, chunk_overlap: int = 200) -> PDFProcessor:
    """Get or create global PDFProcessor instance"""
    global _processor

    if _processor is None:
        _processor = PDFProcessor(chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    return _processor
