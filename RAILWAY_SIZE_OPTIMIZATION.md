# Tối ưu Image Size cho Railway Free Tier (< 4GB)

## Vấn đề
Image hiện tại: **8.0 GB** - Vượt quá giới hạn 4.0 GB của Railway free tier.

## Nguyên nhân chính

### Dependencies nặng:
1. **chromadb==1.0.10** - ~2-3GB (rất nặng)
2. **langchain-huggingface==0.2.0** - Có thể pull models lớn
3. **langchain** và các packages liên quan - ~1-2GB
4. **firebase-admin==6.4.0** - ~500MB-1GB

## Giải pháp

### Option 1: Dùng Nixpacks (Khuyến nghị)
- Nixpacks tự động tối ưu và thường tạo image nhỏ hơn Dockerfile
- Đã chuyển sang Nixpacks builder
- **Kích thước dự kiến: ~3-4GB** (có thể vẫn lớn)

### Option 2: Loại bỏ chromadb (Nếu không cần local)
- Nếu chỉ dùng ChromaDB Cloud, có thể thử không cài chromadb
- **Rủi ro**: Code đang dùng `chromadb.CloudClient()` - có thể lỗi
- **Tiết kiệm: ~2-3GB**

### Option 3: Upgrade Railway Plan
- Upgrade lên plan có giới hạn lớn hơn 4GB
- Xem tại: https://railway.app/pricing

### Option 4: Tách services
- Deploy một số services riêng biệt
- Giảm dependencies cho mỗi service

## Thử nghiệm

### Test 1: Nixpacks Builder
- Đã chuyển sang Nixpacks
- Deploy và kiểm tra kích thước

### Test 2: Nếu vẫn lớn, thử loại bỏ chromadb
1. Comment `chromadb==1.0.10` trong requirements.txt
2. Deploy và test xem có lỗi không
3. Nếu lỗi, cần giữ lại

## Khuyến nghị

**Nếu Nixpacks vẫn tạo image > 4GB:**
1. Upgrade Railway plan (nhanh nhất)
2. Hoặc tách services thành nhiều deployments nhỏ hơn
3. Hoặc tối ưu code để giảm dependencies

## File cấu hình hiện tại

- ✅ `back-end/nixpacks.toml` - Cấu hình Nixpacks
- ✅ `back-end/railway.toml` - Builder = nixpacks
- ✅ `back-end/requirements.txt` - Dependencies (đã loại bỏ matplotlib)




