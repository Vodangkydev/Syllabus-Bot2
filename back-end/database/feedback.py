from datetime import datetime
import logging
from .firebase import initialize_firestore
from firebase_admin import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def save_feedback(user_email: str, message: str):
    """
    Lưu góp ý của người dùng vào database
    
    Args:
        user_email (str): Email của người dùng
        message (str): Nội dung góp ý
    """
    try:
        db = initialize_firestore()
        timestamp = datetime.now()
        
        feedback_data = {
            'user_email': user_email,
            'message': message,
            'timestamp': timestamp.isoformat(),
            'created_at': timestamp.isoformat(),
            'status': 'pending'  # pending, reviewed, resolved
        }
        
        # Lưu vào collection feedbacks
        feedback_ref = db.collection('feedbacks').add(feedback_data)
        logger.info(f"Saved feedback from {user_email}")
        return feedback_ref[1].id
        
    except Exception as e:
        logger.error(f"Error saving feedback: {str(e)}")
        raise

def get_all_feedbacks(limit: int = 100):
    """
    Lấy tất cả góp ý từ database
    
    Args:
        limit (int): Số lượng góp ý cần lấy
        
    Returns:
        list: Danh sách các góp ý
    """
    try:
        db = initialize_firestore()
        
        # Lấy tất cả feedbacks, sắp xếp theo thời gian mới nhất
        feedbacks_ref = db.collection('feedbacks')
        feedbacks_query = feedbacks_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit).get()
        
        feedbacks = []
        for feedback in feedbacks_query:
            feedback_data = feedback.to_dict()
            feedback_data['id'] = feedback.id
            feedbacks.append(feedback_data)
            
        return feedbacks
        
    except Exception as e:
        logger.error(f"Error getting feedbacks: {str(e)}")
        raise

def update_feedback_status(feedback_id: str, status: str):
    """
    Cập nhật trạng thái của góp ý
    
    Args:
        feedback_id (str): ID của góp ý
        status (str): Trạng thái mới (pending, reviewed, resolved)
    """
    try:
        db = initialize_firestore()
        
        # Cập nhật trạng thái
        db.collection('feedbacks').document(feedback_id).update({
            'status': status,
            'updated_at': datetime.now().isoformat()
        })
        
        logger.info(f"Updated feedback {feedback_id} status to {status}")
        
    except Exception as e:
        logger.error(f"Error updating feedback status: {str(e)}")
        raise 