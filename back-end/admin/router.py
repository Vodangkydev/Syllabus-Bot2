from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
from firebase_admin import auth, firestore
from datetime import datetime
import os
from ingest import create_embeddings, load_documents, split_documents, create_vectorstore
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from chroma_config import get_vectorstore
import io
from pypdf import PdfReader
import json
from phantich import collect_user_questions, analyze_user_questions, visualize_top_questions
from collections import Counter
# matplotlib removed - not needed for production API
# import matplotlib.pyplot as plt
# import numpy as np

router = APIRouter()
security = HTTPBearer()

# Constants
CHROMA_DB_DIRECTORY = "./chroma_db"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# Pydantic models
class Feedback(BaseModel):
    user_email: str
    message: str

class FeedbackStatus(BaseModel):
    status: str

class AdminStatus(BaseModel):
    is_admin: bool

# Middleware to verify admin
async def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        
        if not decoded_token.get('admin', False):
            raise HTTPException(status_code=403, detail="Not authorized as admin")
            
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_admin_vectorstore():
    """Get or create vectorstore instance from ChromaDB cloud"""
    from chroma_config import get_vectorstore as get_cloud_vectorstore
    return get_cloud_vectorstore()

def clean_metadata(metadata: Dict[str, Any]) -> Dict[str, str]:
    """Clean and convert metadata to string values"""
    cleaned = {}
    for key, value in metadata.items():
        if key == '_type':
            continue
        try:
            if isinstance(value, (dict, list)):
                cleaned[key] = json.dumps(value)
            else:
                cleaned[key] = str(value)
        except Exception:
            cleaned[key] = str(value)
    return cleaned

def prepare_document_info(doc: Any, meta: Dict[str, Any], doc_id: Optional[str] = None) -> Dict[str, Any]:
    """Prepare document information for display"""
    try:
        source = meta.get("source", "")
        if source and not source.startswith('http') and not source.startswith('https') and os.path.exists(source):
            if source.startswith('data/'):
                source_url = f'/data/{os.path.basename(source)}'
            else:
                source_url = source
        else:
            source_url = source

        filename = os.path.basename(source_url)
        content = doc.page_content if hasattr(doc, 'page_content') else str(doc)
        cleaned_meta = clean_metadata(meta)
        
        return {
            "id": doc_id,
            "filename": filename,
            "content": content[:300] + ("..." if len(content) > 300 else ""),
            "source": source_url,
            "metadata": cleaned_meta
        }
    except Exception as e:
        logging.error(f"Error preparing document info: {str(e)}")
        return {
            "id": doc_id,
            "filename": "Unknown",
            "content": str(doc),
            "source": "Unknown",
            "metadata": {}
        }

@router.get("/users")
async def get_users(token: dict = Depends(verify_admin)):
    """Get list of users (admin only)"""
    try:
        users = auth.list_users()
        user_list = []
        for user in users.users:
            last_sign_in = None
            last_sign_in_timestamp = None
            if user.user_metadata and user.user_metadata.last_sign_in_timestamp:
                last_sign_in_timestamp = user.user_metadata.last_sign_in_timestamp
                last_sign_in = datetime.fromtimestamp(last_sign_in_timestamp / 1000)
                last_sign_in = last_sign_in.strftime("%d/%m/%Y %H:%M:%S")
            
            user_list.append({
                "uid": user.uid,
                "email": user.email,
                "displayName": user.display_name,
                "photoURL": user.photo_url,
                "isAdmin": user.custom_claims.get('admin', False) if user.custom_claims else False,
                "disabled": user.disabled,
                "lastSignInTime": last_sign_in,
                "lastSignInTimestamp": last_sign_in_timestamp
            })
        
        user_list.sort(key=lambda x: x["lastSignInTimestamp"] if x["lastSignInTimestamp"] else 0, reverse=True)
        return user_list
    except Exception as e:
        logging.error(f"Error getting users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/{uid}/admin")
async def set_admin(uid: str, admin_status: AdminStatus, token: dict = Depends(verify_admin)):
    """Update user admin status (admin only)"""
    try:
        auth.set_custom_user_claims(uid, {"admin": admin_status.is_admin})
        return {"status": "success", "message": "Admin status updated successfully"}
    except Exception as e:
        logging.error(f"Error setting admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{uid}")
async def delete_user(uid: str, token: dict = Depends(verify_admin)):
    """Delete user (admin only)"""
    try:
        auth.delete_user(uid)
        return {"status": "success", "message": "User deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
async def get_documents(token: dict = Depends(verify_admin)):
    """Get all documents from Chroma (admin only)"""
    try:
        vectorstore = get_admin_vectorstore()
        existing_docs = vectorstore.get()
        
        if not existing_docs:
            return {"documents": [], "total": 0}
            
        documents = existing_docs.get("documents", [])
        metadatas = existing_docs.get("metadatas", [])
        ids = existing_docs.get("ids", [])
        
        docs_info = []
        for doc, meta, doc_id in zip(documents, metadatas, ids):
            if meta and "source" in meta:
                doc_info = prepare_document_info(doc, meta, doc_id)
                docs_info.append(doc_info)
        
        return {
            "documents": docs_info,
            "total": len(documents)
        }
        
    except Exception as e:
        logging.error(f"Error in get_documents route: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_documents(q: str, token: dict = Depends(verify_admin)):
    """Search documents in Chroma (admin only)"""
    try:
        if not q:
            return {"documents": [], "total": 0}
            
        vectorstore = get_admin_vectorstore()
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        results = retriever.get_relevant_documents(q)
        
        docs_info = []
        for doc in results:
            doc_info = prepare_document_info(doc, doc.metadata)
            docs_info.append(doc_info)
        
        return {
            "documents": docs_info,
            "total": len(docs_info)
        }
    except Exception as e:
        logging.error(f"Error in search route: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete")
async def delete_document(source: str, token: dict = Depends(verify_admin)):
    """Delete a document from Chroma (admin only)"""
    try:
        if not source:
            raise HTTPException(status_code=400, detail="No source file specified")
            
        vectorstore = get_admin_vectorstore()
        vectorstore._collection.delete(where={"source": source})
        
        return {"status": "success", "message": "Document deleted successfully"}
        
    except Exception as e:
        logging.error(f"Error in delete route: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), token: dict = Depends(verify_admin)):
    """Upload a file to Chroma (admin only)"""
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} is too large ({file_size / (1024*1024):.2f} MB). Maximum size allowed is {MAX_FILE_SIZE / (1024*1024):.2f} MB."
            )
            
        filename = file.filename.split('\\')[-1].split('/')[-1]
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
        safe_filename = safe_filename.strip()
        
        if not safe_filename:
            safe_filename = filename
            
        logging.info(f"Processing file: {filename} (safe name: {safe_filename})")
        
        vectorstore = get_admin_vectorstore()
        existing_docs = vectorstore.get(where={"source": safe_filename})
        if existing_docs and len(existing_docs['ids']) > 0:
            raise HTTPException(
                status_code=400,
                detail=f"File {filename} already exists in the system"
            )
        
        text = None
        if filename.lower().endswith('.pdf'):
            try:
                content = await file.read()
                pdf_file = io.BytesIO(content)
                pdf_reader = PdfReader(pdf_file)
                
                if pdf_reader.is_encrypted:
                    raise HTTPException(
                        status_code=400,
                        detail=f"PDF file {filename} is encrypted. Please upload an unprotected PDF file."
                    )
                
                text = ""
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                
                if not text.strip():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot read content from PDF file {filename}. File may contain only images or no text."
                    )
            except Exception as e:
                logging.error(f"Error processing PDF file {filename}: {str(e)}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot process PDF file {filename}. Error: {str(e)}"
                )
        else:
            content = await file.read()
            encodings = ['utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'iso-8859-1']
            last_error = None
            
            for encoding in encodings:
                try:
                    text = content.decode(encoding)
                    if any(ord(c) > 127 for c in text[:1000]):
                        continue
                    break
                except UnicodeDecodeError as e:
                    last_error = e
                    continue
            
            if text is None:
                try:
                    text = content.hex()
                    text = f"[Binary file content in hex format]\n{text}"
                except Exception as e:
                    logging.error(f"Failed to process file {filename}: {str(e)}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot read file {filename}. File may be corrupted or not a text file."
                    )
        
        text = text.strip()
        if not text:
            raise HTTPException(
                status_code=400,
                detail=f"File {filename} is empty or contains no valid text content."
            )
        
        embeddings = create_embeddings()
        
        documents = [Document(
            page_content=text,
            metadata={"source": safe_filename}
        )]
        
        try:
            chunk_size = min(CHUNK_SIZE, 1000)
            chunk_overlap = min(CHUNK_OVERLAP, 100)
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                length_function=len,
                is_separator_regex=False,
                separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
            )
            
            text_parts = [text[i:i+50000] for i in range(0, len(text), 50000)]
            chunks = []
            
            for part in text_parts:
                part_chunks = text_splitter.split_text(part)
                for chunk in part_chunks:
                    if chunk.strip():
                        chunks.append(Document(
                            page_content=chunk.strip(),
                            metadata={"source": safe_filename}
                        ))
            
            chunks = [chunk for chunk in chunks if chunk.page_content.strip()]
                
        except Exception as e:
            logging.error(f"Error splitting text for file {filename}: {str(e)}")
            try:
                chunks = []
                for i in range(0, len(text), 1000):
                    chunk_text = text[i:i+1000].strip()
                    if chunk_text:
                        chunks.append(Document(
                            page_content=chunk_text,
                            metadata={"source": safe_filename}
                        ))
            except Exception as fallback_error:
                logging.error(f"Fallback chunking also failed: {str(fallback_error)}")
                chunks = [Document(page_content=text.strip(), metadata={"source": safe_filename})] if text.strip() else []
        
        if not chunks:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot split content of file {filename}. File may be empty or contain no valid text content."
            )
        
        try:
            logging.info(f"Attempting to add {len(chunks)} chunks to Chroma for file {safe_filename}")
            
            metadatas_list = []
            texts_list = []
            for i, chunk in enumerate(chunks):
                metadata = {
                    "source": safe_filename,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "chunk_size": len(chunk.page_content)
                }
                metadatas_list.append(metadata)
                texts_list.append(chunk.page_content)
            
            if not chunks or not metadatas_list:
                raise Exception("No data to add to Chroma")
                
            if len(chunks) != len(metadatas_list):
                logging.error(f"Mismatch between chunks ({len(chunks)}) and metadatas ({len(metadatas_list)}) length for file {safe_filename}")
                raise Exception("Internal error: Number of text chunks and metadata do not match.")
            
            vectorstore = get_admin_vectorstore()
            
            batch_size = 10
            for i in range(0, len(texts_list), batch_size):
                batch_texts = texts_list[i:i + batch_size]
                batch_metadatas = metadatas_list[i:i + batch_size]
                
                try:
                    vectorstore.add_texts(
                        texts=batch_texts,
                        metadatas=batch_metadatas
                    )
                    logging.info(f"Added batch {i//batch_size + 1} of {(len(chunks) + batch_size - 1)//batch_size} to Chroma")
                except Exception as batch_error:
                    logging.error(f"Error adding batch {i//batch_size + 1}: {str(batch_error)}")
                    try:
                        if "index out of range" in str(batch_error).lower():
                            logging.info("Attempting to recover by getting vectorstore...")
                            vectorstore = get_admin_vectorstore()
                            vectorstore.add_texts(
                                texts=batch_texts,
                                metadatas=batch_metadatas
                            )
                            logging.info("Successfully recovered and added batch")
                        else:
                            raise batch_error
                    except Exception as recovery_error:
                        logging.error(f"Recovery failed: {str(recovery_error)}")
                        continue
            
            logging.info(f"Successfully added all chunks to Chroma for file {safe_filename}")
        except Exception as e:
            logging.error(f"Error adding texts to Chroma for file {filename} (safe name: {safe_filename}): {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error saving file {filename} content to database: {str(e)}"
            )
        
        return {
            "status": "success",
            "message": f"File {filename} uploaded successfully",
            "chunks": len(chunks)
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error in upload route: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )

@router.post("/add_urls")
async def add_urls(urls: List[str] = Body(...), token: dict = Depends(verify_admin)):
    """Add new URLs to vectorstore"""
    try:
        if not urls:
            raise HTTPException(status_code=400, detail="URL list cannot be empty")
            
        embeddings = create_embeddings()
        documents = load_documents(urls)
        if not documents:
            raise HTTPException(status_code=400, detail="Cannot get content from provided URLs")
            
        chunks = split_documents(documents)
        if not chunks:
            raise HTTPException(status_code=400, detail="Cannot split content from URLs")
            
        vectorstore = create_vectorstore(chunks, embeddings)
        if not vectorstore:
            raise HTTPException(status_code=500, detail="Cannot create new vectorstore")
            
        return {"message": f"Successfully added {len(urls)} URLs"}
        
    except Exception as e:
        logging.error(f"Error adding URLs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedbacks")
async def get_feedbacks(token: dict = Depends(verify_admin)):
    """Get all feedbacks (admin only)"""
    try:
        db = firestore.client()
        feedbacks_ref = db.collection('feedbacks')
        feedbacks = feedbacks_ref.stream()
        
        feedback_list = []
        for feedback in feedbacks:
            feedback_data = feedback.to_dict()
            feedback_list.append({
                "id": feedback.id,
                "user_email": feedback_data.get("user_email", ""),
                "message": feedback_data.get("message", ""),
                "status": feedback_data.get("status", "pending"),
                "timestamp": feedback_data.get("timestamp", "")
            })
        
        return {"feedbacks": feedback_list}
    except Exception as e:
        logging.error(f"Error getting feedbacks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/feedbacks/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, status: FeedbackStatus, token: dict = Depends(verify_admin)):
    """Update feedback status (admin only)"""
    try:
        db = firestore.client()
        feedback_ref = db.collection('feedbacks').document(feedback_id)
        
        feedback_ref.update({
            "status": status.status,
            "updated_at": datetime.now().isoformat()
        })
        
        return {"status": "success", "message": "Feedback status updated successfully"}
    except Exception as e:
        logging.error(f"Error updating feedback status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/feedbacks/{feedback_id}")
async def delete_feedback(feedback_id: str, token: dict = Depends(verify_admin)):
    """Delete a feedback (admin only)"""
    try:
        db = firestore.client()
        feedback_ref = db.collection('feedbacks').document(feedback_id)
        
        # Check if feedback exists
        feedback_doc = feedback_ref.get()
        if not feedback_doc.exists:
            raise HTTPException(status_code=404, detail="Feedback not found")
            
        # Delete the feedback
        feedback_ref.delete()
        
        return {"status": "success", "message": "Feedback deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analysis")
async def get_analysis(token: dict = Depends(verify_admin)):
    """Get analysis of user questions and visualization"""
    try:
        # Collect questions once
        user_questions = collect_user_questions()
        
        if not user_questions:
            return {
                "status": "success",
                "top_questions": [],
                "visualization_url": None
            }
        
        # Get top questions with counts
        question_counter = Counter(user_questions)
        top_questions = question_counter.most_common(20)

        # Format the response
        formatted_questions = []
        for question, count in top_questions:
            formatted_questions.append({
                "question": str(question).strip(),
                "count": int(count)
            })
        
        # Visualization removed - matplotlib not needed for production API
        # Return data only without generating chart
        
        return {
            "status": "success",
            "top_questions": formatted_questions,
            "visualization_url": None  # Visualization disabled - matplotlib removed
        }
        
    except Exception as e:
        print(f"Error in analysis endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 