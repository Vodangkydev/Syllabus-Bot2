# Syllabus-Bot

Chatbot thông minh giúp sinh viên và giảng viên tra cứu thông tin chi tiết trong đề cương môn học Khoa Công nghệ thông Tin.

Dự án cung cấp một bộ công cụ hoàn chỉnh cho cả người dùng cuối và quản trị viên.

## 1. Yêu cầu và Cài đặt

### 1.1. Yêu cầu hệ thống

Để triển khai và sử dụng chatbot một cách hiệu quả, hệ thống cần đáp ứng các yêu cầu tối thiểu sau:

**Phần cứng:**
- CPU: 2 nhân trở lên
- RAM: Tối thiểu 4GB
- Bộ nhớ trống: Ít nhất 4GB

**Phần mềm:**
- Node.js (phiên bản 14 trở lên)
- Python (phiên bản 3.9 trở lên)
- Git
- Ollama (phiên bản mới nhất)
- Trình duyệt web hiện đại (Chrome, Firefox, Edge,...)

### 1.2. Cài đặt môi trường phát triển

1. Cài đặt Node.js:
   - Truy cập nodejs.org, tải xuống phiên bản phù hợp và cài đặt.
   - Kiểm tra phiên bản: node --version

2. Cài đặt Python:
   - Truy cập python.org/downloads, tải về phiên bản từ 3.9 trở lên.
   - Lưu ý: Trong quá trình cài đặt, đánh dấu vào tùy chọn Add Python to PATH.
   - Kiểm tra phiên bản: python --version

3. Cài đặt Ollama:
   - Truy cập ollama.ai/download, tải về và cài đặt.
   - Kiểm tra phiên bản: ollama --version
   - Tải mô hình ngôn ngữ llama3.2 (hoặc phiên bản khác nếu muốn): ollama pull llama3.2
   - Kiểm tra lại danh sách mô hình đã tải: ollama list

4. Cài đặt Git:
   - Truy cập git-scm.com/downloads, tải về và cài đặt.
   - Kiểm tra phiên bản: git --version

### 1.3. Cài đặt dự án

1. Tải mã nguồn từ GitHub:
   - git clone https://github.com/Vodangkydev/Syllabus-Bot.git

2. Di chuyển vào thư mục dự án:
   - cd Syllabus-Bot

3. Cài đặt Front-end:
   - Di chuyển vào thư mục front-end: cd front-end
   - Cài đặt các gói phụ thuộc: npm install

4. Cài đặt Back-end:
   - Mở một cửa sổ terminal mới.
   - Di chuyển vào thư mục back-end: cd path/to/Syllabus-Bot/back-end
   - Tạo môi trường ảo (virtual environment): python -m venv venv
   - Kích hoạt môi trường ảo:
     - Trên Windows: .\venv\Scripts\activate
     - Trên macOS/Linux: source venv/bin/activate
   - Cài đặt các thư viện Python cần thiết: pip install -r requirements.txt

5. Thêm file cấu hình Firebase (serviceAccountKey):
   - Truy cập Firebase Console (https://console.firebase.google.com/), chọn project phù hợp.
   - Vào Cài đặt dự án (biểu tượng bánh răng) > Tài khoản dịch vụ.
   - Nhấn "Tạo khóa riêng tư mới" (Generate new private key) và tải file `serviceAccountKey.json` về máy. ( Nhớ đặt tên file là 'serviceAccountKey.json')
   - Đặt file này vào thư mục `back-end/` của dự án, đường dẫn đầy đủ là:
     Syllabus-Bot/back-end/serviceAccountKey.json
   

## 2. Hướng dẫn sử dụng

Cần mở 3 cửa sổ terminal riêng biệt để chạy 3 dịch vụ: Ollama, Back-end, và Front-end.

1. Terminal 1: Khởi động Ollama Server
   - ollama serve
   (Lưu ý: Giữ cửa sổ này mở trong suốt quá trình sử dụng.)

2. Terminal 2: Khởi động Back-end Server
   - Di chuyển đến thư mục back-end.
   - Kích hoạt môi trường ảo (./venv/Scripts/activate).
   - Chạy ứng dụng: python main.py
   - Back-end sẽ chạy tại http://localhost:8000

3. Terminal 3: Khởi động Front-end
   - Di chuyển đến thư mục front-end.
   - Khởi động ứng dụng: npm run dev
   - Giao diện sẽ có sẵn tại http://localhost:5173 (hoặc một cổng khác do Vite chỉ định).

### 2.2. Hướng dẫn sử dụng

1. Mở trình duyệt và truy cập http://localhost:5173
2. Nhấn nút "Đăng nhập" ở góc trên bên phải và đăng nhập bằng tài khoản Google.
3. Sau khi đăng nhập thành công, bạn sẽ thấy giao diện chat.
4. Nhập câu hỏi vào ô chat và nhấn Enter để bắt đầu trò chuyện.

## 3. Source Code

### 3.1. Link Repository

- GitHub: https://github.com/Vodangkydev/Syllabus-Bot
- Bản Demo: https://syllasbus-bot-frontend.onrender.com/
- Video Demo: Xem tại đây: https://drive.google.com/file/d/1lNlPrr9tclsolmCER2DsLtlBTyi_zxz2/view?usp=drive_link
- Thiết kế Figma: https://www.figma.com/design/OCRuVbWktusnVnL8sIb6N5/Syllabus-Bot?node-id=0-1&t=iueznOR1P3L1sDw7-1
- Tài liệu văn bản thuần hỗ trở rag: https://drive.google.com/drive/folders/1iotyjf0k1DCpnSBnSLX3DmMtXXHT7w22?usp=drive_link

### 3.2. Cấu trúc dự án

Dự án được tổ chức theo cấu trúc monorepo với hai phần chính:

Syllabus-Bot/
- back-end/
- front-end/
- README.md

Cấu trúc back-end:
- admin/: Logic và router cho trang quản trị
- chatbot/: Logic và router cho chatbot
- chroma_db/: Vector database (lưu trữ dữ liệu nhúng)
- data/: Chứa các file PDF đề cương để nạp dữ liệu
- database/: Các module tương tác với Firestore (feedback,...)
- static/: Chứa các file tĩnh
- user/: Logic và router cho người dùng
- venv/: Môi trường ảo Python
- ingest.py: Script xử lý, nhúng và lưu trữ dữ liệu từ PDF
- main.py: Điểm khởi đầu của ứng dụng FastAPI
- requirements.txt: Danh sách các thư viện Python

Cấu trúc front-end:
- public/: Các file public (logo, hình ảnh)
- src/: Mã nguồn chính của ứng dụng React
  - admin/: Components, layouts, pages cho trang quản trị
  - assets/: Tài nguyên tĩnh (ảnh, slider)
  - components/: Các React component có thể tái sử dụng
  - context/: Quản lý state toàn cục (Authentication, PageState)
  - hooks/: Các custom hooks (ví dụ: useChatHistory)
  - styles/: Các file CSS cho từng component/page
  - user/: Components, layouts, pages cho trang người dùng
  - utils/: Các hàm tiện ích (API calls, image upload)
  - App.jsx: Component gốc của ứng dụng
  - firebase.js: Cấu hình Firebase cho client
  - main.jsx: Điểm khởi đầu của ứng dụng React
- package.json: Thông tin dự án và danh sách dependencies
- vite.config.js: Cấu hình cho Vite 
