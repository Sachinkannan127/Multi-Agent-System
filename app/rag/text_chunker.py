import hashlib
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TextChunk(BaseModel):
    chunk_id: str = Field(..., description="Unique hash ID for this chunk")
    chunk_index: int = Field(..., description="0-indexed position of chunk in document")
    text: str = Field(..., description="Chunk text content")
    char_count: int = Field(..., description="Character count of chunk")
    start_char: int = Field(..., description="Start character index in full document text")
    end_char: int = Field(..., description="End character index in full document text")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata (filename, source, page, etc.)")


class RecursiveCharacterTextSplitter:
    """
    RAG Stage 2: Recursive Character Text Splitter
    Recursively splits document text using hierarchical separators (paragraphs -> lines -> sentences -> words -> chars)
    and combines them into chunks of target size with configurable overlap.
    """

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        separators: Optional[List[str]] = None,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", "! ", "? ", " ", ""]

    def _generate_chunk_id(self, text: str, index: int, source: str) -> str:
        raw_key = f"{source}:{index}:{text[:50]}"
        return hashlib.md5(raw_key.encode("utf-8")).hexdigest()[:16]

    def _split_text_recursively(self, text: str, separators: List[str]) -> List[str]:
        """
        Recursively splits text using the first available separator in the separator list.
        """
        final_chunks: List[str] = []
        if not text:
            return final_chunks

        # Find the first separator present in the text
        separator = ""
        new_separators = []
        for i, _s in enumerate(separators):
            if _s == "" or _s in text:
                separator = _s
                new_separators = separators[i + 1 :]
                break

        # Split using the separator
        if separator:
            splits = text.split(separator)
        else:
            splits = list(text)

        # Process each split recursively if it exceeds chunk_size
        good_splits: List[str] = []
        for s in splits:
            if not s:
                continue
            if len(s) <= self.chunk_size:
                good_splits.append(s)
            else:
                if good_splits:
                    merged = self._merge_splits(good_splits, separator)
                    final_chunks.extend(merged)
                    good_splits = []
                if new_separators:
                    sub_chunks = self._split_text_recursively(s, new_separators)
                    final_chunks.extend(sub_chunks)
                else:
                    # Hard character slicing fallback
                    for start in range(0, len(s), self.chunk_size):
                        final_chunks.append(s[start : start + self.chunk_size])

        if good_splits:
            merged = self._merge_splits(good_splits, separator)
            final_chunks.extend(merged)

        return final_chunks

    def _merge_splits(self, splits: List[str], separator: str) -> List[str]:
        """
        Merges small split pieces up to self.chunk_size while maintaining self.chunk_overlap.
        """
        docs: List[str] = []
        current_doc: List[str] = []
        total_len = 0
        sep_len = len(separator)

        for d in splits:
            len_d = len(d)
            if total_len + len_d + (sep_len if current_doc else 0) > self.chunk_size:
                if total_len > 0:
                    merged_str = separator.join(current_doc).strip()
                    if merged_str:
                        docs.append(merged_str)

                    # Handle overlap by keeping tail elements
                    while total_len > self.chunk_overlap and current_doc:
                        removed = current_doc.pop(0)
                        total_len -= len(removed) + (sep_len if current_doc else 0)

            current_doc.append(d)
            total_len += len_d + (sep_len if len(current_doc) > 1 else 0)

        if current_doc:
            merged_str = separator.join(current_doc).strip()
            if merged_str:
                docs.append(merged_str)

        return docs

    def split_text(
        self, text: str, source_name: str = "doc", base_metadata: Optional[Dict[str, Any]] = None
    ) -> List[TextChunk]:
        """
        Splits text into TextChunk objects using the recursive character splitting algorithm.
        """
        if not text:
            return []

        base_meta = base_metadata or {}
        raw_text_chunks = self._split_text_recursively(text, self.separators)

        chunks: List[TextChunk] = []
        chunk_index = 0
        current_pos = 0

        for chunk_text in raw_text_chunks:
            chunk_text_clean = chunk_text.strip()
            if not chunk_text_clean:
                continue

            # Find approximate char offsets in original text
            start_char = text.find(chunk_text_clean, current_pos)
            if start_char == -1:
                start_char = current_pos
            end_char = start_char + len(chunk_text_clean)
            current_pos = max(current_pos, start_char + 1)

            chunk_id = self._generate_chunk_id(chunk_text_clean, chunk_index, source_name)
            meta = {**base_meta, "source": source_name, "chunk_index": chunk_index}

            chunks.append(
                TextChunk(
                    chunk_id=chunk_id,
                    chunk_index=chunk_index,
                    text=chunk_text_clean,
                    char_count=len(chunk_text_clean),
                    start_char=start_char,
                    end_char=end_char,
                    metadata=meta,
                )
            )
            chunk_index += 1

        return chunks


# Alias for backward compatibility
TextChunker = RecursiveCharacterTextSplitter
