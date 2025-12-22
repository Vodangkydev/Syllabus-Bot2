# Checklist Kiểm tra Deploy Railway

## ✅ Đã hoàn thành

### 1. File cấu hình Railway
- ✅ `railway.toml` (root) - Cấu hình deploy từ root
- ✅ `back-end/railway.toml` - Cấu hình khi root directory = back-end
- ✅ `back-end/Procfile` - Start command với $PORT
- ✅ `nixpacks.toml` - Cấu hình Nixpacks builder

### 2. Dockerfile
- ✅ `Dockerfile` (root) - Multi-stage build tối ưu
- ✅ `back-end/Dockerfile` - Multi-stage build tối ưu
- ✅ `.dockerignore` - Loại trừ file không cần thiết

### 3. Requirements
- ✅ `back-end/requirements.txt` - Đầy đủ dependencies
- ✅ Đã thêm `beautifulsoup4` (thiếu trước đó)
- ⚠️ Vẫn có `unstructured` (chỉ dùng cho Word files, có thể loại bỏ nếu chỉ cần PDF)

### 4. Code
- ✅ `main.py` - Sử dụng PORT từ environment
- ✅ Firebase config - Hỗ trợ base64 encoded key
- ✅ ChromaDB - Sử dụng cloud (không cần local DB)

## ⚠️ Cần xử lý

### 1. Unstructured Library (QUAN TRỌNG - Giảm ~1-2GB)
- **Vấn đề**: `unstructured` rất nặng (~1-2GB) nhưng chỉ dùng cho Word files (.doc, .docx)
- **Giải pháp**: 
  - Nếu chỉ cần PDF: Loại bỏ `unstructured` và code xử lý Word files
  - Nếu cần Word files: Giữ lại (nhưng image sẽ lớn)

**File cần sửa:**
- `back-end/admin/router.py` - Dòng 291: `partition(file=file.file)` cho Word files
- `back-end/chatbot/router.py` - Import unstructured nhưng không dùng (có thể xóa)

### 2. Langchain-ollama (Tùy chọn - Giảm ~500MB-1GB)
- **Vấn đề**: Code vẫn import `langchain_ollama` nhưng requirements đã comment
- **Giải pháp**: 
  - Nếu không dùng Ollama: Xóa import và code liên quan
  - Nếu cần Ollama: Uncomment trong requirements.txt

**File cần sửa:**
- `back-end/chatbot/router.py` - Dòng 18: `from langchain_ollama import OllamaLLM`
- `back-end/chatbot/router.py` - Dòng 125-152: Functions liên quan Ollama

## 📋 Checklist trước khi deploy

### Bước 1: Quyết định về dependencies
- [ ] **Chỉ cần PDF?** → Loại bỏ `unstructured` và code xử lý Word
- [ ] **Cần Word files?** → Giữ `unstructured` (chấp nhận image lớn)
- [ ] **Dùng Ollama?** → Uncomment `langchain-ollama` trong requirements.txt
- [ ] **Chỉ dùng HuggingFace?** → Xóa code Ollama

### Bước 2: Kiểm tra requirements.txt
- [ ] File có đầy đủ dependencies
- [ ] Không có dependencies thừa
- [ ] Version numbers hợp lý

### Bước 3: Kiểm tra code
- [ ] Không có import lỗi
- [ ] Tất cả dependencies được sử dụng hoặc đã xóa
- [ ] Environment variables được set đúng

### Bước 4: Cấu hình Railway
- [ ] Chọn Builder: **Nixpacks** (khuyến nghị) hoặc Dockerfile
- [ ] Set Root Directory: `back-end`
- [ ] Environment Variables đã được set:
  - `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`
  - `CHROMA_API_KEY`
  - `CHROMA_TENANT`
  - `CHROMA_DATABASE`
  - `CHROMA_COLLECTION_NAME`
  - `USE_CHROMA_CLOUD=true`
  - `CORS_ORIGINS`
  - `HF_TOKEN` (nếu dùng HuggingFace)

## 🎯 Khuyến nghị tối ưu

### Option 1: Tối ưu tối đa (Chỉ PDF, HuggingFace)
- Loại bỏ `unstructured` → Giảm ~1-2GB
- Loại bỏ `langchain-ollama` → Giảm ~500MB-1GB
- **Tổng giảm: ~1.5-3GB**
- **Image size dự kiến: ~2-3GB** (phù hợp với Railway free tier)

### Option 2: Giữ Word support
- Giữ `unstructured` → Image ~4-5GB
- Loại bỏ `langchain-ollama` → Giảm ~500MB-1GB
- **Image size dự kiến: ~4-5GB** (cần upgrade Railway plan)

### Option 3: Đầy đủ tính năng
- Giữ tất cả → Image ~5-6GB
- **Cần upgrade Railway plan**

## 📝 Next Steps

1. Quyết định: Chỉ PDF hay cần Word files?
2. Quyết định: Dùng Ollama hay chỉ HuggingFace?
3. Sửa code theo quyết định
4. Test local trước khi deploy
5. Deploy lên Railway với Nixpacks builder




