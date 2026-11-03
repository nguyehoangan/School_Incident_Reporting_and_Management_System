# Backend (sẽ bổ sung)

Thư mục dành cho máy chủ sau này. Hai điểm cần nối với frontend:

- `POST /api/login`  ← form đăng nhập (`frontend/app.js`, hàm xử lý `#loginForm`)
- `POST /api/tickets` (multipart, kèm ảnh) ← form gửi phiếu (`#reqForm`)

Có thể cho backend phục vụ trực tiếp thư mục `frontend/` như static files,
hoặc chạy frontend riêng và backend chỉ cung cấp API (CORS).
