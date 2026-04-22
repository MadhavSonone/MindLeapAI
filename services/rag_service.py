import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import io
from pypdf import PdfReader

class RAGService:
    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.base_path = "data/vector_stores"
        os.makedirs(self.base_path, exist_ok=True)

    def _get_index_path(self, user_id: int):
        return os.path.join(self.base_path, f"user_{user_id}")

    def ingest_document(self, user_id: int, doc_id: int, file_name: str, file_content: bytes, doc_type: str = "notes"):
        """Extracts text from a document and adds it to the user's vector store."""
        print(f"RAG: Ingesting {doc_type} doc {doc_id} for user {user_id}...")
        
        text = ""
        if file_name.endswith('.pdf'):
            try:
                reader = PdfReader(io.BytesIO(file_content))
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            except Exception as e:
                print(f"RAG Error: Failed to parse PDF {file_name}: {e}")
                return
        else:
            # Assume text/markdown
            try:
                text = file_content.decode('utf-8')
            except:
                text = file_content.decode('latin-1', errors='ignore')

        if not text.strip():
            print(f"RAG: No text extracted from {file_name}")
            return

        # Chunking
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
        chunks = text_splitter.split_text(text)
        
        docs = [
            Document(
                page_content=chunk, 
                metadata={"user_id": user_id, "doc_id": doc_id, "file_name": file_name, "doc_type": doc_type}
            ) for chunk in chunks
        ]

        index_path = self._get_index_path(user_id)
        if os.path.exists(os.path.join(index_path, "index.faiss")):
            vectorstore = FAISS.load_local(index_path, self.embeddings, allow_dangerous_deserialization=True)
            vectorstore.add_documents(docs)
        else:
            vectorstore = FAISS.from_documents(docs, self.embeddings)
        
        vectorstore.save_local(index_path)
        print(f"RAG: Successfully indexed {len(chunks)} chunks for {file_name}")

    def query(self, user_id: int, query: str, k: int = 4):
        """Retrieves relevant context for a query."""
        index_path = self._get_index_path(user_id)
        if not os.path.exists(os.path.join(index_path, "index.faiss")):
            return ""

        vectorstore = FAISS.load_local(index_path, self.embeddings, allow_dangerous_deserialization=True)
        results = vectorstore.similarity_search(query, k=k)
        
        return "\n---\n".join([r.page_content for r in results])

rag_service = RAGService()
