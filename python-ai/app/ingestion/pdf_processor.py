import asyncio
import logging
import os
from typing import List, Tuple
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

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

    async def load_pdf(self, file_path: str, original_filename: str = None) -> List[Document]:
        """
        Load PDF file and extract text

        Args:
            file_path: Path to PDF file (local path or remote URL)
            original_filename: Original filename to preserve in metadata

        Returns:
            List of Document objects with text content

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file is not a valid PDF
        """
        is_url = file_path.startswith("http://") or file_path.startswith("https://")
        temp_file_path = None
        loader_path = file_path

        try:
            if is_url:
                import tempfile
                import httpx
                logger.info(f"Downloading remote PDF from: {file_path}")
                async with httpx.AsyncClient() as client:
                    response = await client.get(file_path, follow_redirects=True, timeout=30.0)
                    response.raise_for_status()
                    content = response.content

                if not content.startswith(b"%PDF"):
                    raise ValueError("Downloaded file content does not start with PDF magic bytes (%PDF)")

                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                    temp_file.write(content)
                    temp_file_path = temp_file.name
                loader_path = temp_file_path
            else:
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

            # Load PDF (synchronous — run in thread to avoid blocking event loop)
            loader = PyPDFLoader(loader_path)
            documents = await asyncio.to_thread(loader.load)

            if not documents:
                raise ValueError(f"PDF has no content: {file_path}")

            logger.info(f"Loaded {len(documents)} pages from PDF")

            # Add metadata: original file path
            for doc in documents:
                doc.metadata["source_file"] = file_path
                doc.metadata["source_filename"] = original_filename or (Path(file_path).name if not is_url else "document.pdf")

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

        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.info(f"Deleted temp PDF file: {temp_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete temp PDF file {temp_file_path}: {e}")

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

            # split_documents is synchronous — run in thread
            chunks = await asyncio.to_thread(self.splitter.split_documents, documents)

            logger.info(f"Created {len(chunks)} chunks")

            # Add chunk metadata
            for i, chunk in enumerate(chunks):
                chunk.metadata["chunk_index"] = i
                chunk.metadata["chunk_size"] = len(chunk.page_content)

            return chunks

        except Exception as e:
            logger.error(f"Error chunking documents: {e}", exc_info=True)
            raise

    async def process_pdf(self, file_path: str, original_filename: str = None) -> Tuple[List[Document], int]:
        """
        Complete pipeline: load PDF and chunk text

        Args:
            file_path: Path to PDF file
            original_filename: Original filename to preserve in metadata

        Returns:
            Tuple of (chunks list, total token count estimate)
        """
        try:
            # Load pdf
            documents = await self.load_pdf(file_path, original_filename=original_filename)

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
