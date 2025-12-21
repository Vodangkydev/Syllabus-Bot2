# Giải pháp giảm Image xuống 1GB

## ⚠️ Vấn đề

Với các dependencies hiện tại, **KHÔNG THỂ** giảm xuống 1GB vì:

1. **chromadb==1.0.10**: ~2-3GB (BẮT BUỘC - code cần `chromadb.CloudClient()`)
2. **langchain packages**: ~1-2GB (cần cho RAG)
3. **langchain-huggingface**: Có thể pull models lớn
4. **firebase-admin**: ~500MB-1GB
5. **Python base image**: ~200-300MB

**Tổng tối thiểu: ~4-6GB**

## ✅ Giải pháp khả thi

### Option 1: Dùng External Services (Khuyến nghị)

Thay vì cài local models, dùng API:

1. **Embeddings**: Dùng API service (OpenAI, Cohere, etc.) thay vì `langchain-huggingface`
   - Tiết kiệm: ~1-2GB
   - Cần: API key và chi phí API calls

2. **ChromaDB**: Đã dùng Cloud (tốt)
   - Vẫn cần package `chromadb` để import `CloudClient`
   - Không thể bỏ được

3. **Kết quả**: ~2-3GB (vẫn > 1GB nhưng gần hơn)

### Option 2: Tách Services

Tách thành nhiều microservices:

1. **API Service** (FastAPI): ~500MB-1GB
   - Chỉ FastAPI, Firebase, basic dependencies
   
2. **RAG Service** (riêng): ~2-3GB
   - LangChain, ChromaDB, Embeddings
   - Deploy riêng hoặc dùng external service

3. **Kết quả**: Mỗi service < 4GB

### Option 3: Dùng Serverless Functions

- Deploy các functions riêng biệt
- Mỗi function chỉ load dependencies cần thiết
- Railway có hỗ trợ serverless

### Option 4: Upgrade Plan

- Railway free tier: 4GB limit
- Upgrade plan có limit lớn hơn
- Xem: https://railway.app/pricing

## 🎯 Khuyến nghị

**Với yêu cầu 1GB, cần:**

1. **Loại bỏ langchain-huggingface** và dùng API embeddings
2. **Giữ chromadb** (không thể bỏ)
3. **Tối ưu tối đa** các dependencies khác
4. **Kết quả dự kiến: ~2-3GB** (vẫn > 1GB)

**Hoặc:**

- **Tách services** thành nhiều deployments
- **Dùng external APIs** thay vì local models
- **Upgrade Railway plan** nếu cần

## 📝 File đã tạo

- `back-end/requirements-1gb.txt` - Version tối ưu (vẫn sẽ > 1GB do chromadb)

## ⚠️ Lưu ý

**1GB là KHÔNG KHẢ THI** với:
- ChromaDB client (bắt buộc)
- LangChain (cần cho RAG)
- Firebase Admin

Cần thay đổi kiến trúc hoặc upgrade plan.

