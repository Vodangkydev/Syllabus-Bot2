import os
import sys
import base64
import json
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials

from database import (
    save_feedback,
    get_all_feedbacks,
    update_feedback_status,
    initialize_firestore,
)
from chroma_config import get_vectorstore

from user.router import router as user_router
from admin.router import router as admin_router
from chatbot.router import router as chatbot_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(str(Path(__file__).parent))

app = FastAPI(title="Syllabus-Bot API")

def initialize_firebase():
    if not firebase_admin._apps:
        firebase_key_base64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_BASE64")
        if firebase_key_base64:
            firebase_key_json = base64.b64decode(firebase_key_base64).decode("utf-8")
            cred = credentials.Certificate(json.loads(firebase_key_json))
        else:
            service_account_path = os.environ.get(
                "FIREBASE_SERVICE_ACCOUNT_KEY", "serviceAccountKey.json"
            )
            cred = credentials.Certificate(service_account_path)
        firebase_admin.initialize_app(cred)

initialize_firebase()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

vectorstore = get_vectorstore()

app.include_router(user_router, prefix="/user", tags=["User"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])
app.include_router(chatbot_router, prefix="/chatbot", tags=["Chatbot"])

@app.get("/")
async def root():
    return {"message": "Welcome to Syllabus-Bot API"}

@app.on_event("startup")
async def startup_event():
    initialize_firestore()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
