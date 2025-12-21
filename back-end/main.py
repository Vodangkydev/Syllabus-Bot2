import os
from pathlib import Path
import sys
import base64
import json

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import save_feedback, get_all_feedbacks, update_feedback_status, initialize_firestore
from chroma_config import get_vectorstore
import logging
import firebase_admin
from firebase_admin import credentials

# Import routers
from user.router import router as user_router
from admin.router import router as admin_router
from chatbot.router import router as chatbot_router

# Initialize Firebase Admin SDK
def initialize_firebase():
    """Khởi tạo Firebase Admin SDK một lần duy nhất."""
    try:
        if not firebase_admin._apps:
            # Check if using base64 encoded key (for Render/Vercel deployment)
            firebase_key_base64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64")
            if firebase_key_base64:
                # Decode base64 to JSON
                try:
                    firebase_key_json = base64.b64decode(firebase_key_base64).decode('utf-8')
                    cred = credentials.Certificate(json.loads(firebase_key_json))
                    logging.info("Firebase initialized from base64 encoded key")
                except Exception as e:
                    logging.error(f"Error decoding base64 Firebase key: {str(e)}")
                    raise
            else:
                # Use file path (for local development)
                service_account_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY", "serviceAccountKey.json")
                if not os.path.exists(service_account_path):
                    raise FileNotFoundError(
                        f"Firebase service account key file not found at: {service_account_path}. "
                        "Please set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 environment variable."
                    )
                cred = credentials.Certificate(service_account_path)
                logging.info(f"Firebase initialized from file: {service_account_path}")
            
            firebase_admin.initialize_app(cred)
            print("Firebase Admin đã được khởi tạo thành công.")
    except Exception as e:
        logging.error(f"Error initializing Firebase Admin SDK: {str(e)}")
        raise

# Khởi tạo Firebase khi khởi động ứng dụng
initialize_firebase()

# Giới hạn kích thước file upload (ví dụ: 100MB)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Cấu hình cơ bản
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI()

# Load vectorstore từ ChromaDB cloud
try:
    vectorstore = get_vectorstore()
    logger.info("Vectorstore đã được load thành công từ ChromaDB cloud")
except Exception as e:
    logger.error(f"Lỗi khi load vectorstore: {str(e)}")
    raise

# Configure CORS
# Read allowed origins from environment variable or use default
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
cors_origins = [origin.strip() for origin in cors_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="."), name="static")

# Include routers
app.include_router(user_router, prefix="/user", tags=["user"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(chatbot_router, prefix="/chatbot", tags=["chatbot"])

@app.get("/")
async def root():
    return {"message": "Welcome to Syllabus-Bot API"}

@app.on_event("startup")
async def startup_event():
    try:
        # Initialize Firestore
        initialize_firestore()
        logger.info("Firestore initialized successfully")
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 