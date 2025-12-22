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
import asyncio
from chatbot.hf_llm import HuggingFaceLLM
from database import save_chat, get_chat_history, archive_chat, unarchive_chat, get_archived_chats
from phantich import collect_user_questions, analyze_user_questions, visualize_top_questions
from langchain.prompts import PromptTemplate
from fastapi.responses import StreamingResponse
import random
from collections import Counter
# matplotlib removed - not needed for production API
# import matplotlib.pyplot as plt
import re

router = APIRouter()
security = HTTPBearer()

# Constants (kept for backward compatibility, but using cloud now)
CHROMA_DB_DIRECTORY = "./chroma_db"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# Prompt template
SYLLABUS_PROMPT = """
Hướng dẫn sử dụng Syllasbus-Bot


Bạn là Syllasbus-Bot - trợ lý AI chuyên nghiệp tra cứu thông tin môn học khoa Công nghệ thông tin trường Đại học Văn Lang.

Hướng dẫn trả lời:
1. Tra cứu đề cương
Bạn có thể đặt câu hỏi để xem đề cương chi tiết của một môn học bất kỳ.
Chỉ hiển thị ví dụ, không trả lời nội dung cụ thể:
- "Cho mình xem đề cương môn Lập trình Python nâng cao"
- "Đề cương môn 71ITSE31003 gồm những gì?"

2. Điểm số & Đánh giá
Bạn có thể hỏi về cách tính điểm, tiêu chí đánh giá hoặc điều kiện qua môn.
Chỉ hiển thị ví dụ, không trả lời nội dung cụ thể:
- "Điểm số và đánh giá môn Cơ sở dữ liệu như thế nào?"
- "Môn này cần đạt bao nhiêu điểm để qua?"

3. Tài liệu tham khảo
Bạn có thể hỏi về các sách, giáo trình hoặc tài liệu môn học.
Chỉ hiển thị ví dụ, không trả lời nội dung cụ thể:
- "Môn Nhập môn trí tuệ nhân tạo dùng tài liệu gì?"
- "Có giáo trình nào cho môn Cấu trúc dữ liệu không?"

1. Nếu câu hỏi liên quan đến thông tin trước đó, hãy tham chiếu và mở rộng thông tin đó, dựa vào môn học mở rộng câu hỏi ra
2. Nếu người dùng muốn biết thêm thông tin, hãy cung cấp thông tin bổ sung liên quan với môn học hỏi trước đó
3. Tránh lặp lại thông tin đã rõ ràng trong lịch sử hội thoại trừ khi cần thiết để làm rõ câu trả lời
4. Luôn giữ giọng điệu tự nhiên và thân thiện
5. Nếu người dùng hỏi về cách tính điểm môn học bao nhiêu điểm để qua môn hãy trả lời theo thang điểm 10 (ví dụ: 8/10, 5.5/10, ...), không sử dụng thang điểm chữ (A, B, C, D, F) hoặc thang điểm 4.

Hướng dẫn xử lý ngữ cảnh:
- Nếu người dùng chỉ nói một từ hoặc cụm từ ngắn (như "mục tiêu", "nội dung", "tài liệu tham khảo", "phương thức đánh giá", "số tín chỉ", "giáo trình", "chuẩn đầu ra", "nhiệm vụ sinh viên", "rubric", "đánh giá", "cho điểm"), hãy mở rộng thông tin trước đó để trả lời, dựa vào môn học.
- Ví dụ: Nếu trước đó đã nói về "môn học x" và bây giờ người dùng chỉ nói "tài liệu tham khảo", hãy trả lời về tài liệu tham khảo của môn học x, tương tự với các câu hỏi kháckhác
- Luôn xem xét ngữ cảnh từ lịch sử hội thoại để hiểu người dùng đang hỏi về môn học nào.

Hướng dẫn xác nhận loại môn học:
- Nếu người dùng hỏi hoặc nhắc đến "bắt buộc" hoặc "tự chọn", hãy xác nhận rõ môn học mà người dùng đang đề cập (nếu chưa rõ, hãy hỏi lại tên môn học).
- Nếu người dùng hỏi "môn này là tự chọn hay bắt buộc?", hãy trả lời rõ ràng: "Môn [Tên môn học] là môn bắt buộc/tự chọn."
- Nếu người dùng chỉ nhắn "tự chọn" hoặc "bắt buộc", hãy hỏi lại: "Bạn muốn tìm hiểu về môn học nào? Vui lòng xác nhận tên môn học hoặc chọn từ danh sách các môn học bắt buộc/tự chọn sau đây."
- Sau khi xác nhận, nếu là môn tự chọn, hãy gợi ý thêm một số môn tự chọn khác hoặc các môn học tương tự. Nếu là môn bắt buộc, hãy gợi ý thêm các môn bắt buộc khác hoặc các môn học liên quan.
- Luôn giữ giọng điệu thân thiện, chủ động gợi ý thêm thông tin nếu phù hợp.

Cấu trúc thông tin môn học cần cung cấp (nếu có):
- Thông tin về học phần (mã môn, tên môn, số tín chỉ)
- Mục tiêu và chuẩn đầu ra của học phần
- Mô tả vắn tắt nội dung học phần
- Phương pháp giảng dạy và học tập
- Nhiệm vụ của sinh viên
- Đánh giá và cho điểm
- Giáo trình và tài liệu học tập
- Nội dung chi tiết của học phần
- Yêu cầu của giảng viên đối với học phần
- Thông tin biên soạn và cập nhật
- Rubric đánh giá

Hướng dẫn kết thúc câu trả lời:
Sau khi trả lời xong, luôn kết thúc bằng câu: "Bạn có muốn biết thêm thông tin về mục tiêu, nội dung, tài liệu tham khảo, phương thức đánh giá, nhiệm vụ sinh viên, số tín chỉ môn học hoặc các vấn đề khác liên quan đến môn học này hoặc các môn học khác tại Khoa Công nghệ Thông Tin trường đại học Văn Lang không? Hãy nói cho tôi biết nhé!"

Lịch sử hội thoại:
{chat_history}

Thông tin từ tài liệu syllabus:
{context}

Câu hỏi mới nhất của người dùng: {question}

Trả lời:"""

# Các từ khóa đặc biệt để nhận diện câu hỏi ngắn gọn về thông tin môn học
SPECIAL_KEYWORDS = [
    "mục tiêu", "nội dung", "tài liệu tham khảo", "phương thức đánh giá", "số tín chỉ",
    "giáo trình", "chuẩn đầu ra", "nhiệm vụ sinh viên", "rubric", "đánh giá", "cho điểm",
    "thông tin về học phần", "mô tả", "phương pháp giảng dạy", "nội dung chi tiết",
    "yêu cầu", "biên soạn", "phụ lục", "rubric đánh giá"
]

def get_chatbot_vectorstore():
    """Get or create vectorstore instance from ChromaDB cloud"""
    from chroma_config import get_vectorstore as get_cloud_vectorstore
    return get_cloud_vectorstore()

# Initialize LLM (lazy loading)
hf_llm = None

def get_hf_llm():
    """Get or create Hugging Face LLM instance"""
    global hf_llm
    if hf_llm is None:
        hf_token = os.environ.get('HF_TOKEN')
        if not hf_token:
            raise ValueError("HF_TOKEN environment variable is required. Please set it in your .env file.")
        hf_llm = HuggingFaceLLM(
            model="AITeamVN/GRPO-VI-Qwen2-7B-RAG:featherless-ai",
            api_token=hf_token,
            timeout=30,
            temperature=0.01
        )
    return hf_llm

# Vectorstore sẽ được load khi cần (lazy loading từ cloud)
vectorstore = None

# Load greetings
def load_greetings():
    """Load greeting keywords and messages from JSON file"""
    try:
        with open("data/greetings.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("greeting_keywords", []), data.get("greeting_messages", [])
    except Exception as e:
        logging.error(f"Error loading greetings: {str(e)}")
        return [], []

greeting_keywords, greeting_messages = load_greetings()

# Load danh sách môn tự chọn
try:
    with open("data/mon_tu_chon.json", "r", encoding="utf-8") as f:
        mon_tu_chon_data = json.load(f)
        # Lấy danh sách môn tự chọn từ greeting_messages hoặc tạo trường riêng nếu cần
        mon_tu_chon_list = mon_tu_chon_data.get("greeting_messages", [])
except Exception as e:
    logging.error(f"Error loading mon_tu_chon: {str(e)}")
    mon_tu_chon_list = []

def is_greeting(message: str) -> bool:
    """Check if message is a greeting"""
    return message.lower().strip() in greeting_keywords

def get_greeting_response() -> str:
    """Get random greeting message"""
    return random.choice(greeting_messages) if greeting_messages else "Xin chào! Tôi là Syllasbus-Bot. Tôi có thể giúp gì cho bạn?"

async def stream_greeting(greeting: str):
    """Stream greeting message with natural typing effect"""
    words = greeting.split()
    for word in words:
        # Type each word with faster speed
        for char in word:
            yield f"data: {json.dumps({'type': 'chunk', 'text': char})}\n\n"
            await asyncio.sleep(0.001)  # Reduced from 0.005 to 0.001
        # Add space after word
        yield f"data: {json.dumps({'type': 'chunk', 'text': ' '})}\n\n"
        # Shorter pause between words
        await asyncio.sleep(0.002)  # Reduced from 0.01 to 0.002
    yield f"data: {json.dumps({'type': 'complete'})}\n\n"

def extract_last_subject(chat_history):
    """Trích xuất tên hoặc mã môn học gần nhất từ lịch sử hội thoại, ưu tiên message gần nhất của user."""
    if not chat_history:
        return None
    # Danh sách các môn đặc biệt
    special_subjects = [
        "cờ vua", "bóng rổ", "bóng bàn", "bóng chuyền", "bơi lội", "cầu lông", "võ thuật", "golf", "tennis", "futsal", "leo núi", "khiêu vũ", "fitness", "hatha yoga"
    ]
    # Regex nhận diện mã môn học (ví dụ: 71ITSE31003)
    subject_code_pattern = re.compile(r"\b\d{2}[A-Z]{2,}[A-Z0-9]*\d{3,}\b", re.IGNORECASE)
    # Regex nhận diện tên môn học sau từ 'môn'
    subject_name_pattern = re.compile(r"môn ([\w\sÀ-ỹ\-]+)", re.IGNORECASE)

    # Duyệt từ message gần nhất của user
    for chat_turn in reversed(chat_history):
        for msg in reversed(chat_turn.get('messages', [])):
            if msg.get('role') != 'user':
                continue
            content = msg.get('content', '').strip().lower()
            # Nếu content chỉ là từ khóa ngắn thì bỏ qua
            if content in SPECIAL_KEYWORDS:
                continue
            # Ưu tiên tìm mã môn học
            code_match = subject_code_pattern.search(content)
            if code_match:
                return code_match.group(0)
            # Tìm tên môn học sau từ 'môn'
            name_match = subject_name_pattern.search(content)
            if name_match:
                subject = name_match.group(1).strip()
                if subject and not any(kw in subject.lower() for kw in SPECIAL_KEYWORDS):
                    subject = subject.split(".")[0].strip()
                    return subject
            # Tìm các môn đặc biệt (không cần từ 'môn')
            for s in special_subjects:
                if s in content:
                    return s.capitalize()
            # Nếu message chỉ là tên môn học (ví dụ: "bóng rổ", "cờ vua")
            for s in special_subjects:
                if content == s:
                    return s.capitalize()
    return None

def is_subject_switch(question):
    """Kiểm tra xem câu hỏi có nhắc đến môn học mới không"""
    # Regex nhận diện mã môn học hoặc từ 'môn'
    if re.search(r"\b\d{2}[A-Z]{2,}[A-Z0-9]*\d{3,}\b", question, re.IGNORECASE):
        return True
    if "môn" in question.lower():
        return True
    return False

# Xử lý câu hỏi
async def stream_answer(question: str, email: str = None, chat_history: list = None, provider: str = "huggingface"):
    """Stream answer to user question"""
    try:
        # Kiểm tra chào hỏi
        if is_greeting(question):
            greeting = get_greeting_response()
            full_answer = ""
            async for chunk in stream_greeting(greeting):
                if isinstance(chunk, str):
                    full_answer += chunk
                yield chunk
            if email:
                await asyncio.get_event_loop().run_in_executor(None, save_chat, email, question, full_answer, [])
            return

        # --- Xử lý câu hỏi ngắn gọn về thông tin môn học ---
        question_lower = question.lower().strip()
        if any(kw in question_lower for kw in SPECIAL_KEYWORDS):
            # Nếu câu hỏi hiện tại chưa chứa tên/mã môn học
            if not is_subject_switch(question):
                subject = extract_last_subject(chat_history)
                if subject:
                    # Thêm tên môn học vào câu hỏi cho rõ ngữ cảnh
                    question = f"{question} của môn {subject}"
                else:
                    # Không tìm được môn học, hỏi lại người dùng
                    yield f"data: {json.dumps({'type': 'chunk', 'text': 'Bạn muốn hỏi về môn học nào? Vui lòng cung cấp tên hoặc mã môn học để mình hỗ trợ chính xác nhé.'})}\n\n"
                    yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                    return

        # --- RAG Process ---
        # Get vectorstore from cloud
        try:
            vectorstore = get_chatbot_vectorstore()
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Không thể kết nối ChromaDB: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            return

        # Lấy context và trả lời đồng thời
        context_task = asyncio.create_task(get_context_async(question, vectorstore))
        
        # Format chat history for prompt
        history_text = format_chat_history(chat_history)
        
        # Đợi context
        context = await context_task
        context_text = "\n".join([doc.page_content.strip() for doc in context])
        
        # Trả lời
        full_answer = ""
        prompt_with_history = SYLLABUS_PROMPT.format(
            context=context_text,
            question=question,
            chat_history=history_text
        )
        
        # Chỉ dùng HuggingFace LLM (provider giữ để tương thích)
        llm = get_hf_llm()
        
        async for chunk in llm.astream(prompt_with_history):
            if isinstance(chunk, str):
                full_answer += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
            elif isinstance(chunk, dict) and 'text' in chunk:
                full_answer += chunk['text']
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk['text']})}\n\n"

        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        
        # Prepare sources with enhanced metadata
        source_docs = []
        for doc in context:
            # Lấy URL từ metadata (ưu tiên trường 'url', nếu không có thì dùng 'source' nếu là URL)
            metadata = doc.metadata
            url = metadata.get('url', '')
            if not url and metadata.get('type') == 'url':
                url = metadata.get('source', '')
            
            source_info = {
                "content": doc.page_content,
                "source": metadata.get('source', 'Unknown'),
                "url": url,  # Thêm trường url rõ ràng
                "type": metadata.get('type', 'unknown'),
                "name": metadata.get('name', ''),
                "page": metadata.get('page', ''),
                "chunk_id": metadata.get('chunk_id', ''),
                "similarity_score": getattr(doc, 'similarity_score', None)
            }
            source_docs.append(source_info)
            
        yield f"data: {json.dumps({'type': 'sources', 'sources': source_docs})}\n\n"

        if email:
            await asyncio.get_event_loop().run_in_executor(None, save_chat, email, question, full_answer, source_docs)

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

async def get_context_async(question: str, vectorstore):
    """Get context asynchronously without prioritization/filtering, just return top k by similarity score"""
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        None,
        lambda: vectorstore.similarity_search_with_score(question.lower().strip(), k=8)
    )
    # Only return docs with score > 0.7, sorted by score descending
    filtered_results = [doc for doc, score in results if score > 0.7]
    return filtered_results[:8]

def format_chat_history(chat_history: list) -> str:
    """Format chat history for prompt"""
    if not chat_history:
        return "Chưa có lịch sử hội thoại trước đó."
        
    history_messages = []
    for chat_turn in chat_history:
        if 'messages' in chat_turn and isinstance(chat_turn['messages'], list):
            history_messages.extend(chat_turn['messages'])
    
    sorted_history_messages = sorted(history_messages, key=lambda x: x.get('timestamp', ''))
    
    history_text = "\n".join([
        f"[{msg.get('timestamp', '')}] {msg.get('role', 'unknown').capitalize()}: {msg.get('content', '')}"
        for msg in sorted_history_messages if msg.get('role') in ['user', 'assistant'] and msg.get('content')
    ])
    
    if len(sorted_history_messages) > 2:
        history_text = "Ngữ cảnh cuộc hội thoại trước đó:\n" + history_text
        
    return history_text

@router.get("/ask_stream")
async def ask_stream(question: str, email: str = None, provider: str = "huggingface"):
    global vectorstore
    try:
        if vectorstore is None and not is_greeting(question):
            try:
                vectorstore = get_vectorstore()
            except Exception as e:
                error_message = {'type': 'error', 'message': f'Vectorstore chưa sẵn sàng. Lỗi: {str(e)}'}
                return StreamingResponse(iter([f"data: {json.dumps(error_message)}\n\n", "data: {\"type\": \"complete\"}\n\n"]), media_type="text/event-stream")

        chat_history = []
        if email:
            try:
                chat_history = await asyncio.get_event_loop().run_in_executor(None, get_chat_history, email, 5)
            except Exception as e:
                logging.error(f"Error retrieving chat history for {email}: {str(e)}")
                chat_history = []
        # ĐẢM BẢO luôn trả về lỗi nếu stream_answer crash giữa chừng
        async def safe_stream():
            try:
                async for chunk in stream_answer(question, email, chat_history, provider):
                    yield chunk
            except Exception as e:
                logging.error(f"stream_answer crashed: {str(e)}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return StreamingResponse(safe_stream(), media_type="text/event-stream")
    except Exception as e:
        error_message = {'type': 'error', 'message': f'Lỗi không xác định: {str(e)}'}
        return StreamingResponse(iter([f"data: {json.dumps(error_message)}\n\n", "data: {\"type\": \"complete\"}\n\n"]), media_type="text/event-stream")


class ArchiveChatRequest(BaseModel):
    email: str
    chat_id: str

@router.post("/archive_chat")
def api_archive_chat(data: ArchiveChatRequest):
    try:
        result = archive_chat(data.email, data.chat_id)
        if result:
            return {"success": True, "message": "Đã lưu trữ đoạn chat."}
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy user hoặc chat.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/unarchive_chat")
def api_unarchive_chat(data: ArchiveChatRequest):
    try:
        result = unarchive_chat(data.email, data.chat_id)
        if result:
            return {"success": True, "message": "Đã xoá khỏi lưu trữ."}
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy user hoặc chat.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/archived_chats")
def api_get_archived_chats(email: str, limit: int = 100):
    try:
        chats = get_archived_chats(email, limit)
        return {"success": True, "chats": chats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metadata_stats")
def get_metadata_stats():
    """Lấy thống kê metadata của vectorstore"""
    try:
        if vectorstore is None:
            raise HTTPException(status_code=404, detail="Vectorstore chưa sẵn sàng")
        
        # Lấy tất cả documents để phân tích metadata
        all_docs = vectorstore.similarity_search("", k=1000)  # Lấy nhiều documents
        
        # Thống kê theo loại tài liệu
        type_stats = {}
        subject_stats = {}
        syllabus_count = 0
        total_chunks = len(all_docs)
        
        for doc in all_docs:
            metadata = doc.metadata
            
            # Thống kê loại tài liệu
            doc_type = metadata.get('type', 'unknown')
            type_stats[doc_type] = type_stats.get(doc_type, 0) + 1
            
            # Thống kê môn học
            subject = metadata.get('subject', 'N/A')
            subject_stats[subject] = subject_stats.get(subject, 0) + 1
            
            # Đếm syllabus
            if metadata.get('is_syllabus', False):
                syllabus_count += 1
        
        return {
            "success": True,
            "stats": {
                "total_chunks": total_chunks,
                "type_distribution": type_stats,
                "subject_distribution": subject_stats,
                "syllabus_count": syllabus_count,
                "syllabus_percentage": round((syllabus_count / total_chunks) * 100, 2) if total_chunks > 0 else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search_by_metadata")
def search_by_metadata(
    subject: str = None,
    doc_type: str = None,
    is_syllabus: bool = None,
    limit: int = 10
):
    """Tìm kiếm documents theo metadata"""
    try:
        if vectorstore is None:
            raise HTTPException(status_code=404, detail="Vectorstore chưa sẵn sàng")
        
        # Lấy tất cả documents
        all_docs = vectorstore.similarity_search("", k=1000)
        
        # Lọc theo metadata
        filtered_docs = []
        for doc in all_docs:
            metadata = doc.metadata
            include_doc = True
            
            if subject and metadata.get('subject') != subject:
                include_doc = False
            if doc_type and metadata.get('type') != doc_type:
                include_doc = False
            if is_syllabus is not None and metadata.get('is_syllabus') != is_syllabus:
                include_doc = False
            
            if include_doc:
                filtered_docs.append({
                    "content": doc.page_content[:200] + "...",
                    "metadata": metadata
                })
        
        return {
            "success": True,
            "results": filtered_docs[:limit],
            "total_found": len(filtered_docs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
