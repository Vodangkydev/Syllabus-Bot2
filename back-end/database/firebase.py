import firebase_admin
from firebase_admin import credentials, firestore
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_firestore():
    try:
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        service_account_path = os.path.join(current_dir, "serviceAccountKey.json")
        
        if not os.path.exists(service_account_path):
            logger.error(f"Không tìm thấy file service account key: {service_account_path}")
            raise FileNotFoundError("Service account key not found")
            
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin đã được khởi tạo thành công")
        return firestore.client()
    except Exception as e:
        logger.error(f"Lỗi khi khởi tạo Firebase Admin: {str(e)}")
        raise 