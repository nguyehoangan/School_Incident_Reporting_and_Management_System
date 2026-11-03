# School Incident Reporting and Management System

Hệ thống báo cáo & sửa chữa trang thiết bị trường học (bản demo giao diện) – Đại học Bách khoa Hà Nội.

## Nội dung
Trang web gồm `index.html` (ở gốc repo) + thư mục `images/` chứa logo và ảnh nền; 4 màn hình nối với nhau bằng hash router:

1. **Splash** – trang giới thiệu theo mẫu (dải đỏ + logo + ảnh sân trường).
2. **Đăng nhập** – đăng nhập bằng email trường hoặc tài khoản/mật khẩu (bản demo: nhập bất kỳ).
3. **Màn hình chính** – thanh menu, thông báo, tài khoản; nội dung để trắng.
4. **Yêu cầu xử lý sự cố** (Hỗ trợ → Yêu cầu xử lý sự cố) – phiếu đề nghị sửa chữa theo biểu mẫu, bảng nội dung hư hỏng và ô tải ảnh hiện trạng.

`index.html` đọc ảnh từ thư mục `images/` qua đường dẫn tương đối.

## Chạy thử
Mở `index.html` bằng trình duyệt / Live Server, hoặc bật GitHub Pages (Settings → Pages → branch `main`, thư mục `/root`) để có link web công khai.

## Ghi chú
Đây là bản demo giao diện phục vụ nội bộ trường, logic đăng nhập/gửi phiếu chạy phía client (chưa có backend).
