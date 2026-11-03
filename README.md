# School Incident Reporting and Management System

Hệ thống báo cáo & sửa chữa trang thiết bị trường học – Đại học Bách khoa Hà Nội.

## Cấu trúc
```
.
├─ frontend/              # giao diện (static)
│  ├─ index.html
│  ├─ css/styles.css
│  ├─ js/app.js
│  └─ assets/img/         # logoBK.webp, background.webp
├─ backend/               # máy chủ/API (bổ sung sau)
└─ README.md
```

## Màn hình
Trang một trang (hash router), 4 màn hình: **Splash** → **Đăng nhập** → **Màn hình chính** → **Yêu cầu xử lý sự cố** (Hỗ trợ → Yêu cầu xử lý sự cố: phiếu theo biểu mẫu + bảng hư hỏng + tải ảnh).

## Chạy frontend
- Mở `frontend/index.html` bằng Live Server, **Go Live** từ chính file này.
- Hoặc bật GitHub Pages: Settings → Pages → `main` / `/root`, rồi truy cập `/frontend/`.

## Nối backend sau này
Đổi 2 chỗ demo trong `frontend/app.js` thành gọi API bằng `fetch()`:
- đăng nhập → `POST /api/login`
- gửi phiếu → `POST /api/tickets` (gửi kèm ảnh dạng multipart).

## Ghi chú
Bản demo giao diện; logic đăng nhập/gửi phiếu hiện chạy phía client (chưa có backend).
