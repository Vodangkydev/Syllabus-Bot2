from datetime import datetime
import logging
from .firebase import initialize_firestore
from firebase_admin import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def save_chat(email, message, response, source_documents=None):
    """
    Lưu tin nhắn chat vào database với cấu trúc mới
    
    Args:
        email (str): Email của người dùng
        message (str): Tin nhắn của người dùng
        response (str): Phản hồi từ bot
        source_documents (list): Danh sách tài liệu nguồn
    """
    try:
        db = initialize_firestore()
        logger.info(f"Saving chat for email: {email}")
        
        # Tạo timestamp chung cho toàn bộ chat
        timestamp = datetime.now()
        
        # Tìm user document dựa trên email
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return None
            
        for user_doc in user_query:
            # Tạo chat document mới
            chat_data = {
                'email': email,
                'firstMessage': message,  # Lưu tin nhắn đầu tiên riêng để dễ phân tích
                'timestamp': timestamp,
                'createdAt': timestamp.isoformat()
            }
            
            # Lưu chat document
            chat_ref = user_doc.reference.collection('chats').add(chat_data)
            chat_id = chat_ref[1].id
            
            # Lưu tin nhắn của user
            user_message = {
                'content': message,
                'role': 'user',
                'timestamp': timestamp
            }
            chat_ref[1].collection('messages').add(user_message)
            
            # Lưu phản hồi của bot
            bot_message = {
                'content': response,
                'role': 'assistant',
                'timestamp': timestamp,
                'sourceDocuments': source_documents or []
            }
            chat_ref[1].collection('messages').add(bot_message)
            
            logger.info(f"Saved chat with ID: {chat_id}")
            return chat_id
        
    except Exception as e:
        logger.error(f"Error saving chat: {str(e)}")
        raise

def get_chat_history(email, limit=200):
    """
    Lấy lịch sử chat của người dùng với cấu trúc mới
    
    Args:
        email (str): Email của người dùng
        limit (int): Số lượng tin nhắn cần lấy
        
    Returns:
        list: Danh sách các tin nhắn
    """
    try:
        db = initialize_firestore()
        logger.info(f"Getting chat history for email: {email}")
        
        # Tìm user document dựa trên email
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        
        chat_history = []
        
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return []
            
        for user_doc in user_query:
            # Lấy từ subcollection chats của user
            chats_ref = user_doc.reference.collection('chats')
            chats_query = chats_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit).get()
            
            for chat in chats_query:
                chat_data = chat.to_dict()
                chat_data['id'] = chat.id
                
                # Lấy tất cả messages của chat này
                messages_ref = chat.reference.collection('messages')
                messages_query = messages_ref.order_by('timestamp').get()
                
                messages = []
                for message in messages_query:
                    message_data = message.to_dict()
                    message_data['id'] = message.id
                    messages.append(message_data)
                
                chat_data['messages'] = messages
                chat_history.append(chat_data)
                    
        return chat_history
        
    except Exception as e:
        logger.error(f"Error getting chat history: {str(e)}")
        raise

def clear_chat_history(email):
    """
    Xóa lịch sử chat của người dùng
    
    Args:
        email (str): Email của người dùng
    """
    try:
        db = initialize_firestore()
        
        # Lấy reference đến collection chats của user
        user_ref = db.collection('users').document(email)
        chats_ref = user_ref.collection('chats')
        
        # Lấy tất cả documents trong collection chats
        chats = chats_ref.get()
        
        # Xóa từng document
        for chat in chats:
            chat.reference.delete()
            
        logger.info(f"Đã xóa lịch sử chat của user {email}")
        
    except Exception as e:
        logger.error(f"Lỗi khi xóa lịch sử chat: {str(e)}")
        raise

def get_chat(user_id, chat_id):
    """
    Lấy một chat cụ thể
    
    Args:
        user_id (str): ID của người dùng
        chat_id (str): ID của chat cần lấy
        
    Returns:
        dict: Thông tin chat hoặc None nếu không tìm thấy
    """
    try:
        db = initialize_firestore()
        
        # Tạo reference đến document chat cụ thể
        user_ref = db.collection('users').document(user_id)
        chat_ref = user_ref.collection('chats').document(chat_id)
        
        # Lấy document
        doc = chat_ref.get()
        if doc.exists:
            chat_data = doc.to_dict()
            chat_data['id'] = doc.id
            return chat_data
        else:
            return None
            
    except Exception as e:
        logger.error(f"Error getting chat: {str(e)}")
        raise

def archive_chat(email, chat_id):
    """
    Đánh dấu một đoạn chat là đã lưu trữ (archived=True)
    """
    try:
        db = initialize_firestore()
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return False
        for user_doc in user_query:
            chat_ref = user_doc.reference.collection('chats').document(chat_id)
            chat_ref.update({'archived': True, 'archivedAt': datetime.now().isoformat()})
            logger.info(f"Archived chat {chat_id} for user {email}")
            return True
    except Exception as e:
        logger.error(f"Error archiving chat: {str(e)}")
        raise


def unarchive_chat(email, chat_id):
    """
    Đánh dấu một đoạn chat là chưa lưu trữ (archived=False)
    """
    try:
        db = initialize_firestore()
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return False
        for user_doc in user_query:
            chat_ref = user_doc.reference.collection('chats').document(chat_id)
            chat_ref.update({'archived': False, 'archivedAt': firestore.DELETE_FIELD})
            logger.info(f"Unarchived chat {chat_id} for user {email}")
            return True
    except Exception as e:
        logger.error(f"Error unarchiving chat: {str(e)}")
        raise


def get_archived_chats(email, limit=100):
    """
    Lấy danh sách các đoạn chat đã lưu trữ (archived=True)
    """
    try:
        db = initialize_firestore()
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        archived_chats = []
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return []
        for user_doc in user_query:
            chats_ref = user_doc.reference.collection('chats')
            chats_query = chats_ref.where('archived', '==', True).order_by('archivedAt', direction=firestore.Query.DESCENDING).limit(limit).get()
            for chat in chats_query:
                chat_data = chat.to_dict()
                chat_data['id'] = chat.id
                archived_chats.append(chat_data)
        return archived_chats
    except Exception as e:
        logger.error(f"Error getting archived chats: {str(e)}")
        raise 