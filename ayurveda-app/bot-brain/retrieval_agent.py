"""Knowledge Base Retrieval Engine using FAISS.

Supports semantic search over book chunks in vector_store.
"""
from typing import List, Dict, Any, Optional
import json
import os
import numpy as np
from pathlib import Path

try:
    import faiss
    from sentence_transformers import SentenceTransformer
except ImportError:
    faiss = None
    SentenceTransformer = None

BASE_DIR = Path(__file__).resolve().parent
VECTOR_STORE_DIR = BASE_DIR / "vector_store"
INDEX_PATH = VECTOR_STORE_DIR / "index.faiss"
METADATA_PATH = VECTOR_STORE_DIR / "metadata.json"

class VectorDBRetriever:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.index = None
        self.metadata = []
        self.model = None
        self.model_name = model_name
        
        if os.path.exists(INDEX_PATH) and os.path.exists(METADATA_PATH):
            try:
                self.index = faiss.read_index(str(INDEX_PATH))
                with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
                if SentenceTransformer:
                    self.model = SentenceTransformer(model_name)
                    print(f"Loaded Vector DB with {len(self.metadata)} chunks.")
            except Exception as e:
                print(f"Error loading Vector DB: {e}")
        else:
            print("Vector DB index or metadata not found. Run vector_db_builder.py first.")

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search the semantic index for matching paragraphs."""
        if not self.index or not self.model:
            return []

        # 1. Encode query
        query_embedding = self.model.encode([query]).astype('float32')
        # L2 normalize query
        norms = np.linalg.norm(query_embedding, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        query_embedding = query_embedding / norms

        # 2. Search FAISS index
        distances, indices = self.index.search(query_embedding, top_k)

        # 3. Format results
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            
            chunk = self.metadata[idx]
            results.append({
                "score": float(distances[0][i]),
                "text": chunk.get("text", ""),
                "source": chunk.get("source", "Unknown Book")
            })

        return results

# Singleton instance
retriever = VectorDBRetriever()

def get_semantic_context(query_list: List[str], top_k: int = 5) -> str:
    """Combines semantic search results from multiple queries/symptoms into a context string."""
    query = " ".join(query_list)
    results = retriever.search(query, top_k=top_k)
    
    if not results:
        return "No relevant information found in the available book database."

    context = "RELEVANT PASSAGES FROM BOOKS:\n"
    for r in results:
        context += f"Source: {r['source']}\nText: {r['text']}\n\n"
    
    return context
