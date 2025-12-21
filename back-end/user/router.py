from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Path
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
from firebase_admin import auth, firestore
from datetime import datetime
import os
from database import save_chat, get_chat_history, save_feedback, get_all_feedbacks, update_feedback_status

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# Pydantic models
class Feedback(BaseModel):
    user_email: str
    message: str
    status: str = "pending"
    created_at: datetime = datetime.now()

class FeedbackStatus(BaseModel):
    status: str

# Middleware to verify user
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/feedback")
async def submit_feedback(feedback: Feedback, token: dict = Depends(verify_token)):
    """Gửi feedback từ người dùng"""
    try:
        db = firestore.client()
        feedback_dict = feedback.dict()
        feedback_dict["created_at"] = datetime.now()
        feedback_dict["user_id"] = token.get('uid')
        feedback_dict["user_email"] = token.get('email')
        feedback_dict["timestamp"] = datetime.now()
        
        # Lưu feedback vào collection feedbacks
        feedback_ref = db.collection("feedbacks").document()
        feedback_dict["id"] = feedback_ref.id
        feedback_ref.set(feedback_dict)
        
        return {"status": "success", "message": "Feedback submitted successfully", "feedback_id": feedback_ref.id}
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat-history")
async def get_user_chat_history(token: dict = Depends(verify_token)):
    """Lấy lịch sử chat của người dùng"""
    try:
        uid = token.get('uid')
        db = firestore.client()
        
        # Lấy 50 chat gần nhất
        chats_ref = db.collection("users").document(uid).collection("chats")
        chats = chats_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(50).stream()
        
        chat_history = []
        for chat in chats:
            chat_data = chat.to_dict()
            chat_data["id"] = chat.id
            chat_history.append(chat_data)
            
        return {"chats": chat_history}
    except Exception as e:
        logger.error(f"Error getting chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-data")
async def delete_user_data(token: dict = Depends(verify_token)):
    """Xóa tất cả dữ liệu của người dùng"""
    try:
        uid = token.get('uid')
        db = firestore.client()
        
        # Xóa tất cả chats
        chats_ref = db.collection("users").document(uid).collection("chats")
        chats = chats_ref.stream()
        for chat in chats:
            chat.reference.delete()
            
        # Xóa tất cả activities
        activities_ref = db.collection("users").document(uid).collection("activities")
        activities = activities_ref.stream()
        for activity in activities:
            activity.reference.delete()
            
        return {"status": "success", "message": "All user data deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting user data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedback")
async def get_user_feedback(token: dict = Depends(verify_token)):
    """Get user's feedback history"""
    try:
        user_id = token['uid']
        db = firestore.client()
        feedback_ref = db.collection('users').document(user_id).collection('feedback')
        feedback_docs = feedback_ref.stream()
        
        feedback_list = []
        for doc in feedback_docs:
            feedback_data = doc.to_dict()
            feedback_list.append({
                "id": doc.id,
                "message": feedback_data.get('message', ''),
                "status": feedback_data.get('status', 'pending'),
                "timestamp": feedback_data.get('timestamp', '')
            })
        
        return {"status": "success", "feedback": feedback_list}
    except Exception as e:
        logging.error(f"Error getting user feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile")
async def get_user_profile(token: dict = Depends(verify_token)):
    """Lấy thông tin profile của người dùng hiện tại"""
    try:
        uid = token.get('uid')
        user = auth.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "displayName": user.display_name,
            "photoURL": user.photo_url,
            "isAdmin": user.custom_claims.get('admin', False) if user.custom_claims else False,
            "lastSignInTime": user.user_metadata.last_sign_in_timestamp.isoformat() if user.user_metadata.last_sign_in_timestamp else None
        }
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/profile")
async def update_user_profile(
    display_name: str = None,
    photo_url: str = None,
    token: dict = Depends(verify_token)
):
    """Cập nhật thông tin profile của người dùng"""
    try:
        uid = token.get('uid')
        update_data = {}
        if display_name is not None:
            update_data['display_name'] = display_name
        if photo_url is not None:
            update_data['photo_url'] = photo_url
            
        if update_data:
            auth.update_user(uid, **update_data)
            return {"status": "success", "message": "Profile updated successfully"}
        else:
            raise HTTPException(status_code=400, detail="No update data provided")
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/account")
async def delete_account(token: dict = Depends(verify_token)):
    """Xóa tài khoản người dùng hiện tại"""
    try:
        uid = token.get('uid')
        auth.delete_user(uid)
        return {"status": "success", "message": "Account deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedback/history")
async def get_user_feedback_history(token: dict = Depends(verify_token)):
    """Get user's feedback history from main feedbacks collection"""
    try:
        user_id = token.get('uid')
        db = firestore.client()
        feedbacks_ref = db.collection('feedbacks')
        query = feedbacks_ref.where('user_id', '==', user_id)
        feedback_docs = query.stream()

        feedback_list = []
        for doc in feedback_docs:
            data = doc.to_dict()
            feedback_list.append({
                "id": doc.id,
                "message": data.get('message', ''),
                "status": data.get('status', 'pending'),
                "created_at": data.get('created_at', '')
            })
        return feedback_list
    except Exception as e:
        logging.error(f"Error getting user feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/archive-chat/{chat_id}")
async def archive_chat(
    chat_id: str = Path(..., description="ID của đoạn chat cần lưu trữ"),
    token: dict = Depends(verify_token)
):
    """Lưu trữ (ẩn) một đoạn chat"""
    try:
        uid = token.get('uid')
        db = firestore.client()
        chat_ref = db.collection("users").document(uid).collection("chats").document(chat_id)
        chat = chat_ref.get()
        if not chat.exists:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat_ref.update({"archived": True})
        return {"status": "success", "message": "Chat archived"}
    except Exception as e:
        logger.error(f"Error archiving chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/archived-chats")
async def get_archived_chats(token: dict = Depends(verify_token)):
    """Lấy danh sách các đoạn chat đã lưu trữ"""
    try:
        uid = token.get('uid')
        if not uid:
            raise HTTPException(status_code=401, detail="User ID not found in token")
            
        db = firestore.client()
        chats_ref = db.collection("users").document(uid).collection("chats")
        
        # Get all chats and filter archived ones
        chats = chats_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).stream()
        result = []
        
        for chat in chats:
            chat_data = chat.to_dict()
            # Check if chat is archived (either explicitly True or has status 'archived')
            if chat_data.get("archived") == True or chat_data.get("status") == "archived":
                chat_data["id"] = chat.id
                result.append(chat_data)
                
        return {"chats": result}
    except Exception as e:
        logger.error(f"Error getting archived chats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get archived chats: {str(e)}")

@router.post("/unarchive-chat/{chat_id}")
async def unarchive_chat(
    chat_id: str = Path(..., description="ID của đoạn chat cần bỏ lưu trữ"),
    token: dict = Depends(verify_token)
):
    """Bỏ lưu trữ một đoạn chat"""
    try:
        uid = token.get('uid')
        db = firestore.client()
        chat_ref = db.collection("users").document(uid).collection("chats").document(chat_id)
        chat = chat_ref.get()
        if not chat.exists:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat_ref.update({
            "archived": False,
            "status": "active",
            "archivedAt": firestore.DELETE_FIELD
        })
        return {"status": "success", "message": "Chat unarchived"}
    except Exception as e:
        logger.error(f"Error unarchiving chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-chat/{chat_id}")
async def delete_chat(
    chat_id: str = Path(..., description="ID của đoạn chat cần xóa"),
    token: dict = Depends(verify_token)
):
    """Xóa một đoạn chat"""
    try:
        uid = token.get('uid')
        db = firestore.client()
        chat_ref = db.collection("users").document(uid).collection("chats").document(chat_id)
        chat = chat_ref.get()
        if not chat.exists:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat_ref.delete()
        return {"status": "success", "message": "Chat deleted"}
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/share-chat/{chat_id}")
async def share_chat(
    chat_id: str = Path(..., description="ID của đoạn chat cần chia sẻ"),
    token: dict = Depends(verify_token)
):
    """Chia sẻ một đoạn chat"""
    try:
        uid = token.get('uid')
        db = firestore.client()
        chat_ref = db.collection("users").document(uid).collection("chats").document(chat_id)
        chat = chat_ref.get()
        
        if not chat.exists:
            raise HTTPException(status_code=404, detail="Chat not found")
            
        chat_data = chat.to_dict()
        
        # Tạo một bản sao của chat trong collection shared_chats
        shared_chat_ref = db.collection("shared_chats").document()
        shared_chat_data = {
            "original_chat_id": chat_id,
            "original_user_id": uid,
            "title": chat_data.get("title", "Untitled Chat"),
            "messages": chat_data.get("messages", []),
            "timestamp": datetime.now(),
            "share_count": 0
        }
        shared_chat_ref.set(shared_chat_data)
        
        return {
            "status": "success", 
            "message": "Chat shared successfully",
            "share_id": shared_chat_ref.id
        }
    except Exception as e:
        logger.error(f"Error sharing chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shared-chat/{share_id}")
async def get_shared_chat(
    share_id: str = Path(..., description="ID của đoạn chat được chia sẻ"),
    token: dict = Depends(verify_token)
):
    """Lấy thông tin của một đoạn chat được chia sẻ"""
    try:
        db = firestore.client()
        shared_chat_ref = db.collection("shared_chats").document(share_id)
        shared_chat = shared_chat_ref.get()
        
        if not shared_chat.exists:
            raise HTTPException(status_code=404, detail="Shared chat not found")
            
        shared_chat_data = shared_chat.to_dict()
        
        # Tăng số lượt xem
        shared_chat_ref.update({
            "share_count": firestore.Increment(1)
        })
        
        return {
            "status": "success",
            "chat": shared_chat_data
        }
    except Exception as e:
        logger.error(f"Error getting shared chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))