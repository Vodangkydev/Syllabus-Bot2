"""
Cấu hình ChromaDB Cloud Connection
"""

from dotenv import load_dotenv
load_dotenv()

import os
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# ChromaDB Cloud Configuration
CHROMA_API_KEY = os.environ.get("CHROMA_API_KEY")
CHROMA_TENANT = os.environ.get("CHROMA_TENANT")
CHROMA_DATABASE = os.environ.get("CHROMA_DATABASE", "chroma_chatbot")
CHROMA_COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION_NAME", "langchain")

# Local fallback directory (optional, for development)
CHROMA_DB_DIRECTORY = "./chroma_db"
USE_CLOUD = os.environ.get("USE_CHROMA_CLOUD", "true").lower() == "true"

def get_chroma_client():
    """Tạo ChromaDB client kết nối với cloud"""
    if USE_CLOUD:
        # Validate required environment variables for cloud
        if not CHROMA_API_KEY:
            raise ValueError("CHROMA_API_KEY environment variable is required when using ChromaDB Cloud. Please set it in your .env file.")
        if not CHROMA_TENANT:
            raise ValueError("CHROMA_TENANT environment variable is required when using ChromaDB Cloud. Please set it in your .env file.")
        # ChromaDB cloud sử dụng CloudClient với API key, tenant và database
        client = chromadb.CloudClient(
            api_key=CHROMA_API_KEY,
            tenant=CHROMA_TENANT,
            database=CHROMA_DATABASE
        )
        return client
    else:
        # Fallback to local for development
        return chromadb.PersistentClient(path=CHROMA_DB_DIRECTORY)

def create_embeddings():
    """Khởi tạo model embedding"""
    return HuggingFaceEmbeddings(
        model_name="dangvantuan/vietnamese-embedding",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

def get_vectorstore(collection_name: str = None):
    """
    Tạo hoặc lấy vectorstore từ ChromaDB cloud
    
    Args:
        collection_name: Tên collection (mặc định dùng CHROMA_COLLECTION_NAME)
    
    Returns:
        Chroma vectorstore instance
    """
    embeddings = create_embeddings()
    collection = collection_name or CHROMA_COLLECTION_NAME
    
    if USE_CLOUD:
        try:
            client = get_chroma_client()
            vectorstore = Chroma(
                client=client,
                collection_name=collection,
                embedding_function=embeddings
            )
            return vectorstore
        except Exception as e:
            raise Exception(f"Không thể kết nối ChromaDB cloud: {str(e)}")
    else:
        # Local fallback
        if os.path.exists(CHROMA_DB_DIRECTORY):
            return Chroma(
                persist_directory=CHROMA_DB_DIRECTORY,
                embedding_function=embeddings,
                collection_name=collection
            )
        else:
            raise Exception("Chroma database directory not found")

