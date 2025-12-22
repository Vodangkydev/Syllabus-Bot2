# Fix: Railway đang dùng Dockerfile thay vì Nixpacks

## Vấn đề
Railway vẫn đang cố build với Dockerfile mặc dù đã xóa và có `railway.toml` set `builder = "nixpacks"`.

## Giải pháp

### Cách 1: Set Root Directory trong Railway Dashboard (Khuyến nghị)

1. Vào Railway Dashboard → Service Settings
2. Tìm phần **"Root Directory"**
3. Set Root Directory: `back-end`
4. Railway sẽ tự động detect `back-end/nixpacks.toml` và dùng Nixpacks
5. Redeploy

### Cách 2: Xóa nixpacks.toml ở root (nếu không cần)

Nếu bạn chắc chắn chỉ deploy từ `back-end`, có thể xóa `nixpacks.toml` ở root để tránh confusion.

### Cách 3: Force Nixpacks trong Railway Dashboard

1. Vào Railway Dashboard → Service Settings → Build & Deploy
2. Tìm phần **"Builder"**
3. Chọn **"Nixpacks"** (không phải Docker)
4. Set **Root Directory**: `back-end`
5. Redeploy

## Kiểm tra

Sau khi deploy, check logs:
- ✅ Nếu thấy "Using Nixpacks builder" → Đúng
- ❌ Nếu thấy "Dockerfile" → Vẫn sai, cần check lại Root Directory

## File cấu hình hiện tại

- ✅ `back-end/nixpacks.toml` - Cấu hình Nixpacks cho back-end
- ✅ `back-end/railway.toml` - Cấu hình Railway cho back-end  
- ✅ `back-end/Procfile` - Start command
- ⚠️ `nixpacks.toml` (root) - Chỉ dùng nếu Root Directory = root




