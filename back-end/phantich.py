import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter
import os
import time
import matplotlib.pyplot as plt
import numpy as np

def initialize_firestore():
    """Khởi tạo Firebase Admin SDK."""
    try:
        if not firebase_admin._apps:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            service_account_path = os.path.join(current_dir, "serviceAccountKey.json")

            if not os.path.exists(service_account_path):
                raise FileNotFoundError(f"Service account key not found at {service_account_path}")

            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"Lỗi khi khởi tạo Firebase Admin: {str(e)}")
        raise

def collect_user_questions():
    """Thu thập tất cả câu hỏi của người dùng từ các cuộc trò chuyện dưới mỗi user."""
    db = initialize_firestore()
    user_questions = []
    total_chats = 0
    total_users = 0
    total_messages = 0

    print("\n--- Bắt đầu lấy câu hỏi người dùng ---")

    users_ref = db.collection('users')
    
    try:
        user_doc_refs = list(users_ref.list_documents())
        print(f"Tìm thấy {len(user_doc_refs)} users")
        
        for user_doc_ref in user_doc_refs:
            total_users += 1
            user_id = user_doc_ref.id
            
            try:
                chats_ref = user_doc_ref.collection('chats')
                chats_stream = chats_ref.stream()
                chats_list = list(chats_stream)
                
                for chat in chats_list:
                    total_chats += 1
                    chat_data = chat.to_dict()
                    
                    if 'firstMessage' in chat_data and chat_data['firstMessage']:
                        content = str(chat_data['firstMessage']).strip().lower()
                        if content:
                            user_questions.append(content)

                    try:
                        messages_ref = chat.reference.collection('messages')
                        messages_stream = messages_ref.stream()
                        messages_list = list(messages_stream)
                        
                        for message in messages_list:
                            message_data = message.to_dict()
                            if message_data and 'content' in message_data and 'role' in message_data:
                                if message_data['role'] == 'user':
                                    content = str(message_data['content']).strip().lower()
                                    if content:
                                        user_questions.append(content)
                                        total_messages += 1
                                        
                    except Exception as e:
                        print(f"Lỗi khi lấy messages cho chat {chat.id}: {str(e)}")
                        continue
                                    
            except Exception as e:
                print(f"Lỗi khi lấy chats cho user {user_id}: {str(e)}")
                continue
        
    except Exception as e:
        print(f"Lỗi khi lấy danh sách users: {str(e)}")
    
    print(f"\n--- Kết thúc lấy dữ liệu ---")
    print(f"Tổng số users: {total_users}")
    print(f"Tổng số chats: {total_chats}")
    print(f"Tổng số messages: {total_messages}")
    print(f"Tổng số câu hỏi: {len(user_questions)}")
    
    return user_questions

def analyze_user_questions(questions, top_n=20):
    """Phân tích tần suất các câu hỏi người dùng phổ biến nhất."""
    if not questions:
        print("Không có câu hỏi người dùng nào để phân tích.")
        return
    
    question_counter = Counter(questions)
    top_questions = question_counter.most_common(top_n)
    
    print(f"\n--- Top {top_n} Câu hỏi của người dùng Phổ Biến Nhất ---")
    for i, (content, count) in enumerate(top_questions, 1):
        print(f"{i}. {content}: {count} lần")

def visualize_top_questions(questions, top_n=20):
    """Tạo biểu đồ cột cho top N câu hỏi phổ biến nhất."""
    if not questions:
        print("Không có câu hỏi người dùng nào để phân tích.")
        return
    
    question_counter = Counter(questions)
    top_questions = question_counter.most_common(top_n)
    top_questions.reverse()
    
    questions = [q[0] for q in top_questions]
    counts = [q[1] for q in top_questions]
    
    plt.figure(figsize=(15, 8))
    bars = plt.barh(range(len(questions)), counts, color='skyblue')
    
    for i, bar in enumerate(bars):
        plt.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
                str(counts[i]), va='center')
    
    plt.yticks(range(len(questions)), questions, fontsize=8)
    plt.xlabel('Số lần xuất hiện')
    plt.title(f'Top {top_n} Câu hỏi của người dùng Phổ Biến Nhất (Giảm dần)')
    plt.tight_layout()
    
    # Save the plot in the static directory
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    os.makedirs(static_dir, exist_ok=True) # Ensure the directory exists
    
    file_path = os.path.join(static_dir, 'top_questions.png')
    plt.savefig(file_path, dpi=300, bbox_inches='tight')
    print(f"\nĐã lưu biểu đồ vào file '{file_path}'")

if __name__ == "__main__":
    try:
        user_questions = collect_user_questions()
        analyze_user_questions(user_questions)
        visualize_top_questions(user_questions)
        
    except FileNotFoundError as e:
        print(f"Lỗi: {e}")
        print("Vui lòng đảm bảo file serviceAccountKey.json nằm cùng cấp với script.")
    except Exception as e:
        print(f"Đã xảy ra lỗi: {str(e)}")
        print("Vui lòng kiểm tra kết nối Firestore và quyền truy cập.")