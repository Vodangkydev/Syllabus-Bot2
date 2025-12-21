from datetime import datetime
import logging
from .firebase import initialize_firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_user_info(email):
    """
    Lấy thông tin người dùng từ database
    
    Args:
        email (str): Email của người dùng
        
    Returns:
        dict: Thông tin người dùng hoặc None nếu không tìm thấy
    """
    try:
        db = initialize_firestore()
        logger.info(f"Getting user info for email: {email}")
        
        # Tìm user document dựa trên email
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return None
            
        for user_doc in user_query:
            user_data = user_doc.to_dict()
            user_data['id'] = user_doc.id
            
            # Nếu là tài khoản Google, tự động set emailVerified = True
            if user_data.get('providerId') == 'google.com':
                user_data['emailVerified'] = True
                
            return user_data
            
    except Exception as e:
        logger.error(f"Error getting user info: {str(e)}")
        raise

def update_user_info(email, user_data):
    """
    Cập nhật thông tin người dùng
    
    Args:
        email (str): Email của người dùng
        user_data (dict): Thông tin cần cập nhật
    """
    try:
        db = initialize_firestore()
        logger.info(f"Updating user info for email: {email}")
        
        # Tìm user document dựa trên email
        users_ref = db.collection('users')
        user_query = users_ref.where('email', '==', email).limit(1).get()
        
        if not user_query:
            logger.warning(f"No user found for email: {email}")
            return None
            
        for user_doc in user_query:
            # Cập nhật document
            user_doc.reference.update(user_data)
            logger.info(f"Updated user info for email: {email}")
            
    except Exception as e:
        logger.error(f"Error updating user info: {str(e)}")
        raise

def get_user_activities(user_id, limit=20):
    """
    Lấy danh sách hoạt động của người dùng
    
    Args:
        user_id (str): ID của người dùng
        limit (int): Số lượng hoạt động cần lấy
        
    Returns:
        list: Danh sách các hoạt động
    """
    try:
        db = initialize_firestore()
        logger.info(f"Getting activities for user: {user_id}")
        
        # Lấy từ collection activities của user
        user_ref = db.collection('users').document(user_id)
        activities_ref = user_ref.collection('activities')
        activities_query = activities_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit).get()
        
        activities = []
        for activity in activities_query:
            activity_data = activity.to_dict()
            activity_data['id'] = activity.id
            activities.append(activity_data)
            
        return activities
        
    except Exception as e:
        logger.error(f"Error getting user activities: {str(e)}")
        raise

def save_user_activity(user_id, activity_type, activity_data):
    """
    Lưu hoạt động của người dùng
    
    Args:
        user_id (str): ID của người dùng
        activity_type (str): Loại hoạt động
        activity_data (dict): Dữ liệu hoạt động
    """
    try:
        db = initialize_firestore()
        logger.info(f"Saving activity for user: {user_id}")
        
        # Tạo timestamp
        timestamp = datetime.now()
        
        # Tạo activity document
        activity = {
            'type': activity_type,
            'timestamp': timestamp,
            **activity_data
        }
        
        # Lưu vào collection activities của user
        user_ref = db.collection('users').document(user_id)
        user_ref.collection('activities').add(activity)
        
        logger.info(f"Saved activity for user: {user_id}")
        
    except Exception as e:
        logger.error(f"Error saving user activity: {str(e)}")
        raise

def clear_user_activities(user_id):
    """
    Xóa tất cả hoạt động của người dùng
    
    Args:
        user_id (str): ID của người dùng
    """
    try:
        db = initialize_firestore()
        logger.info(f"Clearing activities for user: {user_id}")
        
        # Lấy reference đến collection activities của user
        user_ref = db.collection('users').document(user_id)
        activities_ref = user_ref.collection('activities')
        
        # Lấy tất cả documents trong collection activities
        activities = activities_ref.get()
        
        # Xóa từng document
        for activity in activities:
            activity.reference.delete()
            
        logger.info(f"Cleared activities for user: {user_id}")
        
    except Exception as e:
        logger.error(f"Error clearing user activities: {str(e)}")
        raise

def get_all_users_and_chats():
    """
    Lấy tất cả người dùng và chat của họ
    
    Returns:
        list: Danh sách người dùng và chat
    """
    try:
        db = initialize_firestore()
        logger.info("Getting all users and chats")
        
        # Lấy tất cả users
        users_ref = db.collection('users')
        users = users_ref.get()
        
        result = []
        for user in users:
            user_data = user.to_dict()
            user_data['id'] = user.id
            
            # Lấy tất cả chats của user
            chats_ref = user.reference.collection('chats')
            chats = chats_ref.get()
            
            user_chats = []
            for chat in chats:
                chat_data = chat.to_dict()
                chat_data['id'] = chat.id
                user_chats.append(chat_data)
                
            user_data['chats'] = user_chats
            result.append(user_data)
            
        return result
        
    except Exception as e:
        logger.error(f"Error getting all users and chats: {str(e)}")
        raise 